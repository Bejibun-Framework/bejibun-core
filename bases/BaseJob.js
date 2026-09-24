import JobBuilder from "../builders/JobBuilder.js";
import RuntimeException from "../exceptions/RuntimeException.js";
/**
 * Base class every Bejibun queue job extends. Provides namespace
 * registration and a static `dispatch()` shortcut for pushing the
 * job onto its queue.
 */
export default class BaseJob {
    /** The registered namespace/identifier this job is dispatched under. Set via `setNamespace()`. */
    static _namespace;
    /**
     * The job's registered namespace.
     *
     * @returns {string} The registered namespace.
     * @throws {RuntimeException} If the namespace hasn't been registered via `setNamespace()`.
     */
    static get namespace() {
        if (!this._namespace)
            throw new RuntimeException(`Job namespace not registered for [${this.name}].`);
        return this._namespace;
    }
    /**
     * Registers the namespace/identifier this job is dispatched under.
     * Typically called once by the framework's namespace loader.
     *
     * @param {string} namespace - The namespace to register.
     */
    static setNamespace(namespace) {
        this._namespace = namespace;
    }
    /**
     * Dispatches this job onto its registered queue.
     *
     * @param {Array<any>} args - Arguments forwarded to the job's handler when it runs.
     * @returns {JobBuilder} A builder for further chaining.
     */
    static dispatch(...args) {
        return new JobBuilder().setQueue(this.namespace).dispatch(...args);
    }
}
