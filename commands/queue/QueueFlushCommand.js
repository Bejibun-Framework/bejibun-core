import Logger from "@bejibun/logger";
import JobModel from "../../models/JobModel.js";
/**
 * Console command: `Flush all of the failed queue jobs`
 *
 * Registered under the `ace` CLI as `QueueFlushCommand`. See `$signature`,
 * `$options`, and `$arguments` below for its CLI shape.
 */
export default class QueueFlushCommand {
    /**
     * The name and signature of the console command.
     *
     * @var $signature string
     */
    $signature = "queue:flush";
    /**
     * The console command description.
     *
     * @var $description string
     */
    $description = "Flush all of the failed queue jobs";
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
     */
    async handle() {
        await JobModel.query().where("attempts", ">=", 3).delete();
        Logger.setContext("Queue").info("All failed jobs deleted successfully.");
    }
}
