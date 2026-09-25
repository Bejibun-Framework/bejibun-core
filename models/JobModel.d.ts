import { QueryBuilder } from "objection";
declare const JobModel_base: any;
/**
 * Built-in model backing the queue's `jobs` table. Uses `EpochTimestamps`
 * for integer-based timestamps, opts out of soft-deletes/update-column
 * bookkeeping (jobs are deleted for real once processed, and don't track
 * an `updated_at`), and falls back to Objection's plain `QueryBuilder`
 * rather than the soft-delete-aware one `BaseModel` normally uses.
 */
export default class JobModel extends JobModel_base {
    /** The database table this model maps to. */
    static tableName: string;
    /** The primary key column name. */
    static idColumn: string;
    /** Jobs don't track an updated-at column. */
    static updatedColumn: null;
    /** Jobs are hard-deleted, not soft-deleted. */
    static deletedColumn: null;
    /** Plain Objection query builder - jobs don't need soft-delete-aware querying. */
    static QueryBuilder: typeof QueryBuilder;
    /** No-op: jobs have no `updatedColumn` to stamp. */
    $beforeUpdate(): void;
    id: bigint;
    queue: string;
    payload: string;
    attempts: bigint;
    reserved_at: bigint | null;
    available_at: bigint;
    created_at: bigint;
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
    static claim(criteria: (builder: any) => any, claimedAt: number, retries?: number): Promise<JobModel | undefined>;
}
export {};
