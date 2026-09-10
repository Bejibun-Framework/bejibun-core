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
     */
    public async handle(): Promise<void> {
        let running: boolean = true;

        process.on("exit", async (): Promise<void> => {
            running = false;
            Logger.setContext("Queue").info("Queue worker stopped.");
        });
        process.on("SIGINT", async (): Promise<void> => {
            running = false;
            Logger.setContext("Queue").info("Stopping queue worker, SIGINT sent.");
        });
        process.on("SIGTERM", async (): Promise<void> => {
            running = false;
            Logger.setContext("Queue").info("Stopping queue worker, SIGTERM sent.");
        });

        while (running) {
            const job: any = await JobModel.query()
                .where("attempts", ">=", 3)
                .whereNull("reserved_at")
                .orderBy("id", "asc")
                .first();

            if (!job?.id) {
                running = false;
            } else {
                const claimed: any = await JobModel.query()
                    .where("id", job.id)
                    .where("attempts", ">=", 3)
                    .whereNull("reserved_at")
                    .update({
                        reserved_at: Luxon.DateTime.now().toUnixInteger()
                    });
                if (!claimed) continue;

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

                try {
                    await handler();
                    await JobModel.query().findById(job.id).delete();
                } catch {
                    await JobModel.query()
                        .findById(job.id)
                        .update({
                            attempts: (Number(job.attempts) || 0) + 1,
                            reserved_at: null
                        });
                }
            }
        }

        Logger.setContext("Queue").info("All failed jobs retried successfully.");
    }
}
