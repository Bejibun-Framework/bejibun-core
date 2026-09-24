import Luxon from "@bejibun/utils/facades/Luxon";
import { Model, ModelClass, PartialModelObject, QueryBuilder, QueryBuilderType, TransactionOrKnex } from "objection";
import SoftDeletes from "../facades/SoftDeletes.js";
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
declare class BunQueryBuilder<M extends Model, R = M[]> extends SoftDeletes<M, R> {
    constructor(modelClass?: ModelClass<M>);
    /**
     * Updates matching rows, returning the query for the rows that
     * matched before the update applies.
     *
     * @param {PartialModelObject<M>} payload - The partial column values to update.
     * @returns {QueryBuilder<M, R>} The pre-update query builder for the affected rows.
     */
    update(payload: PartialModelObject<M>): Promise<QueryBuilder<M, R>>;
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
    static tableName: string;
    /** The primary key column name. */
    static idColumn: string;
    /** The column that stores the creation timestamp. */
    static createdColumn: string;
    /** The column that stores the last-updated timestamp. */
    static updatedColumn: string;
    /** The column that stores the soft-delete timestamp. */
    static deletedColumn: string;
    /** The soft-delete-aware query builder class used for all queries on this model. */
    static QueryBuilder: typeof QueryBuilder;
    QueryBuilderType: BunQueryBuilder<this, this[]>;
    id: number | bigint;
    /**
     * The model's registered namespace.
     *
     * @returns {string} The registered namespace.
     * @throws {RuntimeException} If the namespace hasn't been registered via `setNamespace()`.
     */
    static get namespace(): string;
    /**
     * Objection lifecycle hook: stamps `createdColumn`/`updatedColumn`
     * with the current time before an insert, if those columns already
     * have a value set on the instance.
     */
    $beforeInsert(): void;
    /**
     * Objection lifecycle hook: stamps `updatedColumn` with the current
     * time before an update, if that column already has a value set on
     * the instance.
     */
    $beforeUpdate(): void;
    /**
     * Registers the namespace/identifier this model is resolved under.
     * Typically called once by the framework's namespace loader.
     *
     * @param {string} namespace - The namespace to register.
     */
    static setNamespace(namespace: string): void;
    /**
     * Starts a new query for this model, using the soft-delete-aware
     * `BunQueryBuilder`.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder.
     */
    static query<T extends typeof BaseModel>(this: T, trxOrKnex?: TransactionOrKnex): QueryBuilderType<InstanceType<T>>;
    /**
     * Starts a query that includes soft-deleted rows.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder, including trashed rows.
     */
    static withTrashed<T extends typeof BaseModel>(this: T, trxOrKnex?: TransactionOrKnex): QueryBuilderType<InstanceType<T>>;
    /**
     * Starts a query restricted to only soft-deleted rows.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder, restricted to trashed rows.
     */
    static onlyTrashed<T extends typeof BaseModel>(this: T, trxOrKnex?: TransactionOrKnex): QueryBuilderType<InstanceType<T>>;
    /**
     * Retrieves every row for this model - shorthand for `query().select()`.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to all rows.
     */
    static all<T extends typeof BaseModel>(this: T, trxOrKnex?: TransactionOrKnex): QueryBuilderType<InstanceType<T>>;
    /**
     * Inserts a new row - shorthand for `query().insert(payload)`.
     *
     * @param {Record<string, any>} payload - The column values to insert.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to the inserted row.
     */
    static create<T extends typeof BaseModel>(this: T, payload: Record<string, any>, trxOrKnex?: TransactionOrKnex): QueryBuilderType<InstanceType<T>>;
    /**
     * Finds a row by primary key - shorthand for `query().findById(id)`.
     * Resolves to `undefined` if no matching row exists.
     *
     * @param {bigint | number | string} id - The primary key value to look up.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to the matching row, if any.
     */
    static find<T extends typeof BaseModel>(this: T, id: bigint | number | string, trxOrKnex?: TransactionOrKnex): QueryBuilderType<InstanceType<T>>;
    /**
     * Finds a row by primary key, throwing if it doesn't exist.
     *
     * @param {bigint | number | string} id - The primary key value to look up.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {Promise<InstanceType<T>>} The matching row.
     * @throws {ModelNotFoundException} If no row matches the given id.
     */
    static findOrFail<T extends typeof BaseModel>(this: T, id: bigint | number | string, trxOrKnex?: TransactionOrKnex): Promise<InstanceType<T>>;
}
export {};
