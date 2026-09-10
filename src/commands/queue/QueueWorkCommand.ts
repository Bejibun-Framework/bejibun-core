import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import Luxon from "@bejibun/utils/facades/Luxon";
import QueueConfig from "@/config/queue";
import QueueException from "@/exceptions/QueueException";
import RuntimeException from "@/exceptions/RuntimeException";
import JobModel from "@/models/JobModel";
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
     * Runs as a long-lived daemon: loads the queue config (falling back to
     * the package default if the app hasn't published its own), then loops
     * indefinitely, claiming the oldest eligible job (attempts < 3, and
     * either never reserved or whose reservation is older than
     * `retry_after` seconds - i.e. presumed abandoned by a crashed worker),
     * dynamically importing and running its handler, and deleting it on
     * success or incrementing `attempts` and releasing the reservation on
     * failure. Sleeps for `retry_after` seconds whenever there's nothing
     * to claim. Listens for `exit`/`SIGINT`/`SIGTERM` to stop the loop
     * gracefully after the current iteration.
     */
    public async handle(): Promise<void> {
        const configPath = App.Path.configPath("queue.ts");

        let config: any;

        if (fs.existsSync(configPath)) config = require(configPath).default;
        else config = QueueConfig;

        if (!config) throw new QueueException("There is no config provided.");

        const currentConnection: Record<string, any> = config.connections[config.default];
        const retryAfter: number = Number(currentConnection?.retry_after) || 60;

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

        Logger.setContext("Queue").info("Queue worker started.");

        while (running) {
            // Jobs reserved before this cutoff are treated as abandoned (e.g. worker crash) and become claimable again.
            const staleBefore: number = Luxon.DateTime.now().toUnixInteger() - retryAfter;

            // Find the oldest eligible job: under the attempt limit, and either unreserved or staled out.
            const job: any = await JobModel.query()
                .where("attempts", "<", 3)
                .where((builder: any) =>
                    builder.whereNull("reserved_at").orWhere("reserved_at", "<", staleBefore)
                )
                .orderBy("id", "asc")
                .first();

            if (!job?.id) {
                await Bun.sleep(retryAfter * 1000);
            } else {
                // Atomically claim the job by stamping `reserved_at`, re-checking the same eligibility
                // conditions to avoid a race with another worker claiming it first.
                const claimed: any = await JobModel.query()
                    .where("id", job.id)
                    .where("attempts", "<", 3)
                    .where((builder: any) =>
                        builder.whereNull("reserved_at").orWhere("reserved_at", "<", staleBefore)
                    )
                    .update({
                        reserved_at: Luxon.DateTime.now().toUnixInteger()
                    });
                if (!claimed) continue;

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

                try {
                    await handler();
                    await JobModel.query().findById(job.id).delete();
                } catch {
                    // On failure: bump the attempt count and release the reservation so it can be retried (or eventually dead-lettered once attempts hits 3).
                    await JobModel.query()
                        .findById(job.id)
                        .update({
                            attempts: (Number(job.attempts) || 0) + 1,
                            reserved_at: null
                        });

                    await Bun.sleep(retryAfter * 1000);
                }
            }
        }
    }
}
