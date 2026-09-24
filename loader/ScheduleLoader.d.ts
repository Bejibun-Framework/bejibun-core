import type { TSchedule } from "../types/schedule.d.ts";
/**
 * Registry of scheduled (cron-driven) tasks, populated by
 * `ScheduleBuilder` as an application's `Kernel.schedule()` runs, and
 * consumed by the schedule worker command to determine what's due to run.
 */
export default class ScheduleLoader {
    /** Every registered scheduled task. */
    static schedulers: Array<TSchedule>;
    /**
     * Registers a scheduled task.
     *
     * @param {TSchedule} schedule - The schedule descriptor to register.
     */
    static add(schedule: TSchedule): void;
}
