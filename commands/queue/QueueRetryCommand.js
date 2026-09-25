import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import Luxon from "@bejibun/utils/facades/Luxon";
import RuntimeException from "../../exceptions/RuntimeException.js";
import JobModel from "../../models/JobModel.js";
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
    $signature = "queue:retry";
    /**
     * The console command description.
     *
     * @var $description string
     */
    $description = "Retry a failed queue job";
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
    async handle() {
        let running = true;
        const stop = (signal) => {
            running = false;
            Logger.setContext("Queue").info(`Stopping queue worker, ${signal} sent.`);
        };
        process.on("exit", () => stop("exit"));
        process.on("SIGINT", () => stop("SIGINT"));
        process.on("SIGTERM", () => stop("SIGTERM"));
        while (running) {
            const claimNow = Luxon.DateTime.now().toUnixInteger();
            /**
             * Portable, database-agnostic claim -- see `JobModel.claim()` and
             * `QueueWorkCommand` for why this needs no `FOR UPDATE`/`SKIP LOCKED`/`RETURNING`.
             */
            const job = await JobModel.claim((builder) => builder
                .where("attempts", ">=", 3)
                .where("available_at", "<=", claimNow)
                .whereNull("reserved_at"), claimNow);
            if (!job?.id)
                break;
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
                await handler();
                await JobModel.query().findById(job.id).delete();
            }
            catch {
                await JobModel.query().findById(job.id).increment("attempts", 1);
                await JobModel.query().findById(job.id).patch({ reserved_at: null });
                // The failed retry stays eligible; loop again.
            }
        }
        Logger.setContext("Queue").info("All failed jobs retried successfully.");
    }
}
