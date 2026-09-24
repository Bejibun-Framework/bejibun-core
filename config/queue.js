import QueueDriverEnum from "../enums/QueueDriverEnum.js";
import JobModel from "../models/JobModel.js";
/**
 * Default queue configuration. Defines the active connection (via the
 * `QUEUE_DRIVER` env var, defaulting to `"database"`) and the settings
 * for each available connection driver.
 */
const config = {
    /** The queue connection used by default, unless overridden per-dispatch. */
    default: env("QUEUE_DRIVER", "database"),
    /** Available queue connections, keyed by name. */
    connections: {
        /** Database-backed queue: persists jobs as rows via `JobModel`. */
        database: {
            driver: QueueDriverEnum.Database,
            table: JobModel.tableName,
            /** Seconds before a reserved-but-unfinished job is considered abandoned and reclaimed. */
            retry_after: 60
        }
    }
};
export default config;
