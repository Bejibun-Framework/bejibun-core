import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import Luxon from "@bejibun/utils/facades/Luxon";
import QueueConfig from "../../config/queue.js";
import QueueException from "../../exceptions/QueueException.js";
import RuntimeException from "../../exceptions/RuntimeException.js";
import JobModel from "../../models/JobModel.js";
import fs from "fs";
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
    $signature = "queue:work";
    /**
     * The console command description.
     *
     * @var $description string
     */
    $description = "Start processing jobs on the queue as a daemon";
    /**
     * The options or optional flag of the console command.
     *
     * @var $options Array<Array<any>>
     */
    $options = [];
    /**
     * The arguments of the console command.
     *
     * @var $arguments Array<Array<string>>
     */
    $arguments = [];
    /**
     * Executes this command.
     *
     * Runs as a long-lived daemon: loads the queue config (falling back to
     * the package default if the app hasn't published its own), then loops
     * indefinitely, claiming the oldest eligible job (attempts < 3, and
     * either never reserved or whose reservation is older than
     * `retry_after` seconds - i.e. presumed abandoned by a crashed worker),
     * dynamically importing and running its handler, and deleting it on
     * success or incrementing `attempts` and releasing the reservation on
     * failure. Idles for `poll_interval` seconds when nothing is claimable
     * and waits `retry_delay` seconds before retrying after a failed
     * attempt - three independent knobs, separate from the reservation
     * timeout. Listens for `exit`/`SIGINT`/`SIGTERM` to stop the loop
     * gracefully after the current iteration. A stop signal resolves the
     * interruptible sleep immediately, so a long `retry_after` never delays
     * shutdown -- the worker finishes the in-flight job (if any) and exits.
     */
    async handle() {
        const configPath = App.Path.configPath("queue.ts");
        let config;
        if (fs.existsSync(configPath))
            config = require(configPath).default;
        else
            config = QueueConfig;
        if (!config)
            throw new QueueException("There is no config provided.");
        const currentConnection = config.connections[config.default];
        // Independent tuning knobs: reservation timeout vs. idle poll vs. retry backoff.
        const retryAfter = Number(currentConnection?.retry_after) || 60;
        const pollInterval = Number(currentConnection?.poll_interval) || retryAfter;
        const retryDelay = Number(currentConnection?.retry_delay) || retryAfter;
        let running = true;
        let resolveStop = null;
        const stopped = new Promise((resolve) => {
            resolveStop = resolve;
        });
        const sleepTimers = [];
        /**
         * Sleeps for `ms`, cancelled the moment a stop signal arrives.
         * A plain `Bun.sleep` keeps its event-loop timer alive even after the
         * race resolves, so this uses a clearable `setTimeout` instead --
         * a long `retry_after` never delays shutdown.
         */
        const interruptibleSleep = (ms) => {
            return new Promise((resolve) => {
                const timer = setTimeout(() => {
                    const index = sleepTimers.indexOf(timer);
                    if (index !== -1)
                        sleepTimers.splice(index, 1);
                    resolve();
                }, ms);
                sleepTimers.push(timer);
                void stopped.then(() => {
                    const index = sleepTimers.indexOf(timer);
                    if (index !== -1)
                        sleepTimers.splice(index, 1);
                    clearTimeout(timer);
                    resolve();
                });
            });
        };
        const stop = (signal) => {
            running = false;
            resolveStop?.();
            for (const timer of sleepTimers)
                clearTimeout(timer);
            sleepTimers.length = 0;
            Logger.setContext("Queue").info(`Stopping queue worker, ${signal} sent.`);
        };
        process.on("exit", () => stop("exit"));
        process.on("SIGINT", () => stop("SIGINT"));
        process.on("SIGTERM", () => stop("SIGTERM"));
        Logger.setContext("Queue").info("Queue worker started.");
        while (running) {
            const now = Luxon.DateTime.now().toUnixInteger();
            // Jobs reserved before this cutoff are treated as abandoned (e.g. worker crash) and become claimable again.
            const staleBefore = now - retryAfter;
            // Find the oldest eligible job: available now, under the attempt limit, and either unreserved or staled out.
            const job = await JobModel.query()
                .where("attempts", "<", 3)
                .where("available_at", "<=", now)
                .where((builder) => builder.whereNull("reserved_at").orWhere("reserved_at", "<", staleBefore))
                .orderBy("id", "asc")
                .first();
            if (!job?.id) {
                await interruptibleSleep(pollInterval * 1000);
            }
            else {
                // Atomically claim the job by stamping `reserved_at`, re-checking the same eligibility
                // conditions (with a fresh cutoff and `available_at` gate) to avoid a race with
                // another worker claiming it first.
                const now = Luxon.DateTime.now().toUnixInteger();
                const claimed = await JobModel.query()
                    .where("id", job.id)
                    .where("attempts", "<", 3)
                    .where("available_at", "<=", now)
                    .where((builder) => builder
                    .whereNull("reserved_at")
                    .orWhere("reserved_at", "<", now - retryAfter))
                    .update({
                    reserved_at: now
                });
                if (!claimed)
                    continue;
                /**
                 * Heartbeat while the handler runs: refresh `reserved_at` every half of `retry_after`
                 * so a long-running job is never re-claimed by another worker from this one's in-flight copy.
                 * Only a worker that actually dies stops beating, leaving the reservation to
                 * age past `retry_after` and become safely reclaimable.
                 */
                const beatInterval = Math.max(1000, Math.floor((retryAfter * 1000) / 2));
                let heartbeat = null;
                const startHeartbeat = () => {
                    if (heartbeat)
                        return;
                    heartbeat = setInterval(() => {
                        void JobModel.query()
                            .where("id", job.id)
                            .update({
                            reserved_at: Luxon.DateTime.now().toUnixInteger()
                        })
                            .catch(() => null);
                    }, beatInterval);
                    if (heartbeat.unref)
                        heartbeat.unref();
                };
                const stopHeartbeat = () => {
                    if (heartbeat) {
                        clearInterval(heartbeat);
                        heartbeat = null;
                    }
                };
                // Dynamically resolves and invokes the job class's `handle()` with its stored payload.
                const handler = async () => {
                    const module = await import(App.Path.rootPath(job.queue));
                    const Class = module.default;
                    if (!Class)
                        throw new RuntimeException(`Job class not found [${job.queue}].`);
                    const instance = new Class();
                    if (typeof instance.handle !== "function")
                        throw new RuntimeException(`Job class has no handle function in [${job.queue}].`);
                    await instance.handle(Bun.JSON5.parse(job.payload));
                };
                try {
                    startHeartbeat();
                    await handler();
                    await JobModel.query().findById(job.id).delete();
                }
                catch {
                    // On failure: bump the attempt count (atomically, on the row) and release the
                    // reservation so it can be retried (or eventually dead-lettered once attempts hits 3).
                    await JobModel.query()
                        .findById(job.id)
                        .update({
                        attempts: (Number(job.attempts) || 0) + 1,
                        reserved_at: null
                    });
                    await interruptibleSleep(retryDelay * 1000);
                }
                finally {
                    stopHeartbeat();
                }
            }
        }
    }
}
