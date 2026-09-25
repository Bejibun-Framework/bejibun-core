import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import Luxon from "@bejibun/utils/facades/Luxon";
import QueueException from "@/exceptions/QueueException";
import RuntimeException from "@/exceptions/RuntimeException";
import JobModel from "@/models/JobModel";

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
    protected $signature: string = "queue:work";

    /**
     * The console command description.
     *
     * @var $description string
     */
    protected $description: string = "Start processing jobs on the queue as a daemon";

    /**
     * The options or optional flag of the console command.
     *
     * @var $options Array<Array<any>>
     */
    protected $options: Array<Array<any>> = [
        [
            "--timeout <seconds>",
            "Seconds after which an in-flight job force-kills the worker via an external watchdog process (SIGTERM, then SIGKILL after a 2s grace; default: retry_after).",
            (value: string): number => parseInt(value, 10)
        ]
    ];

    /**
     * The arguments of the console command.
     *
     * @var $arguments Array<Array<string>>
     */
    protected $arguments: Array<Array<string>> = [];

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
    public async handle(options?: any): Promise<void> {
        let config: any;

        try {
            config = require(App.Path.configPath("queue.ts")).default;
        } catch {
            config = require("@/config/queue").default;
        }

        if (!config) throw new QueueException("There is no config provided.");

        const currentConnection: Record<string, any> = config.connections[config.default];

        // Independent tuning knobs: reservation timeout vs. idle poll vs. retry backoff.
        const retryAfter: number = Number(currentConnection?.retry_after) || 60;
        const pollInterval: number = Number(currentConnection?.poll_interval) || retryAfter;
        const retryDelay: number = Number(currentConnection?.retry_delay) || retryAfter;

        /**
         * `--timeout`: if a job overruns this, the worker is killed by an external
         * watchdog process (TERM first, SIGKILL after a grace) so it can never double-run the job
         * after being reclaimed by another worker. Defaults to `retry_after`.
         */
        const timeoutSec: number = Number(options?.timeout) || retryAfter;

        let running: boolean = true;
        let resolveStop: (() => void) | null = null;

        const stopped: Promise<void> = new Promise((resolve) => {
            resolveStop = resolve;
        });

        const sleepTimers: Array<ReturnType<typeof setTimeout>> = [];

        /**
         * Sleeps for `ms`, cancelled the moment a stop signal arrives.
         * A plain `Bun.sleep` keeps its event-loop timer alive even after the
         * race resolves, so this uses a clearable `setTimeout` instead --
         * a long `retry_after` never delays shutdown.
         */
        const interruptibleSleep = (ms: number): Promise<void> => {
            return new Promise((resolve) => {
                const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
                    const index = sleepTimers.indexOf(timer);

                    if (index !== -1) sleepTimers.splice(index, 1);

                    resolve();
                }, ms);

                sleepTimers.push(timer);

                void stopped.then(() => {
                    const index = sleepTimers.indexOf(timer);

                    if (index !== -1) sleepTimers.splice(index, 1);

                    clearTimeout(timer);

                    resolve();
                });
            });
        };

        const stop = (signal: string): void => {
            running = false;
            resolveStop?.();

            for (const timer of sleepTimers) clearTimeout(timer);

            sleepTimers.length = 0;

            Logger.setContext("Queue").info(`Stopping queue worker, ${signal} sent.`);
        };

        process.on("exit", (): void => stop("exit"));
        process.on("SIGINT", (): void => stop("SIGINT"));
        process.on("SIGTERM", (): void => stop("SIGTERM"));

        /**
         * Watchdog: a separate Bun process (so it keeps running even if this worker's event loop is
         * hard-blocked by a synchronous job) that SIGTERMs the worker once `timeoutSec` elapses and
         * SIGKILLs it two seconds later. SIGKILL is uncatchable and kernel-delivered, so it terminates
         * the worker even mid-busy-loop -- exactly what kills a stalled-then-resumed zombie before it
         * can double-execute a job another worker has reclaimed.
         * Spawning the same runtime instead of a shell keeps it cross-platform
         * (no `bash`/`kill` on Windows -- Bun's `process.kill` maps the signals on every supported platform).
         */
        type Watchdog = ReturnType<typeof Bun.spawn>;

        const WATCHDOG_SCRIPT: string = `
            const pid: number = Number(process.env.WATCHDOG_PID);
            const ms: number = Number(process.env.WATCHDOG_MS);

            setTimeout(() => {
                try {
                    process.kill(pid, "SIGTERM");
                } catch {}

                setTimeout(() => {
                    try {
                        process.kill(pid, "SIGKILL");
                    } catch {}
                }, 2000);
            }, ms);
        `;

        const spawnWatchdog = (pid: number, ms: number): Watchdog =>
            Bun.spawn([process.execPath, "-e", WATCHDOG_SCRIPT], {
                stdout: "ignore",
                stderr: "ignore",
                stdin: "ignore",
                env: {
                    ...process.env,
                    WATCHDOG_PID: String(pid),
                    WATCHDOG_MS: String(ms)
                }
            });

        const killWatchdog = (watchdog: Watchdog | null): void => {
            if (!watchdog) return;

            try {
                watchdog.kill("SIGKILL");
            } catch {
                // Already exited; nothing to do.
            }
        };

        Logger.setContext("Queue").info("Queue worker started.");

        while (running) {
            /**
             * Claim and process each job inside ONE transaction.
             * The claim is `SELECT ... FOR UPDATE SKIP LOCKED`: Postgres locks exactly one eligible row under
             * this worker's transaction and every other worker SKIPs all locked rows,
             * so a job is handed to exactly one worker at a time -- broker-style delivery, with
             * the database itself enforcing "1 worker, 1 job".
             * The lock is held for the whole `handle()` run, and released only by this worker's
             * terminal write (COMMIT), a rollback, or a crash (Postgres frees row locks when the backend session ends).
             * `reserved_at` is still stamped and heartbeated as the crash-recovery marker:
             * after a crash, the stale filter makes the orphaned row claimable again only once
             * `retry_after` has passed, and the heartbeat keeps a still-alive worker's job from being reclaimed
             * even if its transaction was dropped out from under it (connection timeout).
             */
            const outcome: "idle" | "ok" | "failed" = await JobModel.transaction(
                async (trx: any): Promise<"idle" | "ok" | "failed"> => {
                    const claimNow: number = Luxon.DateTime.now().toUnixInteger();
                    const staleBefore: number = claimNow - retryAfter;

                    /**
                     * Claim via row lock: `SKIP LOCKED` skips rows locked by other
                     * workers' in-flight transactions -- the "already taken" signal.
                     */
                    const job: any = await JobModel.query(trx)
                        .where("attempts", "<", 3)
                        .where("available_at", "<=", claimNow)
                        .where((builder: any) =>
                            builder
                                .whereNull("reserved_at")
                                .orWhere("reserved_at", "<", staleBefore)
                        )
                        .orderBy("id", "asc")
                        .forUpdate()
                        .skipLocked()
                        .first();

                    if (!job?.id) return "idle";

                    /**
                     * Stamp the reservation so crash recovery has a marker;
                     * the lock itself is what excludes other workers while we process.
                     */
                    await JobModel.query(trx).findById(job.id).patch({
                        reserved_at: claimNow
                    });

                    /**
                     * Heartbeat while the handler runs: refresh `reserved_at` every half of `retry_after`
                     * so a long-running job is never reclaimed by another worker
                     * if its transaction gets dropped while alive.
                     */
                    const beatInterval: number = Math.max(
                        1000,
                        Math.floor((retryAfter * 1000) / 2)
                    );

                    let heartbeat: ReturnType<typeof setInterval> | null = null;

                    const startHeartbeat = (): void => {
                        if (heartbeat) return;

                        heartbeat = setInterval(() => {
                            void JobModel.query()
                                .where("id", job.id)
                                .patch({
                                    reserved_at: Luxon.DateTime.now().toUnixInteger()
                                })
                                .catch(() => null);
                        }, beatInterval);

                        if (heartbeat.unref) heartbeat.unref();
                    };

                    const stopHeartbeat = (): void => {
                        if (heartbeat) {
                            clearInterval(heartbeat);
                            heartbeat = null;
                        }
                    };

                    // Dynamically resolves and invokes the job class's `handle()` with its stored payload.
                    const handler: any = async () => {
                        const module = await import(App.Path.rootPath(job.queue));

                        const Class = module.default;
                        if (!Class)
                            throw new RuntimeException(`Job class not found [${job.queue}].`);

                        const instance = new Class();

                        if (typeof instance.handle !== "function")
                            throw new RuntimeException(
                                `Job class has no handle function in [${job.queue}].`
                            );

                        await instance.handle(Bun.JSON5.parse(job.payload));
                    };

                    /**
                     * Kill the worker (via watchdog) if this job overruns `timeoutSec`
                     * (SIGTERM, then SIGKILL after a 2s grace): a wedged worker is freed by the OS,
                     * and Postgres releases its row lock with the dead session,
                     * leaving the orphan reclaimable after `retry_after`.
                     */
                    const watchdog: Watchdog | null = spawnWatchdog(process.pid, timeoutSec * 1000);

                    try {
                        startHeartbeat();

                        await handler();

                        /**
                         * Stop beating FIRST so no heartbeat can re-stamp the reservation
                         * after the terminal write, then hard-delete inside the same tx.
                         */
                        stopHeartbeat();

                        await JobModel.query(trx).findById(job.id).delete();

                        return "ok";
                    } catch {
                        /**
                         * Stop beating, then bump the attempt count atomically and release
                         * the reservation so the job can be retried (or dead-lettered once attempts hits 3).
                         * All inside the same tx.
                         */
                        stopHeartbeat();

                        await JobModel.query(trx)
                            .findById(job.id)
                            .increment("attempts", 1)
                            .patch({reserved_at: null});

                        return "failed";
                    } finally {
                        stopHeartbeat();

                        killWatchdog(watchdog);
                    }
                }
            );

            if (outcome === "idle") await interruptibleSleep(pollInterval * 1000);
            else if (outcome === "failed") await interruptibleSleep(retryDelay * 1000);
        }
    }
}
