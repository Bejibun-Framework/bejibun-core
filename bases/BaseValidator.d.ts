import vine from "@vinejs/vine";
import "../utils/vine.js";
/**
 * Base class every Bejibun validator extends. Provides access to the
 * shared, pre-configured Vine instance (with the framework's custom
 * rules - `exists`, `unique` - already registered via `@/utils/vine`).
 */
export default class BaseValidator {
    /**
     * The shared Vine validator builder instance (with the framework's
     * `exists`/`unique` rules pre-registered).
     *
     * @returns {typeof vine} The shared Vine instance.
     */
    static get validator(): typeof vine;
}
