import { QueryBuilder } from "objection";
import BaseModel from "../bases/BaseModel.js";
import EpochTimestamps from "./EpochTimestamps.js";
/**
 * Built-in model backing the queue's `jobs` table. Uses `EpochTimestamps`
 * for integer-based timestamps, opts out of soft-deletes/update-column
 * bookkeeping (jobs are deleted for real once processed, and don't track
 * an `updated_at`), and falls back to Objection's plain `QueryBuilder`
 * rather than the soft-delete-aware one `BaseModel` normally uses.
 */
export default class JobModel extends EpochTimestamps(BaseModel) {
    /** The database table this model maps to. */
    static tableName = "jobs";
    /** The primary key column name. */
    static idColumn = "id";
    /** Jobs don't track an updated-at column. */
    static updatedColumn = null;
    /** Jobs are hard-deleted, not soft-deleted. */
    static deletedColumn = null;
    /** Plain Objection query builder - jobs don't need soft-delete-aware querying. */
    static QueryBuilder = QueryBuilder;
    /** No-op: jobs have no `updatedColumn` to stamp. */
    $beforeUpdate() {
        // do nothing
    }
}
