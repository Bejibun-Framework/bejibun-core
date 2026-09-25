/**
 * Console command: `Retry a failed queue job`
 *
 * Registered under the `ace` CLI as `QueueRetryCommand`. See `$signature`,
 * `$options`, and `$arguments` below for its CLI shape.
 */
export default class QueueRetryCommand {
    /**
     * The name and signature of the console command.
     *
     * @var $signature string
     */
    protected $signature: string;
    /**
     * The console command description.
     *
     * @var $description string
     */
    protected $description: string;
    /**
     * The options or optional flag of the console command.
     *
     * @var $options Array<Array<any>>
     */
    protected $options: Array<Array<any>>;
    /**
     * The arguments of the console command.
     *
     * @var $arguments Array<Array<string>>
     */
    protected $arguments: Array<Array<string>>;
    /**
     * Executes this command.
     *
     * Loops through failed jobs (attempts >= 3 and unreserved), re-claims each one via
     * `JobModel.claim()` -- a portable, optimistic-locking claim that works unmodified
     * against any database Knex/Objection support -- and re-runs it, deleting on success or
     * bumping `attempts` on failure. The claim is a momentary `UPDATE ... WHERE`, not a
     * transaction (or a database-specific row lock) held open for the whole retry --
     * `reserved_at` is what actually keeps two concurrent `queue:retry` runs from picking up
     * the same row, which is what makes this safe behind a transaction-mode connection
     * pooler that wouldn't tolerate a transaction held open across
     * an arbitrarily long job. See `QueueWorkCommand`/`JobModel.claim()` for why this needs
     * no `FOR UPDATE`/`SKIP LOCKED`/`RETURNING`. Stops when no eligible jobs remain or when a
     * stop signal (`SIGINT`/`SIGTERM`/`exit`) arrives after the in-flight job, mirroring the
     * `queue:work` shutdown contract.
     *
     * @returns {Promise<void>}
     */
    handle(): Promise<void>;
}
