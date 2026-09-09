/**
 * Associates each incoming request with the Bun server that dispatched it,
 * so `ip()` can resolve the client address without a per-request closure.
 */
export declare const RequestServers: WeakMap<Bejibun.Request, Bun.Server<any>>;
/**
 * Normalizes a single key or array of keys into a flat array of keys,
 * used by the payload-inspecting helpers (`only`, `except`, `has`,
 * `hasAny`, `filled`, `missing`).
 *
 * @param {string | Array<string>} keys - A single key or array of keys.
 * @returns {Array<string>} The normalized key list.
 */
export declare function toArrayKeys(keys: string | Array<string>): Array<string>;
/**
 * The shared helper method table attached to every `Bejibun.Request`.
 * Each entry reads its state from `this` and never captures per-request
 * values in a closure.
 */
export declare const RequestWrapper: Record<string, any>;
