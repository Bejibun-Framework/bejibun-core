/**
 * Shared, allocation-free implementations of the fluent `request.*` helpers.
 *
 * Every method reads its state from `this` (the `Bejibun.Request` instance)
 * and is defined ONCE at module scope. `RouterBuilder.attachRequestHelpers`
 * attaches this table to each incoming request via `Object.assign()`, so no
 * closures are allocated per request -- the 36 helper functions are shared.
 *
 * The `server` that dispatched the request is registered per request in the
 * `REQUEST_SERVERS` WeakMap (only `ip()` needs it), so helpers stay closure-free.
 */
import { validatePayload } from "./validate";
/**
 * Associates each incoming request with the Bun server that dispatched it,
 * so `ip()` can resolve the client address without a per-request closure.
 */
export const RequestServers = new WeakMap();
/**
 * Normalizes a single key or array of keys into a flat array of keys,
 * used by the payload-inspecting helpers (`only`, `except`, `has`,
 * `hasAny`, `filled`, `missing`).
 *
 * @param {string | Array<string>} keys - A single key or array of keys.
 * @returns {Array<string>} The normalized key list.
 */
export function toArrayKeys(keys) {
    return Array.isArray(keys) ? keys : [keys];
}
/**
 * The shared helper method table attached to every `Bejibun.Request`.
 * Each entry reads its state from `this` and never captures per-request
 * values in a closure.
 */
export const RequestWrapper = {
    /**
     * Retrieves a header value by name (case-insensitive), with
     * an optional fallback when the header is absent.
     *
     * @param {string} key - The header name.
     * @param {string} [defaultValue] - Optional fallback value when the header is missing.
     * @returns {string | undefined} The header value, the fallback, or `undefined`.
     */
    header(key, defaultValue) {
        return this.headers.get(key) || defaultValue;
    },
    /**
     * Determines if the given header is present on the request.
     *
     * @param {string} key - The header name.
     * @returns {boolean} True if the header is present; otherwise false.
     */
    hasHeader(key) {
        return this.header(key) !== undefined;
    },
    /**
     * Retrieves the bearer token from the `Authorization` header, if any.
     *
     * @returns {string | undefined} The bearer token, or `undefined` when absent.
     */
    bearerToken() {
        const authorization = this.header("authorization") || "";
        return authorization.toLowerCase().startsWith("bearer ")
            ? authorization.slice(7).trim()
            : undefined;
    },
    /**
     * Retrieves a cookie value by name.
     *
     * @param {string} key - The cookie name.
     * @returns {string | undefined} The cookie value, or `undefined` when absent.
     */
    cookie(key) {
        return this.cookies?.get(key) || undefined;
    },
    /**
     * Retrieves the `User-Agent` header value, if any.
     *
     * @returns {string | undefined} The user-agent value, or `undefined` when absent.
     */
    userAgent() {
        return this.header("user-agent");
    },
    /**
     * Retrieves the requesting client's IP address, when resolvable
     * via the Bun server instance.
     *
     * @returns {string | undefined} The client IP address, or `undefined` when unresolvable.
     */
    ip() {
        return RequestServers.get(this)?.requestIP(this)?.address;
    },
    /**
     * Retrieves the pathname portion of the request URL, without query string.
     *
     * @returns {string} The request path.
     */
    path() {
        return new URL(this.url).pathname;
    },
    /**
     * Retrieves the full request URL, including query string.
     *
     * @returns {string} The full request URL.
     */
    fullUrl() {
        return this.url;
    },
    /**
     * Determines if the request path matches any of the given
     * `*`-wildcard patterns.
     *
     * @param {Array<string>} patterns - The `*`-wildcard patterns to match against.
     * @returns {boolean} True if the path matches any pattern; otherwise false.
     */
    is(...patterns) {
        const path = this.path().replace(/^\/+/, "");
        return patterns.some((pattern) => {
            const normalized = pattern.replace(/^\/+/, "");
            const regex = new RegExp(`^${normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
            return regex.test(path);
        });
    },
    /**
     * Determines if the request's HTTP method matches the given
     * method, case-insensitively.
     *
     * @param {string} method - The HTTP method to compare against (e.g. `get`, `post`).
     * @returns {boolean} True if the methods match; otherwise false.
     */
    isMethod(method) {
        return this.method.toLowerCase() === method.toLowerCase();
    },
    /**
     * Determines if the request is made over HTTPS.
     *
     * @returns {boolean} True when the protocol is `https:`; otherwise false.
     */
    secure() {
        return new URL(this.url).protocol.toLowerCase() === "https:";
    },
    /**
     * Determines if the request is made via `XMLHttpRequest`
     * (`X-Requested-With` header).
     *
     * @returns {boolean} True for XHR requests; otherwise false.
     */
    ajax() {
        return (this.header("x-requested-with") || "").toLowerCase() === "xmlhttprequest";
    },
    /**
     * Determines if the request's `Accept` header indicates it
     * wants a JSON response.
     *
     * @returns {boolean} True when JSON is accepted; otherwise false.
     */
    wantsJson() {
        return (this.header("accept") || "").toLowerCase().includes("json");
    },
    /**
     * Determines if the request expects JSON - true when it's
     * either an AJAX request or wants JSON explicitly.
     *
     * @returns {boolean} True when the request expects JSON; otherwise false.
     */
    expectsJson() {
        return this.ajax() || this.wantsJson();
    },
    /**
     * Retrieves every key currently present in the payload.
     *
     * @returns {Array<string>} The list of payload keys.
     */
    keys() {
        return Object.keys(this.payload);
    },
    /**
     * Retrieves the entire payload as a key-value map.
     *
     * @returns {Record<string, any>} The full payload object.
     */
    all() {
        return this.payload;
    },
    /**
     * Determines if the payload contains every one of the given
     * keys, regardless of emptiness.
     *
     * @param {string | Array<string>} keys - A single key or array of keys to check.
     * @returns {boolean} True if all keys are present; otherwise false.
     */
    has(keys) {
        return toArrayKeys(keys).every((key) => {
            return Object.prototype.hasOwnProperty.call(this.payload, key);
        });
    },
    /**
     * Determines if the payload contains at least one of the given keys.
     *
     * @param {string | Array<string>} keys - A single key or array of keys to check.
     * @returns {boolean} True if at least one key is present; otherwise false.
     */
    hasAny(keys) {
        return toArrayKeys(keys).some((key) => {
            return Object.prototype.hasOwnProperty.call(this.payload, key);
        });
    },
    /**
     * Determines if the given key(s) are present in the payload
     * and not empty.
     *
     * @param {string | Array<string>} keys - A single key or array of keys to check.
     * @returns {boolean} True if all keys are present and non-empty; otherwise false.
     */
    filled(keys) {
        return toArrayKeys(keys).every((key) => {
            const value = this.get(key);
            return value !== undefined && value !== null && value !== "";
        });
    },
    /**
     * Determines if the given key(s) are absent from the payload.
     *
     * @param {string | Array<string>} keys - A single key or array of keys to check.
     * @returns {boolean} True if none of the keys are present; otherwise false.
     */
    missing(keys) {
        return toArrayKeys(keys).every((key) => {
            return !Object.prototype.hasOwnProperty.call(this.payload, key);
        });
    },
    /**
     * Retrieves the entire payload, or a single value with a
     * fallback default when missing.
     *
     * @param {string} [key] - When given, returns only this key's value.
     * @param {any} [defaultValue] - Optional fallback when the key is missing/empty.
     * @returns {any} The full payload (no key), or the key's value/fallback.
     */
    input(key, defaultValue) {
        if (!key)
            return this.payload;
        const value = this.get(key);
        return value === undefined || value === null || value === "" ? defaultValue : value;
    },
    /**
     * Retrieves only the given payload keys.
     *
     * @param {string | Array<string>} keys - A single key or array of keys to include.
     * @returns {Record<string, any>} The payload subset containing only the given keys.
     */
    only(keys) {
        const result = {};
        for (const key of toArrayKeys(keys)) {
            if (Object.prototype.hasOwnProperty.call(this.payload, key))
                result[key] = this.payload[key];
        }
        return result;
    },
    /**
     * Retrieves the payload without the given keys.
     *
     * @param {string | Array<string>} keys - A single key or array of keys to exclude.
     * @returns {Record<string, any>} The payload with the given keys omitted.
     */
    except(keys) {
        const excluded = new Set(toArrayKeys(keys));
        const result = {};
        for (const [key, value] of Object.entries(this.payload)) {
            if (!excluded.has(key))
                result[key] = value;
        }
        return result;
    },
    /**
     * Merges the given values into the existing payload, leaving
     * other keys untouched.
     *
     * @param {Record<string, any>} values - The key-value pairs to merge in.
     */
    merge(values) {
        if (!this.payload)
            this.payload = {};
        Object.assign(this.payload, values);
    },
    /**
     * Replaces the entire payload with the given values,
     * discarding any existing data.
     *
     * @param {Record<string, any>} values - The key-value pairs to set as the new payload.
     */
    replace(values) {
        this.payload = { ...values };
    },
    /**
     * Retrieves a raw value from the payload by key.
     *
     * @param {string} key - The payload key.
     * @returns {any} The raw value, or `undefined` when absent.
     */
    get(key) {
        return this.payload?.[key];
    },
    /**
     * Sets a value on the payload by key.
     *
     * @param {string} key - The payload key to set.
     * @param {any} value - The value to store.
     */
    set(key, value) {
        if (!this.payload)
            this.payload = {};
        this.payload[key] = value;
    },
    /**
     * Retrieves a payload value coerced to an array.
     *
     * @param {string} key - The payload key.
     * @returns {Array<any>} The value as an array (single values wrapped).
     */
    array(key) {
        const value = this.get(key);
        return Array.isArray(value) ? value : [value];
    },
    /**
     * Retrieves a payload value coerced to a boolean.
     *
     * @param {string} key - The payload key.
     * @returns {boolean} True when the value is `true`, `"true"`, `"1"`, or `1`; otherwise false.
     */
    boolean(key) {
        const value = this.get(key);
        return value === true || value === "true" || value === "1" || value === 1;
    },
    /**
     * Retrieves a payload value coerced to a floating-point number.
     *
     * @param {string} key - The payload key.
     * @returns {number} The parsed float, or `0` when not a number.
     */
    float(key) {
        const value = parseFloat(this.get(key));
        return Number.isNaN(value) ? 0 : value;
    },
    /**
     * Retrieves a payload value coerced to an integer.
     *
     * @param {string} key - The payload key.
     * @returns {number} The parsed integer, or `0` when not a number.
     */
    integer(key) {
        const value = parseInt(this.get(key), 10);
        return Number.isNaN(value) ? 0 : value;
    },
    /**
     * Retrieves a payload value coerced to an object.
     *
     * @param {string} key - The payload key.
     * @returns {object} The value as an object, or `{}` when not an object.
     */
    object(key) {
        const value = this.get(key);
        return typeof value === "object" && value !== null ? value : {};
    },
    /**
     * Retrieves a payload value coerced to a string.
     *
     * @param {string} key - The payload key.
     * @returns {string} The value as a string, or `""` when `undefined`/`null`.
     */
    string(key) {
        const value = this.get(key);
        return value === undefined || value === null ? "" : String(value);
    },
    /**
     * Retrieves an uploaded file from the payload by key.
     *
     * @param {string} key - The payload key.
     * @returns {File | undefined} The uploaded file, or `undefined` when absent.
     */
    file(key) {
        const value = this.get(key);
        return value instanceof File ? value : undefined;
    },
    /**
     * Determines if an uploaded file is present in the payload
     * for the given key.
     *
     * @param {string} key - The payload key.
     * @returns {boolean} True if a file is present; otherwise false.
     */
    hasFile(key) {
        return this.file(key) instanceof File;
    },
    /**
     * Validates the request payload against a Vine validator.
     *
     * @param {Bejibun.Validator} validator - The Vine validator definition.
     * @returns {Promise<any>} The validated and type-coerced data.
     * @throws {ValidatorException} When validation fails (HTTP 422).
     */
    validate(validator) {
        return validatePayload(validator, this.payload);
    }
};
