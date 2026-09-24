import Luxon from "@bejibun/utils/facades/Luxon";
import { Model } from "objection";
import ModelNotFoundException from "../exceptions/ModelNotFoundException.js";
import SoftDeletes from "../facades/SoftDeletes.js";
import RuntimeException from "../exceptions/RuntimeException.js";
/**
 * Internal query builder used by `BaseModel`. Extends the soft-deletes
 * builder so every model gets soft-delete-aware querying, and overrides
 * `update()` to snapshot the affected rows *before* the update runs
 * (Objection's own `update()` doesn't return the updated rows by default).
 */
class BunQueryBuilder extends SoftDeletes {
    constructor(modelClass) {
        super(modelClass);
    }
    /**
     * Updates matching rows, returning the query for the rows that
     * matched before the update applies.
     *
     * @param {PartialModelObject<M>} payload - The partial column values to update.
     * @returns {QueryBuilder<M, R>} The pre-update query builder for the affected rows.
     */
    // @ts-expect-error - BunQueryBuilder's update() intentionally diverges from Objection's chainable QueryBuilder shape for soft-delete semantics.
    async update(payload) {
        const cloneQuery = this.clone();
        const beforeRows = await cloneQuery;
        if (!beforeRows || beforeRows.length === 0)
            return beforeRows || undefined;
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
    static _namespace;
    /** The database table this model maps to. */
    static tableName;
    /** The primary key column name. */
    static idColumn;
    /** The column that stores the creation timestamp. */
    static createdColumn = "created_at";
    /** The column that stores the last-updated timestamp. */
    static updatedColumn = "updated_at";
    /** The column that stores the soft-delete timestamp. */
    static deletedColumn = "deleted_at";
    /** The soft-delete-aware query builder class used for all queries on this model. */
    static QueryBuilder = BunQueryBuilder;
    /**
     * The model's registered namespace.
     *
     * @returns {string} The registered namespace.
     * @throws {RuntimeException} If the namespace hasn't been registered via `setNamespace()`.
     */
    static get namespace() {
        if (!this._namespace)
            throw new RuntimeException(`Model namespace not registered for [${this.name}].`);
        return this._namespace;
    }
    /**
     * Objection lifecycle hook: stamps `createdColumn`/`updatedColumn`
     * with the current time before an insert, if those columns already
     * have a value set on the instance.
     */
    $beforeInsert() {
        const now = Luxon.DateTime.now();
        if (this[this.constructor.createdColumn]) {
            this[this.constructor.createdColumn] = now;
        }
        if (this[this.constructor.updatedColumn]) {
            this[this.constructor.updatedColumn] = now;
        }
    }
    /**
     * Objection lifecycle hook: stamps `updatedColumn` with the current
     * time before an update, if that column already has a value set on
     * the instance.
     */
    $beforeUpdate() {
        if (this[this.constructor.updatedColumn]) {
            this[this.constructor.updatedColumn] = Luxon.DateTime.now();
        }
    }
    /**
     * Registers the namespace/identifier this model is resolved under.
     * Typically called once by the framework's namespace loader.
     *
     * @param {string} namespace - The namespace to register.
     */
    static setNamespace(namespace) {
        this._namespace = namespace;
    }
    /**
     * Starts a new query for this model, using the soft-delete-aware
     * `BunQueryBuilder`.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder.
     */
    static query(trxOrKnex) {
        return super.query(trxOrKnex);
    }
    /**
     * Starts a query that includes soft-deleted rows.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder, including trashed rows.
     */
    static withTrashed(trxOrKnex) {
        return this.query(trxOrKnex).withTrashed();
    }
    /**
     * Starts a query restricted to only soft-deleted rows.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder, restricted to trashed rows.
     */
    static onlyTrashed(trxOrKnex) {
        return this.query(trxOrKnex).onlyTrashed();
    }
    /**
     * Retrieves every row for this model - shorthand for `query().select()`.
     *
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to all rows.
     */
    static all(trxOrKnex) {
        return this.query(trxOrKnex).select();
    }
    /**
     * Inserts a new row - shorthand for `query().insert(payload)`.
     *
     * @param {Record<string, any>} payload - The column values to insert.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to the inserted row.
     */
    static create(payload, trxOrKnex) {
        return this.query(trxOrKnex).insert(payload);
    }
    /**
     * Finds a row by primary key - shorthand for `query().findById(id)`.
     * Resolves to `undefined` if no matching row exists.
     *
     * @param {bigint | number | string} id - The primary key value to look up.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {QueryBuilderType<InstanceType<T>>} The query builder resolving to the matching row, if any.
     */
    static find(id, trxOrKnex) {
        return this.query(trxOrKnex).findById(id);
    }
    /**
     * Finds a row by primary key, throwing if it doesn't exist.
     *
     * @param {bigint | number | string} id - The primary key value to look up.
     * @param {TransactionOrKnex} [trxOrKnex] - Optional transaction or Knex instance to run the query on.
     * @returns {Promise<InstanceType<T>>} The matching row.
     * @throws {ModelNotFoundException} If no row matches the given id.
     */
    static async findOrFail(id, trxOrKnex) {
        const result = await this.query(trxOrKnex).findById(id);
        if (!result)
            throw new ModelNotFoundException(`No query results for model [${this.namespace}] [${id}].`);
        return result;
    }
}
