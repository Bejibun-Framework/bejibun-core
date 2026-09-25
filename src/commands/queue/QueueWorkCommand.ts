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
         * after being reclaimed by another worker. Defaults to `retry_after`, and is clamped to
         * never exceed it -- a `--timeout` larger than `retry_after` would let a job's
         * reservation go stale and get reclaimed by another worker while this one is still
         * mid-handle, which is exactly the double-execution failure mode this whole mechanism
         * exists to prevent, so this is enforced rather than just documented.
         */
        const requestedTimeout: number = Number(options?.timeout) || retryAfter;
        const timeoutSec: number = Math.min(requestedTimeout, retryAfter);

        if (requestedTimeout > retryAfter) {
            Logger.setContext("Queue").warn(
                `--timeout (${requestedTimeout}s) exceeds retry_after (${retryAfter}s); clamping to ${timeoutSec}s to prevent double-execution.`
            );
        }

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

        const WatchdogScript: string = `
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
            Bun.spawn([process.execPath, "-e", WatchdogScript], {
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
            const claimNow: number = Luxon.DateTime.now().toUnixInteger();
            const staleBefore: number = claimNow - retryAfter;

            /**
             * Portable, database-agnostic claim (see `JobModel.claim()`): no `FOR UPDATE`,
             * no `SKIP LOCKED`, no `RETURNING` -- just a compare-and-swap `UPDATE ... WHERE`
             * that only one concurrent worker's write can match.
             */
            const job: any = await JobModel.claim(
                (builder: any) =>
                    builder
                        .where("attempts", "<", 3)
                        .where("available_at", "<=", claimNow)
                        .where((sub: any) =>
                            sub.whereNull("reserved_at").orWhere("reserved_at", "<", staleBefore)
                        ),
                claimNow
            );

            if (!job?.id) {
                await interruptibleSleep(pollInterval * 1000);

                continue;
            }

            /**
             * Heartbeat while the handler runs: refresh `reserved_at` every half of
             * `retry_after` so a long-running job is never reclaimed by another worker.
             * This is now the PRIMARY exclusivity mechanism during processing (the claim's
             * row lock is long gone by the time we get here), which is exactly why
             * `--timeout` below must stay <= `retry_after`.
             */
            const beatInterval: number = Math.max(1000, Math.floor((retryAfter * 1000) / 2));

            let heartbeat: ReturnType<typeof setInterval> | null = null;

            /**
             * Guards against overlapping heartbeat writes piling up if the database is slow
             * to respond to one tick before the next is due.
             */
            let beatInFlight: boolean = false;

            /**
             * Consecutive heartbeat failures. Logged loudly (not just swallowed) because a
             * silently-failing heartbeat is exactly how a job that's still running loses its
             * reservation and gets double-claimed by another worker -- this is the most likely
             * real-world cause of that failure mode (e.g. a connection dropped or recycled by
             * a transaction-mode connection pooler mid-job), so it needs to be visible.
             */
            let beatFailures: number = 0;

            const startHeartbeat = (): void => {
                if (heartbeat) return;

                heartbeat = setInterval(() => {
                    if (beatInFlight) return;

                    beatInFlight = true;

                    JobModel.query()
                        .where("id", job.id)
                        .patch({
                            reserved_at: Luxon.DateTime.now().toUnixInteger()
                        })
                        .then((): void => {
                            beatInFlight = false;
                            beatFailures = 0;
                        })
                        .catch((error: any): void => {
                            beatInFlight = false;
                            beatFailures++;

                            Logger.setContext("Queue").error(
                                `Heartbeat failed for job [${job.id}] (${beatFailures}x in a row) -- ` +
                                    `its reservation may go stale and be reclaimed by another worker ` +
                                    `while this one is still running it: ${error?.message ?? error}`
                            );
                        });
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
                if (!Class) throw new RuntimeException(`Job class not found [${job.queue}].`);

                const instance = new Class();

                if (typeof instance.handle !== "function")
                    throw new RuntimeException(
                        `Job class has no handle function in [${job.queue}].`
                    );

                await instance.handle(Bun.JSON5.parse(job.payload));
            };

            /**
             * Kill the worker (via watchdog) if this job overruns `timeoutSec`
             * (SIGTERM, then SIGKILL after a 2s grace): a wedged worker is freed by the OS
             * before `retry_after` makes its job reclaimable by anyone else.
             */
            const watchdog: Watchdog | null = spawnWatchdog(process.pid, timeoutSec * 1000);

            let outcome: "ok" | "failed";

            try {
                startHeartbeat();

                await handler();

                /**
                 * Stop beating FIRST so no heartbeat can re-stamp the reservation
                 * after the terminal write, then hard-delete.
                 */
                stopHeartbeat();

                await JobModel.query().findById(job.id).delete();

                outcome = "ok";
            } catch {
                /**
                 * Stop beating, then bump the attempt count and release the reservation
                 * so the job can be retried (or dead-lettered once attempts hits 3).
                 * Two separate statements -- Objection rejects chaining `.increment()`
                 * (itself a `.patch()` call) with another `.patch()` on the same builder.
                 */
                stopHeartbeat();

                await JobModel.query().findById(job.id).increment("attempts", 1);
                await JobModel.query().findById(job.id).patch({reserved_at: null});

                outcome = "failed";
            } finally {
                stopHeartbeat();

                killWatchdog(watchdog);
            }

            if (outcome === "failed") await interruptibleSleep(retryDelay * 1000);
        }
    }
}
