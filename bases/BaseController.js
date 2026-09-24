import Response from "../facades/Response.js";
/**
 * Base class every Bejibun controller extends. Provides shared conveniences
 * (a `Response` facade accessor and payload validation) so individual
 * controllers don't need to import them directly.
 */
export default class BaseController {
    /**
     * Convenient accessor for the `Response` facade, providing controllers
     * a shorthand for `this.response.setData(...)` and other fluent calls.
     *
     * @returns {typeof Response} The `Response` facade.
     */
    get response() {
        return Response;
    }
}
