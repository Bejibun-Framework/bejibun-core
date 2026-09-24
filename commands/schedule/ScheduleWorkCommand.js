import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import Luxon from "@bejibun/utils/facades/Luxon";
import CronExpressionParser from "cron-parser";
import Kernel from "../../Kernel.js";
import ScheduleLoader from "../../loader/ScheduleLoader.js";
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
    $signature = "schedule:work";
    /**
     * The console command description.
     *
     * @var $description string
     */
    $description = "Start the schedule worker";
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
    /** The set of command names currently executing, preventing concurrent runs. */
    running = new Set();
    /** The timeout handle for the schedule tick loop. */
    interval = null;
    /** The list of prepared schedules with parsed cron expressions. */
    schedules = [];
    /**
     * Executes this command.
     */
    async handle() {
        process.on("exit", async () => {
            this.stopSchedule();
            Logger.setContext("Schedule").info("Schedule worker stopped.");
        });
        process.on("SIGINT", async () => {
            this.stopSchedule();
            Logger.setContext("Schedule").info("Stopping schedule worker, SIGINT sent.");
        });
        process.on("SIGTERM", async () => {
            this.stopSchedule();
            Logger.setContext("Schedule").info("Stopping schedule worker, SIGTERM sent.");
        });
        Kernel.registerSchedulers();
        this.prepareSchedules();
        Logger.setContext("Schedule").info("Schedule worker started.");
        this.startSchedule();
    }
    prepareSchedules() {
        this.schedules = [];
        for (const schedule of ScheduleLoader.schedulers) {
            if (!schedule.cron)
                continue;
            try {
                const timezone = schedule.timezone || "UTC";
                const now = Luxon.DateTime.now().setZone(timezone).toJSDate();
                const expression = CronExpressionParser.parse(schedule.cron, {
                    currentDate: now
                });
                const nextRun = expression.next().getTime();
                this.schedules.push({
                    ...schedule,
                    expression,
                    nextRun
                });
                Logger.setContext("Schedule").info(`Registered schedule for command [${schedule.command}].`);
            }
            catch (error) {
                Logger.setContext("Schedule")
                    .error(`Invalid cron for [${schedule.command}]: ${schedule.cron}.`)
                    .trace(error);
            }
        }
    }
    startSchedule() {
        const tick = () => {
            this.tick();
            const delay = 1000 - (Date.now() % 1000);
            this.interval = setTimeout(tick, delay);
        };
        tick();
    }
    stopSchedule() {
        if (this.interval) {
            clearTimeout(this.interval);
            this.interval = null;
        }
    }
    tick() {
        const now = Date.now();
        for (const schedule of this.schedules) {
            if (now >= schedule.nextRun) {
                this.run(schedule);
                schedule.nextRun = schedule.expression.next().getTime();
            }
        }
    }
    async run(task) {
        if (this.running.has(task.command))
            return;
        this.running.add(task.command);
        Logger.setContext("Schedule").info(`Executing schedule for command [${task.command}].`);
        try {
            const proc = Bun.spawn(["bun", "ace", task.command], {
                cwd: App.Path.rootPath()
            });
            await proc.exited;
        }
        catch (error) {
            Logger.setContext("Schedule")
                .error(`Error running command [${task.command}].`)
                .trace(error);
        }
        finally {
            this.running.delete(task.command);
        }
    }
}
