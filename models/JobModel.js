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
    /**
     * Atomically claims one eligible job, without relying on any
     * database-engine-specific row-locking syntax (Postgres's
     * `SELECT ... FOR UPDATE SKIP LOCKED` / `RETURNING`, MySQL's own locking
     * clauses, etc.), so the exact same code runs unmodified against every
     * database Knex/Objection support -- Postgres, MySQL, SQLite, MSSQL, and
     * so on.
     *
     * Uses optimistic (compare-and-swap) locking instead of a held row lock:
     * it reads the oldest eligible candidate's `id` and its *current*
     * `reserved_at`, then issues a conditional
     * `UPDATE ... WHERE id = ? AND reserved_at = ?` (or `IS NULL`) that only
     * succeeds if nothing else has claimed the row since it was read. At most
     * one concurrent caller's `UPDATE` can match, because every database
     * serializes writes to the same row: whichever `UPDATE` commits first
     * changes `reserved_at`, so every other `UPDATE` -- still checking the
     * *old* value -- stops matching and affects zero rows. This needs
     * nothing beyond a plain, portable `UPDATE ... WHERE`, so it needs no
     * `FOR UPDATE`, no `SKIP LOCKED`, and no `RETURNING`, all of which vary
     * or are unsupported across database engines.
     *
     * On a lost race (another caller claimed the same candidate first) this
     * retries -- re-reading whichever row is now the oldest eligible one --
     * up to `retries` times before giving up, so contention between workers
     * doesn't have to wait out a full poll interval to try a different job.
     *
     * @param {(builder: any) => any} criteria - Narrows the query to eligible rows; applied both when picking a candidate and when attempting to claim it, so it must compose with `.where()` regardless of which columns are selected.
     * @param {number} claimedAt - Unix timestamp to stamp on `reserved_at` once claimed.
     * @param {number} [retries] - Max attempts to make before giving up on contention (default: 5).
     * @returns {Promise<JobModel | undefined>} The claimed job, or `undefined` if nothing is eligible or every attempt lost the race.
     */
    static async claim(criteria, claimedAt, retries = 5) {
        for (let i = 0; i < retries; i++) {
            const candidate = await criteria(JobModel.query().select("id", "reserved_at"))
                .orderBy("id", "asc")
                .limit(1)
                .first();
            if (!candidate)
                return undefined;
            const attempt = criteria(JobModel.query().where("id", candidate.id));
            if (candidate.reserved_at === null || candidate.reserved_at === undefined) {
                attempt.whereNull("reserved_at");
            }
            else {
                attempt.where("reserved_at", candidate.reserved_at);
            }
            const claimedCount = await attempt.patch({ reserved_at: claimedAt });
            if (claimedCount === 1)
                return JobModel.query().findById(candidate.id);
            // Lost the race -- candidate's reserved_at just changed under us.
            // Loop and re-read whichever row is now the oldest eligible one.
        }
        return undefined;
    }
}
