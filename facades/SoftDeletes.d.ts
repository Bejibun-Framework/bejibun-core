import { QueryBuilder, ModelClass, Model } from "objection";
/**
 * Objection `QueryBuilder` subclass adding soft-delete
 * semantics: by default, every query is automatically scoped to exclude
 * rows with a non-null `deletedColumn`, unless `withTrashed()` or
 * `onlyTrashed()` is called. `delete()` becomes a soft delete
 * (stamping `deletedColumn`) while `forceDelete()` performs a real
 * `DELETE`. Setting `deletedColumn` to null disables filtering and makes
 * `delete()` perform a real delete. Serves as the base for `BaseModel`'s
 * `BunQueryBuilder`.
 */
export default class SoftDeletes<M extends Model, R = M[]> extends QueryBuilder<M, R> {
    /** Guards against the soft-delete `WHERE` clause being applied more than once per query build. */
    private hasFilterApplied;
    /**
     * @param {ModelClass<M>} modelClass - The Objection model class this query builder is bound to.
     */
    constructor(modelClass: ModelClass<M>);
    /**
     * Includes soft-deleted rows in this query, alongside non-deleted ones.
     *
     * @returns {this} This query builder, for chaining.
     */
    withTrashed(): this;
    /**
     * Restricts this query to only soft-deleted rows.
     *
     * @returns {this} This query builder, for chaining.
     */
    onlyTrashed(): this;
    /**
     * Soft-deletes matching rows by stamping `deletedColumn` with the
     * current timestamp, rather than removing them from the table.
     * Performs a real delete when `deletedColumn` is null.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    delete(): QueryBuilder<M, number>;
    /**
     * Alias for `delete()`, mirroring Objection's own `del()` shorthand.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    del(): QueryBuilder<M, number>;
    /**
     * Permanently removes matching rows from the table (a real SQL
     * `DELETE`, bypassing the soft-delete behavior).
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    forceDelete(): QueryBuilder<M, number>;
    /**
     * Restores soft-deleted rows by clearing `deletedColumn` back to `null`.
     * Only affects rows found via `onlyTrashed()`. Resolves to zero without
     * updating rows when `deletedColumn` is null.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    restore(): QueryBuilder<M, number>;
}
