import ResponseBuilder from "../builders/ResponseBuilder.js";
/**
 * Static facade over `ResponseBuilder`, giving controllers a fluent
 * entry point for building HTTP responses (e.g.
 * `Response.setData(payload).setStatus(201).send()`) without needing to
 * instantiate the builder themselves.
 */
export default class Response {
    /**
     * Starts a new response with the given data payload.
     *
     * @param {any} data - The response body data.
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static setData(data) {
        return new ResponseBuilder().setData(data);
    }
    /**
     * Starts a new response with the given message.
     *
     * @param {string} message - The response message.
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static setMessage(message) {
        return new ResponseBuilder().setMessage(message);
    }
    /**
     * Starts a new response with the given HTTP status code.
     *
     * @param {number} status - The HTTP status code.
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static setStatus(status) {
        return new ResponseBuilder().setStatus(status);
    }
    /**
     * Starts a new response with additional custom top-level fields.
     *
     * @param {Record<string, any>} custom - Extra fields to merge into the response body.
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static setCustom(custom) {
        return new ResponseBuilder().setCustom(custom);
    }
    /**
     * Starts a new response that sets a single cookie.
     *
     * @param {string} key - The cookie name.
     * @param {string} value - The cookie value.
     * @param {Bun.CookieInit} options - Optional cookie attributes (domain, path, expiry, etc.).
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static setCookie(key, value, options) {
        return new ResponseBuilder().setCookie(key, value, options);
    }
    /**
     * Starts a new response that sets multiple cookies at once.
     *
     * @param {Array<{key: string; value: string; options?: Bun.CookieInit}>} cookies - The cookies to set.
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static setCookies(cookies) {
        return new ResponseBuilder().setCookies(cookies);
    }
    /**
     * Starts a new response that deletes a single cookie.
     *
     * @param {string} key - The cookie name to delete.
     * @param {Pick<Bun.CookieInit, "domain" | "path">} options - Optional `domain`/`path` to scope the deletion.
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static deleteCookie(key, options) {
        return new ResponseBuilder().deleteCookie(key, options);
    }
    /**
     * Starts a new response that deletes multiple cookies at once.
     *
     * @param {Array<{key: string; options?: Pick<Bun.CookieInit, "domain" | "path">}>} cookies - The cookies to delete.
     * @returns {ResponseBuilder} A new `ResponseBuilder` for further chaining.
     */
    static deleteCookies(cookies) {
        return new ResponseBuilder().deleteCookies(cookies);
    }
}
