import Luxon from "@bejibun/utils/facades/Luxon";
import {QueryBuilder, ModelClass, QueryContext, Model} from "objection";

/** Query context flags controlling whether soft-deleted rows are included/exclusively targeted. */
interface SoftDeleteQueryContext extends QueryContext {
    /** When true, the query includes both trashed and non-trashed rows. */
    withTrashed?: boolean;
    /** When true, the query is restricted to only trashed rows. */
    onlyTrashed?: boolean;
}

/**
 * Objection `QueryBuilder` subclass adding soft-delete
 * semantics: by default, every query is automatically scoped to exclude
 * rows with a non-null `deletedColumn`, unless `withTrashed()` or
 * `onlyTrashed()` is called. `delete()` becomes a soft delete
 * (stamping `deletedColumn`) while `forceDelete()` performs a real
 * `DELETE`. Serves as the base for `BaseModel`'s `BunQueryBuilder`.
 */
export default class SoftDeletes<M extends Model, R = M[]> extends QueryBuilder<M, R> {
    /** Guards against the soft-delete `WHERE` clause being applied more than once per query build. */
    private hasFilterApplied = false;

    /**
     * @param {ModelClass<M>} modelClass - The Objection model class this query builder is bound to.
     */
    constructor(modelClass: ModelClass<M>) {
        super(modelClass);

        // Registers the soft-delete WHERE clause to run once, right before the query executes.
        (this as any).onBuild((builder: QueryBuilder<M, R>): void => {
            const context = (this as any).context() as SoftDeleteQueryContext;

            if (!this.hasFilterApplied) {
                const tableName = (this as any).modelClass().tableName;

                if (context.onlyTrashed) {
                    builder.whereNotNull(
                        `${tableName}.${((this as any).modelClass() as any).deletedColumn}`
                    );
                } else if (!context.withTrashed) {
                    builder.whereNull(
                        `${tableName}.${((this as any).modelClass() as any).deletedColumn}`
                    );
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
    withTrashed(): this {
        return (this as any).context({
            ...(this as any).context(),
            withTrashed: true
        });
    }

    /**
     * Restricts this query to only soft-deleted rows.
     *
     * @returns {this} This query builder, for chaining.
     */
    onlyTrashed(): this {
        return (this as any).context({
            ...(this as any).context(),
            onlyTrashed: true
        });
    }

    /**
     * Soft-deletes matching rows by stamping `deletedColumn` with the
     * current timestamp, rather than removing them from the table.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    delete(): QueryBuilder<M, number> {
        return (this as any).update({
            [((this as any).modelClass() as any).deletedColumn]: Luxon.DateTime.now()
        } as any);
    }

    /**
     * Alias for `delete()`, mirroring Objection's own `del()` shorthand.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    del(): QueryBuilder<M, number> {
        return this.delete();
    }

    /**
     * Permanently removes matching rows from the table (a real SQL
     * `DELETE`, bypassing the soft-delete behavior).
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    forceDelete(): QueryBuilder<M, number> {
        return super.delete();
    }

    /**
     * Restores soft-deleted rows by clearing `deletedColumn` back to `null`.
     * Only affects rows found via `onlyTrashed()`.
     *
     * @returns {QueryBuilder<M, number>} The query builder resolving to the number of affected rows.
     */
    restore(): QueryBuilder<M, number> {
        return this.onlyTrashed().update({
            [((this as any).modelClass() as any).deletedColumn]: null
        } as any);
    }
}
