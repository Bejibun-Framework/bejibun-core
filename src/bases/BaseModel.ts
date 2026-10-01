import Luxon from "@bejibun/utils/facades/Luxon";
import {
    Model,
    ModelClass,
    PartialModelObject,
    QueryBuilder,
    QueryBuilderType,
    TransactionOrKnex
} from "objection";
import ModelNotFoundException from "@/exceptions/ModelNotFoundException";
import SoftDeletes from "@/facades/SoftDeletes";
import RuntimeException from "@/exceptions/RuntimeException";

/** Acceptable representations of a point in time for model timestamp columns. */
export type Timestamp = typeof Luxon.DateTime | Date | string;

/** A timestamp value that may be absent. */
export type NullableTimestamp = Timestamp | null;

/**
 * Internal query builder used by `BaseModel`. Extends the soft-deletes
 * builder so every model gets soft-delete-aware querying, and overrides
 * `update()` to snapshot the affected rows *before* the update runs
 * (Objection's own `update()` doesn't return the updated rows by default).
 */
class BunQueryBuilder<M extends Model, R = M[]> extends SoftDeletes<M, R> {
    constructor(modelClass?: ModelClass<M>) {
        super(modelClass as ModelClass<M>);
    }

    /**
     * Updates matching rows, returning the query for the rows that
     * matched before the update applies.
     *
     * @param {PartialModelObject<M>} payload - The partial column values to update.
     * @returns {QueryBuilder<M, R>} The pre-update query builder for the affected rows.
     */
    // @ts-expect-error - BunQueryBuilder's update() intentionally diverges from Objection's chainable QueryBuilder shape for soft-delete semantics.
    async update(payload: PartialModelObject<M>): Promise<QueryBuilder<M, R>> {
        const cloneQuery: QueryBuilder<M, R> = (this as any).clone();

        const beforeRows: any = await cloneQuery;

        if (!beforeRows || beforeRows.length === 0) return beforeRows || undefined;

        await super.update(payload);

        return cloneQuery;
    }
}

/**
 * Base class every Bejibun Objection model extends. Adds automatic
 * `created_at`/`updated_at` timestamp handling, soft-delete-aware query
 * helpers (`withTrashed`, `onlyTrashed`), fluent static query
 * shortcuts (`all`, `create`, `find`, `findOrFail`), and namespace
 * registration for resolving models by name.
 */
export default class BaseModel extends Model {
    /** The registered namespace/identifier this model is resolved under. Set via `setNamespace()`. */
    protected static _namespace: string;

    /** The database table this model maps to. */
    public static tableName: string;

    /** The primary key column name. */
    public static idColumn: string;

    /** The column that stores the creation timestamp. */
    public static createdColumn: string = "created_at";

    /** The column that stores the last-updated timestamp. */
    public static updatedColumn: string = "updated_at";

    /** The column that stores the soft-delete timestamp. */
    public static deletedColumn: string = "deleted_at";

    /** The soft-delete-aware query builder class used for all queries on this model. */
    public static QueryBuilder = BunQueryBuilder as unknown as typeof QueryBuilder;

    // @ts-expect-error - BunQueryBuilder's update() intentionally diverges from Objection's chainable QueryBuilder shape for soft-delete semantics.
    declare QueryBuilderType: BunQueryBuilder<this, this[]>;

    declare id: number | bigint;

    /**
     * The model's registered namespace.
     *
     * @returns {string} The registered namespace.
     * @throws {RuntimeException} If the namespace hasn't been registered via `setNamespace()`.
     */
    public static get namespace(): string {
        if (!this._namespace)
            throw new RuntimeException(`Model namespace not registered for [${this.name}].`);

        return this._namespace;
    }

    /**
     * Objection lifecycle hook: stamps `createdColumn`/`updatedColumn`
     * with the current time before an insert, if those columns already
     * have a value set on the instance.
     */
    $beforeInsert(): void {
        const model = this.constructor as typeof BaseModel;
        const now = Luxon.DateTime.now() as any;

        (this as any)[model.createdColumn] ??= now;
        (this as any)[model.updatedColumn] ??= now;
    }

    /**
     * Objection lifecycle hook: stamps `updatedColumn` with the current
     * time before an update, if that column already has a value set on
     * the instance.
     */
    $beforeUpdate(): void {
        const model = this.constructor as typeof BaseModel;

        (this as any)[model.updatedColumn] ??= Luxon.DateTime.now();
    }

    /**
     * Registers the namespace/identifier this model is resolved under.
     * Typically called once by the framework's namespace loader.
     *
     * @param {string} namespace - The namespace to register.
     */
    public static setNamespace(namespace: string): void {
        this._namespace = namespace;
    }

    /**
     * Starts a new query for this model, using the soft-delete-aware
     * `BunQueryBuilder`.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder.
     */
    public static query<T extends typeof BaseModel>(
        this: T,
        trxOrKnex?: TransactionOrKnex
    ): QueryBuilderType<InstanceType<T>> {
        return super.query(trxOrKnex) as unknown as QueryBuilderType<InstanceType<T>>;
    }

    /**
     * Starts a query that includes soft-deleted rows.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder, including trashed rows.
     */
    public static withTrashed<T extends typeof BaseModel>(
        this: T,
        trxOrKnex?: TransactionOrKnex
    ): QueryBuilderType<InstanceType<T>> {
        return (this as any).query(trxOrKnex).withTrashed();
    }

    /**
     * Starts a query restricted to only soft-deleted rows.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder, restricted to trashed rows.
     */
    public static onlyTrashed<T extends typeof BaseModel>(
        this: T,
        trxOrKnex?: TransactionOrKnex
    ): QueryBuilderType<InstanceType<T>> {
        return (this as any).query(trxOrKnex).onlyTrashed();
    }

    /**
     * Retrieves every row for this model - shorthand for `query().select()`.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to all rows.
     */
    public static all<T extends typeof BaseModel>(
        this: T,
        trxOrKnex?: TransactionOrKnex
    ): QueryBuilderType<InstanceType<T>> {
        return (this as any).query(trxOrKnex).select();
    }

    /**
     * Inserts a new row - shorthand for `query().insert(payload)`.
     *
     * @param {Record<string, any>} payload - The column values to insert.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to the inserted row.
     */
    public static create<T extends typeof BaseModel>(
        this: T,
        payload: Record<string, any>,
        trxOrKnex?: TransactionOrKnex
    ): QueryBuilderType<InstanceType<T>> {
        return (this as any).query(trxOrKnex).insert(payload);
    }

    /**
     * Finds a row by primary key - shorthand for `query().findById(id)`.
     * Resolves to `undefined` if no matching row exists.
     *
     * @param {bigint | number | string} id - The primary key value to look up.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to the matching row, if any.
     */
    public static find<T extends typeof BaseModel>(
        this: T,
        id: bigint | number | string,
        trxOrKnex?: TransactionOrKnex
    ): QueryBuilderType<InstanceType<T>> {
        return (this as any).query(trxOrKnex).findById(id);
    }

    /**
     * Finds a row by primary key, throwing if it doesn't exist.
     *
     * @param {bigint | number | string} id - The primary key value to look up.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {Promise<InstanceType<T>>} The matching row.
     * @throws {ModelNotFoundException} If no row matches the given id.
     */
    public static async findOrFail<T extends typeof BaseModel>(
        this: T,
        id: bigint | number | string,
        trxOrKnex?: TransactionOrKnex
    ): Promise<InstanceType<T>> {
        const result: InstanceType<T> = await (this as any).query(trxOrKnex).findById(id);

        if (!result)
            throw new ModelNotFoundException(
                `No query results for model [${(this as any).namespace}] [${id}].`
            );

        return result;
    }
}
