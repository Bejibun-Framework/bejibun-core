import ScheduleLoader from "../loader/ScheduleLoader.js";
/**
 * Fluent builder for scheduling recurring commands. Supports
 * six-field cron expression (`second minute hour day month weekday`) and
 * immediately registers the schedule entry with `ScheduleLoader`.
 */
export default class ScheduleBuilder {
    /** The shell command to run on this schedule. */
    _command;
    /** The six-field cron expression controlling when the command runs. */
    _cron;
    /** Optional IANA timezone the cron expression is evaluated in. */
    _timezone;
    constructor() {
        this._command = "";
        this._cron = "* * * * * *";
    }
    /**
     * Sets the command to run on this schedule.
     *
     * @param {string} command - The shell command to execute.
     * @returns {ScheduleBuilder} This builder, for chaining.
     */
    command(command) {
        this._command = command;
        return this;
    }
    /**
     * Sets the timezone the cron expression is evaluated in.
     *
     * @param {string} timezone - An IANA timezone name (e.g. `"Asia/Jakarta"`).
     * @returns {ScheduleBuilder} This builder, for chaining.
     */
    timezone(timezone) {
        this._timezone = timezone;
        return this;
    }
    /**
     * Sets a raw six-field cron expression and registers the schedule.
     *
     * @param {string} cron - The cron expression (`second minute hour day month weekday`).
     */
    cron(cron) {
        this._cron = cron;
        this.push();
    }
    /** Runs the command every second. */
    everySecond() {
        this._cron = "* * * * * *";
        this.push();
    }
    /** Runs the command every 2 seconds. */
    everyTwoSeconds() {
        this._cron = "*/2 * * * * *";
        this.push();
    }
    /** Runs the command every 5 seconds. */
    everyFiveSeconds() {
        this._cron = "*/5 * * * * *";
        this.push();
    }
    /** Runs the command every 10 seconds. */
    everyTenSeconds() {
        this._cron = "*/10 * * * * *";
        this.push();
    }
    /** Runs the command every 15 seconds. */
    everyFifteenSeconds() {
        this._cron = "*/15 * * * * *";
        this.push();
    }
    /** Runs the command every 20 seconds. */
    everyTwentySeconds() {
        this._cron = "*/20 * * * * *";
        this.push();
    }
    /** Runs the command every 30 seconds. */
    everyThirtySeconds() {
        this._cron = "*/30 * * * * *";
        this.push();
    }
    /** Runs the command every minute, on the minute. */
    everyMinute() {
        this._cron = "0 * * * * *";
        this.push();
    }
    /** Runs the command every 2 minutes. */
    everyTwoMinutes() {
        this._cron = "0 */2 * * * *";
        this.push();
    }
    /** Runs the command every 3 minutes. */
    everyThreeMinutes() {
        this._cron = "0 */3 * * * *";
        this.push();
    }
    /** Runs the command every 4 minutes. */
    everyFourMinutes() {
        this._cron = "0 */4 * * * *";
        this.push();
    }
    /** Runs the command every 5 minutes. */
    everyFiveMinutes() {
        this._cron = "0 */5 * * * *";
        this.push();
    }
    /** Runs the command every 10 minutes. */
    everyTenMinutes() {
        this._cron = "0 */10 * * * *";
        this.push();
    }
    /** Runs the command every 15 minutes. */
    everyFifteenMinutes() {
        this._cron = "0 */15 * * * *";
        this.push();
    }
    /** Runs the command every 30 minutes. */
    everyThirtyMinutes() {
        this._cron = "0 */30 * * * *";
        this.push();
    }
    /** Runs the command every hour, on the hour. */
    hourly() {
        this._cron = "0 0 * * * *";
        this.push();
    }
    /**
     * Runs the command every hour, at the given minute.
     *
     * @param {number} minute - The minute of each hour to run at (0-59).
     */
    hourlyAt(minute) {
        this._cron = `0 ${minute} * * * *`;
        this.push();
    }
    /**
     * Runs the command every odd hour (1, 3, 5, ...), at the given minute.
     *
     * @param {number} minute - The minute to run at (0-59). Defaults to `0`.
     */
    everyOddHour(minute = 0) {
        this._cron = `0 ${minute} 1-23/2 * * *`;
        this.push();
    }
    /**
     * Runs the command every 2 hours, at the given minute.
     *
     * @param {number} minute - The minute to run at (0-59). Defaults to `0`.
     */
    everyTwoHours(minute = 0) {
        this._cron = `0 ${minute} */2 * * *`;
        this.push();
    }
    /**
     * Runs the command every 3 hours, at the given minute.
     *
     * @param {number} minute - The minute to run at (0-59). Defaults to `0`.
     */
    everyThreeHours(minute = 0) {
        this._cron = `0 ${minute} */3 * * *`;
        this.push();
    }
    /**
     * Runs the command every 4 hours, at the given minute.
     *
     * @param {number} minute - The minute to run at (0-59). Defaults to `0`.
     */
    everyFourHours(minute = 0) {
        this._cron = `0 ${minute} */4 * * *`;
        this.push();
    }
    /**
     * Runs the command every 6 hours, at the given minute.
     *
     * @param {number} minute - The minute to run at (0-59). Defaults to `0`.
     */
    everySixHours(minute = 0) {
        this._cron = `0 ${minute} */6 * * *`;
        this.push();
    }
    /** Runs the command daily at midnight. */
    daily() {
        this._cron = "0 0 0 * * *";
        this.push();
    }
    /**
     * Runs the command daily at the given time.
     *
     * @param {string} time - The time to run at, in `"HH:mm"` 24-hour format.
     */
    dailyAt(time) {
        const { h, m } = this.timeToParts(time);
        this._cron = `0 ${m} ${h} * * *`;
        this.push();
    }
    /**
     * Runs the command twice daily, on the hour, at the given hours.
     *
     * @param {number} h1 - The first hour of the day to run at (0-23).
     * @param {number} h2 - The second hour of the day to run at (0-23).
     */
    twiceDaily(h1, h2) {
        this._cron = `0 0 ${h1},${h2} * * *`;
        this.push();
    }
    /**
     * Runs the command twice daily, at the given hours and minute.
     *
     * @param {number} h1 - The first hour of the day to run at (0-23).
     * @param {number} h2 - The second hour of the day to run at (0-23).
     * @param {number} minute - The minute to run at (0-59).
     */
    twiceDailyAt(h1, h2, minute) {
        this._cron = `0 ${minute} ${h1},${h2} * * *`;
        this.push();
    }
    /** Runs the command weekly, at midnight on Sunday. */
    weekly() {
        this._cron = "0 0 0 * * 0";
        this.push();
    }
    /**
     * Runs the command weekly, on the given day and time.
     *
     * @param {number} day - The day of the week to run on (0 = Sunday, ..., 6 = Saturday).
     * @param {string} time - The time to run at, in `"HH:mm"` 24-hour format.
     */
    weeklyOn(day, time) {
        const { h, m } = this.timeToParts(time);
        this._cron = `0 ${m} ${h} * * ${day}`;
        this.push();
    }
    /** Runs the command monthly, at midnight on the 1st. */
    monthly() {
        this._cron = "0 0 0 1 * *";
        this.push();
    }
    /**
     * Runs the command monthly, on the given day and time.
     *
     * @param {number} day - The day of the month to run on (1-31).
     * @param {string} time - The time to run at, in `"HH:mm"` 24-hour format.
     */
    monthlyOn(day, time) {
        const { h, m } = this.timeToParts(time);
        this._cron = `0 ${m} ${h} ${day} * *`;
        this.push();
    }
    /**
     * Runs the command twice monthly, on the given days and time.
     *
     * @param {number} d1 - The first day of the month to run on (1-31).
     * @param {number} d2 - The second day of the month to run on (1-31).
     * @param {string} time - The time to run at, in `"HH:mm"` 24-hour format.
     */
    twiceMonthly(d1, d2, time) {
        const { h, m } = this.timeToParts(time);
        this._cron = `0 ${m} ${h} ${d1},${d2} * *`;
        this.push();
    }
    /** Runs the command yearly, at midnight on January 1st. */
    yearly() {
        this._cron = "0 0 0 1 1 *";
        this.push();
    }
    /**
     * Runs the command yearly, on the given month, day, and time.
     *
     * @param {number} month - The month to run in (1-12).
     * @param {number} day - The day of the month to run on (1-31).
     * @param {string} time - The time to run at, in `"HH:mm"` 24-hour format.
     */
    yearlyOn(month, day, time) {
        const { h, m } = this.timeToParts(time);
        this._cron = `0 ${m} ${h} ${day} ${month} *`;
        this.push();
    }
    /**
     * Registers this schedule's current command/cron/timezone with the
     * `ScheduleLoader`. Called automatically by every frequency method.
     */
    push() {
        ScheduleLoader.add({
            command: this._command,
            cron: this._cron,
            timezone: this._timezone
        });
    }
    /**
     * Parses an `"HH:mm"` time string into its hour and minute components.
     *
     * @param {string} time - The time string to parse.
     * @returns {{h: number; m: number}} The parsed hour (`h`) and minute (`m`).
     */
    timeToParts(time) {
        const [h, m] = time.split(":").map(Number);
        return { h, m };
    }
}
