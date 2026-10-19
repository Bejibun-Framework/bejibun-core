import Luxon from "@bejibun/utils/facades/Luxon";
import { QueryBuilder } from "objection";
/**
 * Objection `QueryBuilder` subclass adding soft-delete
 * semantics: by default, every query is automatically scoped to exclude
 * rows with a non-null `deletedColumn`, unless `withTrashed()` or
 * `onlyTrashed()` is called. `delete()` becomes a soft delete
 * (stamping `deletedColumn`) while `forceDelete()` performs a real
 * `DELETE`. Serves as the base for `BaseModel`'s `BunQueryBuilder`.
 */
export default class SoftDeletes extends QueryBuilder {
    /** Guards against the soft-delete `WHERE` clause being applied more than once per query build. */
    hasFilterApplied = false;
    /**
     * @param {ModelClass<M>} modelClass - The Objection model class this query builder is bound to.
     */
    constructor(modelClass) {
        super(modelClass);
        // Registers the soft-delete WHERE clause to run once, right before the query executes.
        this.onBuild((builder) => {
            const context = this.context();
            if (!this.hasFilterApplied) {
                const tableName = this.modelClass().tableName;
                if (context.onlyTrashed) {
                    builder.whereNotNull(`${tableName}.${this.modelClass().deletedColumn}`);
                }
                else if (!context.withTrashed) {
                    builder.whereNull(`${tableName}.${this.modelClass().deletedColumn}`);
                }
                this.hasFilterApplied = true;
            }
        });
    }
    /**
     * Includes soft-deleted rows in this query, alongside non-deleted ones.
     *
     * @returns {this} This query builder, for chaining.
     */
    withTrashed() {
        return this.context({
            ...this.context(),
            withTrashed: true
        });
    }
    /**
     * Restricts this query to only soft-deleted rows.
     *
     * @returns {this} This query builder, for chaining.
     */
    onlyTrashed() {
        return this.context({
            ...this.context(),
            onlyTrashed: true
        });
    }
    /**
     * Soft-deletes matching rows by stamping `deletedColumn` with the
     * current timestamp, rather than removing them from the table.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    delete() {
        return this.update({
            [this.modelClass().deletedColumn]: Luxon.DateTime.now()
        });
    }
    /**
     * Alias for `delete()`, mirroring Objection's own `del()` shorthand.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    del() {
        return this.delete();
    }
    /**
     * Permanently removes matching rows from the table (a real SQL
     * `DELETE`, bypassing the soft-delete behavior).
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    forceDelete() {
        return super.delete();
    }
    /**
     * Restores soft-deleted rows by clearing `deletedColumn` back to `null`.
     * Only affects rows found via `onlyTrashed()`.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    restore() {
        return this.onlyTrashed().update({
            [this.modelClass().deletedColumn]: null
        });
    }
}
