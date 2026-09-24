import type { HandlerType } from "../types/router";
/**
 * Middleware that parses the incoming request body/query/route params
 * into a single `request.payload` map, which every accessor attached by
 * `RouterBuilder.attachRequestHelpers()` (`get`, `input`, `all`,
 * `only`, `validate`, etc.) reads from.
 *
 * Query and form string pairs are unwrapped into nested structures using
 * Laravel-style bracket notation: `origin_cities[0][id]=668` becomes
 * `payload.origin_cities = [{ id: "668" }]`, and `items[]=a&items[]=b`
 * becomes `payload.items = ["a", "b"]`. Prototype-ish segments
 * (`__proto__`, `constructor`, `prototype`) are dropped to prevent global
 * prototype pollution.
 *
 * Every accessor reads from `request.payload` via deep key resolution, so
 * array query params work on GET routes without extra parsing.
 *
 * Applied globally in `server.ts` (ahead of the application's routes), so
 * every route handler can rely on `request.payload` being populated by
 * the time it runs.
 *
 * Merge order (later sources overwrite earlier ones on key collision):
 * 1. Parsed JSON body (`Content-Type: application/json`)
 * 2. Route params (`request.params`)
 * 3. URL query string params
 * 4. Parsed form data (`multipart/form-data` or `application/x-www-form-urlencoded`) - including uploaded `File` values
 * 5. Raw request body text, stored under the `plainText` key
 *
 * Any parsing failure is swallowed silently, leaving `payload` as whatever
 * data is successfully collected before the error.
 */
export default class RequestMiddleware {
    /**
     * Wraps the handler so `request.payload` is populated before it runs.
     *
     * @param {HandlerType} handler - The handler to wrap.
     * @returns {HandlerType} The payload-populating handler.
     */
    handle(handler: HandlerType): HandlerType;
    /**
     * Async path: reads the request body/query/route params into a single
     * flat `request.payload`, then invokes the handler. Only reached when
     * the request actually carries a body, a query string, route params,
     * or a non-GET method -- see `handle` for the synchronous fast path.
     */
    private parseAndContinue;
}
