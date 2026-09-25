import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import Luxon from "@bejibun/utils/facades/Luxon";
import RuntimeException from "@/exceptions/RuntimeException";
import JobModel from "@/models/JobModel";

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
    protected $signature: string = "queue:retry";

    /**
     * The console command description.
     *
     * @var $description string
     */
    protected $description: string = "Retry a failed queue job";

    /**
     * The options or optional flag of the console command.
     *
     * @var $options Array<Array<any>>
     */
    protected $options: Array<Array<any>> = [];

    /**
     * The arguments of the console command.
     *
     * @var $arguments Array<Array<string>>
     */
    protected $arguments: Array<Array<string>> = [];

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
    public async handle(): Promise<void> {
        let running: boolean = true;

        const stop = (signal: string): void => {
            running = false;
            Logger.setContext("Queue").info(`Stopping queue worker, ${signal} sent.`);
        };

        process.on("exit", (): void => stop("exit"));
        process.on("SIGINT", (): void => stop("SIGINT"));
        process.on("SIGTERM", (): void => stop("SIGTERM"));

        while (running) {
            const outcome: "idle" | "ok" | "failed" = await JobModel.transaction(
                async (trx: any): Promise<"idle" | "ok" | "failed"> => {
                    const claimNow: number = Luxon.DateTime.now().toUnixInteger();

                    /**
                     * Claim a dead-lettered job via row lock; other retry workers
                     * SKIP rows locked by this transaction.
                     */
                    const job: any = await JobModel.query(trx)
                        .where("attempts", ">=", 3)
                        .where("available_at", "<=", claimNow)
                        .whereNull("reserved_at")
                        .orderBy("id", "asc")
                        .forUpdate()
                        .skipLocked()
                        .first();

                    if (!job?.id) return "idle";

                    await JobModel.query(trx).findById(job.id).patch({
                        reserved_at: claimNow
                    });

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

                    try {
                        await handler();

                        await JobModel.query(trx).findById(job.id).delete();

                        return "ok";
                    } catch {
                        await JobModel.query(trx)
                            .findById(job.id)
                            .increment("attempts", 1)
                            .patch({reserved_at: null});

                        return "failed";
                    }
                }
            );

            if (outcome === "idle") {
                running = false;
            } else if (outcome === "failed") {
                // The failed retry stays eligible; loop again.
            }
        }

        Logger.setContext("Queue").info("All failed jobs retried successfully.");
    }
}
