/**
 * Console command: `Start processing jobs on the queue as a daemon`
 *
 * Registered under the `ace` CLI as `QueueWorkCommand`. See `$signature`,
 * `$options`, and `$arguments` below for its CLI shape.
 */
export default class QueueWorkCommand {
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
     * Runs as a long-lived daemon: loads the queue config
     * (falling back to the package default if the app hasn't published its own), then loops indefinitely,
     * claiming the oldest eligible job
     * (attempts < 3, and either never reserved or whose reservation is older than `retry_after` seconds --
     * i.e. presumed abandoned by a crashed worker) via `JobModel.claim()` -- a portable,
     * optimistic-locking claim that works unmodified against any database Knex/Objection
     * support (Postgres, MySQL, SQLite, MSSQL, ...), running its handler, and deleting it on
     * success or incrementing `attempts` and releasing the reservation on failure.
     *
     * The claim is intentionally a plain, momentary `UPDATE ... WHERE` rather than a
     * transaction (or a database-specific row lock) held open for the whole job: the database
     * only needs to serialize that one write, so `reserved_at` -- kept fresh by a heartbeat
     * while the handler runs -- is what actually protects an in-flight job from being
     * reclaimed, not a held lock. This matters behind a transaction-mode connection pooler:
     * those poolers are built for
     * many short transactions, not for one held open across an arbitrarily long job, and can
     * cut a long-lived transaction (or route it oddly) well before the job finishes -- silently
     * releasing any row lock it held and letting another worker claim the exact same row while
     * the first one is still mid-`handle()`. A time-based reservation plus a hard `--timeout`
     * watchdog has no such assumption baked in; it works the same whether the connection goes
     * straight to the database or through any pooler in front of it, and the same whether that
     * database is Postgres, MySQL, SQLite, or anything else Knex speaks.
     *
     * Idles for `poll_interval` seconds when nothing is claimable and waits `retry_delay` seconds
     * before retrying after a failed attempt - three independent knobs,
     * separate from the reservation timeout.
     * An external watchdog process (see `--timeout`) SIGTERMs then SIGKILLs a worker whose job overruns the timeout,
     * so a wedged job can never outlive `retry_after` and end up processed twice.
     * Listens for `exit`/`SIGINT`/`SIGTERM` to stop the loop gracefully after the current iteration.
     * A stop signal resolves the interruptible sleep immediately,
     * so a long `retry_after` never delays shutdown -- the worker finishes the in-flight job (if any) and exits.
     *
     * @param {any} [options] - Parsed CLI options; supports `--timeout` (seconds).
     * @returns {Promise<void>}
     */
    handle(options?: any): Promise<void>;
}
