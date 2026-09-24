import CorsLoader from "../loader/CorsLoader.js";
/**
 * Fluent builder for constructing HTTP responses. Wraps `data`,
 * `message`, `status`, and any custom top-level fields into a consistent
 * JSON envelope, applies CORS headers, and manages response cookies via
 * Bun's `CookieMap`. This is what the `Response` facade delegates to.
 */
export default class ResponseBuilder {
    /** The `data` payload included in the response body. */
    data;
    /** The `message` field included in the response body. */
    message;
    /** The HTTP status code for the response. */
    status;
    /** Additional top-level fields merged into the response body. */
    custom;
    /** Cookies to be set on the outgoing response. */
    cookies;
    constructor() {
        this.data = null;
        this.message = "Success";
        this.status = 200;
        this.custom = {};
        this.cookies = new Bun.CookieMap();
    }
    /**
     * Sets the response body's `data` field.
     *
     * @param {any} data - The data to include in the response.
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    setData(data) {
        this.data = data;
        return this;
    }
    /**
     * Sets the response body's `message` field.
     *
     * @param {string} message - The message to include in the response.
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    setMessage(message) {
        this.message = message;
        return this;
    }
    /**
     * Sets the HTTP status code for the response.
     *
     * @param {number} status - The HTTP status code.
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    setStatus(status) {
        this.status = status;
        return this;
    }
    /**
     * Sets additional top-level fields to merge into the response body,
     * alongside `data` and `message`.
     *
     * @param {Record<string, any>} custom - The additional fields to include.
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    setCustom(custom) {
        this.custom = custom;
        return this;
    }
    /**
     * Queues a single cookie to be set on the outgoing response.
     *
     * @param {string} key - The cookie name.
     * @param {string} value - The cookie value.
     * @param {Bun.CookieInit} options - Optional cookie attributes (domain, path, expiry, etc.).
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    setCookie(key, value, options) {
        this.cookies.set(key, value, options);
        return this;
    }
    /**
     * Queues multiple cookies to be set on the outgoing response.
     *
     * @param {Array<{key: string; value: string; options?: Bun.CookieInit}>} cookies - The cookies to set, each with a key, value, and optional attributes.
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    setCookies(cookies) {
        for (const cookie of cookies) {
            this.cookies.set(cookie.key, cookie.value, cookie.options);
        }
        return this;
    }
    /**
     * Queues a single cookie to be deleted (expired) on the outgoing response.
     *
     * @param {string} key - The cookie name to delete.
     * @param {Pick<Bun.CookieInit, "domain" | "path">} options - Optional `domain`/`path` to scope the deletion to.
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    deleteCookie(key, options) {
        if (options)
            this.cookies.delete(key, options);
        else
            this.cookies.delete(key);
        return this;
    }
    /**
     * Queues multiple cookies to be deleted (expired) on the outgoing response.
     *
     * @param {Array<{key: string; options?: Pick<Bun.CookieInit, "domain" | "path">}>} cookies - The cookies to delete, each with a key and optional `domain`/`path` scoping.
     * @returns {ResponseBuilder} This builder, for chaining.
     */
    deleteCookies(cookies) {
        for (const cookie of cookies) {
            if (cookie.options)
                this.cookies.delete(cookie.key, cookie.options);
            else
                this.cookies.delete(cookie.key);
        }
        return this;
    }
    /**
     * Builds and returns the final JSON HTTP response, combining `data`,
     * `message`, `status`, and any custom fields into the response body,
     * with CORS headers and any queued cookies applied.
     *
     * @returns {Bejibun.Response} The built `Response` object.
     */
    send() {
        return globalThis.Response.json({
            data: this.data,
            message: this.message,
            status: this.status,
            ...this.custom
        }, {
            headers: this.applyCookies({
                ...CorsLoader.cors
            }),
            status: this.status
        });
    }
    /**
     * Builds and returns a streamed file response (using the value
     * set via `setData()` as the file path), with CORS headers
     * and any queued cookies applied.
     *
     * @param {ResponseInit} options - Additional `ResponseInit` options to merge in.
     * @returns {Bejibun.Response} The built streaming `Response` object.
     */
    stream(options = {}) {
        return new globalThis.Response(Bun.file(this.data), {
            ...options,
            headers: this.applyCookies({
                ...CorsLoader.cors
            }),
            status: this.status
        });
    }
    /**
     * Appends every queued cookie (sets and deletions) as `Set-Cookie`
     * headers onto the given base headers.
     *
     * @param {Record<string, string>} headers - The base headers to extend.
     * @returns {Headers} A `Headers` instance including the base headers plus every queued cookie.
     */
    applyCookies(headers) {
        const responseHeaders = new Headers(headers);
        for (const setCookieHeader of this.cookies.toSetCookieHeaders()) {
            responseHeaders.append("Set-Cookie", setCookieHeader);
        }
        return responseHeaders;
    }
}
