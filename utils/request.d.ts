/**
 * Associates each incoming request with the Bun server that dispatched it,
 * so `ip()` can resolve the client address without a per-request closure.
 */
export declare const RequestServers: WeakMap<Bejibun.Request, Bun.Server<any>>;
/**
 * Normalizes a single key or array of keys into a flat array of keys.
 *
 * Used by the payload-inspecting helpers (`only`, `except`, `has`,
 * `hasAny`, `filled`, `missing`).
 *
 * @param {string | Array<string>} keys - A single key or array of keys.
 * @returns {Array<string>} The normalized key list.
 */
export declare function toArrayKeys(keys: string | Array<string>): Array<string>;
/**
 * Splits a payload key into path segments, tolerating Laravel-style bracket
 * notation and dot notation. Empty segments (from the `[]` append form) are
 * dropped.
 *
 * @param {string} key - The payload key to split.
 * @returns {Array<string>} The path segments, without empty entries.
 */
export declare function deepSegments(key: string): Array<string>;
/**
 * Deep-resolves a value from a (possibly nested) payload by key.
 *
 * Supports flat keys, dot notation, and bracket notation. Own keys are
 * matched verbatim first, so a literal `"order.date"` key stored by a flat
 * source (e.g. a JSON body) still wins over an `order.date` deep path.
 * Prototype-ish segments (`__proto__`, `constructor`, `prototype`) resolve
 * to `undefined` rather than leaking inherited values.
 *
 * @param {Record<string, any>} payload - The parsed request payload.
 * @param {string} key - The key to look up (flat, dot, or bracket notation).
 * @returns {any} The resolved value, or `undefined` when absent/blocked.
 */
export declare function resolvePayload(payload: Record<string, any>, key: string): any;
/**
 * Deep-presence check for a key that may use dot or bracket notation.
 *
 * Only *own* properties are considered present — inherited keys such as
 * `constructor` or `toString` never report true, even through deep paths.
 * Prototype-ish segments are treated as absent.
 *
 * @param {Record<string, any>} payload - The parsed request payload.
 * @param {string} key - The key to check (flat, dot, or bracket notation).
 * @returns {boolean} True when the key resolves to an own value.
 */
export declare function deepHas(payload: Record<string, any>, key: string): boolean;
/**
 * Assigns a raw query/form key/value pair into a nested payload structure by
 * unwrapping Laravel-style bracket keys.
 *
 * Numeric segments build arrays, named segments build objects, and the empty
 * `[]` segment appends to (or starts) an array. Prototype-ish segments are
 * silently ignored.
 *
 * @param {Record<string, any>} target - The payload being built.
 * @param {string} key - The key from `URLSearchParams`/`FormData`, possibly
 *   containing bracket segments.
 * @param {any} value - The raw string value to store.
 * @returns {void}
 */
export declare function deepSetPayload(target: Record<string, any>, key: string, value: any): void;
/**
 * The shared helper method table attached to every `Bejibun.Request`.
 * Each entry reads its state from `this` and never captures per-request
 * values in a closure.
 */
export declare const RequestWrapper: Record<string, any>;
