import ScheduleBuilder from "../builders/ScheduleBuilder.js";
/**
 * Static facade over `ScheduleBuilder`, used inside an application's
 * `Kernel.schedule()` method to register cron-driven Ace commands (e.g.
 * `Schedule.command("queue:flush").daily()`).
 */
export default class Schedule {
    /**
     * Starts a new scheduled task for the given Ace command.
     *
     * @param {string} command - The Ace command to run on the configured cron schedule.
     * @returns {ScheduleBuilder} A new `ScheduleBuilder` for further chaining (frequency, timezone, etc.).
     */
    static command(command) {
        return new ScheduleBuilder().command(command);
    }
}
