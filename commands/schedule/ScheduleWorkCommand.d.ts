import type { TSchedule } from "../../types/schedule.d.ts";
import { CronExpression } from "cron-parser";
/** A schedule entry enriched with a parsed cron expression and the next run timestamp. */
type TPreparedSchedule = TSchedule & {
    /** Parsed cron expression used to compute the next run time. */
    expression: CronExpression;
    /** Unix timestamp (ms) when the task should next execute. */
    nextRun: number;
};
/**
 * Console command: `Start the schedule worker`
 *
 * Registered under the `ace` CLI as `ScheduleWorkCommand`. See `$signature`,
 * `$options`, and `$arguments` below for its CLI shape.
 */
export default class ScheduleWorkCommand {
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
    /** The set of command names currently executing, preventing concurrent runs. */
    protected running: Set<string>;
    /** The timeout handle for the schedule tick loop. */
    protected interval: NodeJS.Timeout | null;
    /** The list of prepared schedules with parsed cron expressions. */
    protected schedules: Array<TPreparedSchedule>;
    /**
     * Executes this command.
     */
    handle(): Promise<void>;
    private prepareSchedules;
    private startSchedule;
    private stopSchedule;
    private tick;
    private run;
}
export {};
