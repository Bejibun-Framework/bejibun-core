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
     * i.e. presumed abandoned by a crashed worker) via `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction,
     * running its handler (holding the row lock until success, failure, or crash --
     * Postgres SKIPs locked rows for every other worker, so one job is delivered to exactly one worker),
     * and deleting it on success or incrementing `attempts` and releasing the reservation on failure,
     * all within the same transaction.
     * Idles for `poll_interval` seconds when nothing is claimable and waits `retry_delay` seconds
     * before retrying after a failed attempt - three independent knobs,
     * separate from the reservation timeout.
     * An external watchdog process (see `--timeout`) SIGTERMs then SIGKILLs a worker whose job overruns the timeout,
     * freeing its lock for crash-style recovery.
     * Listens for `exit`/`SIGINT`/`SIGTERM` to stop the loop gracefully after the current iteration.
     * A stop signal resolves the interruptible sleep immediately,
     * so a long `retry_after` never delays shutdown -- the worker finishes the in-flight job (if any) and exits.
     *
     * @param {any} [options] - Parsed CLI options; supports `--timeout` (seconds).
     * @returns {Promise<void>}
     */
    handle(options?: any): Promise<void>;
}
