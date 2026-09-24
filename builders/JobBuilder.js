import Luxon from "@bejibun/utils/facades/Luxon";
import JobModel from "../models/JobModel.js";
/**
 * Fluent builder for configuring and dispatching a queue job. Persists the
 * job as a row in `JobModel` (queue name, serialized arguments, and the
 * unix timestamp it becomes available at) for the queue worker to pick up.
 */
export default class JobBuilder {
    /** The queue name this job will be pushed onto. */
    queue;
    /** The unix timestamp this builder is created at. */
    now;
    /** The unix timestamp the job becomes eligible to run at (defaults to `now`, shifted by `delay()`). */
    availableAt;
    /** The arguments to pass to the job's handler when it runs. */
    args;
    constructor() {
        this.now = Luxon.DateTime.now().toUnixInteger();
        this.availableAt = this.now;
        this.args = [];
    }
    /**
     * Sets the queue this job will be dispatched onto.
     *
     * @param {string} queue - The queue name/namespace.
     * @returns {JobBuilder} This builder, for chaining.
     */
    setQueue(queue) {
        this.queue = queue;
        return this;
    }
    /**
     * Adds arguments to be forwarded to the job's handler when it runs.
     *
     * @param {any} args - The arguments to store.
     * @returns {JobBuilder} This builder, for chaining.
     */
    dispatch(...args) {
        this.args.push(...args);
        return this;
    }
    /**
     * Delays the job's availability by the given number of seconds from now.
     *
     * @param {number} delay - The delay, in seconds.
     * @returns {JobBuilder} This builder, for chaining.
     */
    delay(delay) {
        this.availableAt = this.now + delay;
        return this;
    }
    /**
     * Persists the job to the queue table so a worker can pick it up.
     */
    async send() {
        await JobModel.create({
            queue: this.queue,
            payload: JSON.stringify(this.args),
            available_at: this.availableAt,
            created_at: this.now
        });
    }
}
