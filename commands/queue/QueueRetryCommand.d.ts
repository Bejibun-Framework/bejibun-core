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
     * Loops through failed jobs (attempts >= 3 and unreserved), re-claims
     * each one via `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction
     * and re-runs it, deleting on success or bumping `attempts` on failure --
     * the row lock guarantees one retry worker at a time. Stops when no
     * eligible jobs remain or when a stop signal (`SIGINT`/`SIGTERM`/`exit`)
     * arrives after the in-flight job, mirroring the `queue:work` shutdown
     * contract.
     *
     * @returns {Promise<void>}
     */
    handle(): Promise<void>;
}
