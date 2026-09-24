import type { HandlerType } from "../types/router.d.ts";
/**
 * Middleware that rate-limits requests per client IP, using `@bejibun/limiter`.
 * Falls back to the package's bundled `LimiterConfig` when the application
 * hasn't provided its own `config/limiter.ts`. Enabled globally via
 * `performance.middlewares.limiter` in `server.ts`.
 */
export default class RateLimiterMiddleware {
    /**
     * Wraps the handler with a per-IP rate limit check, keyed by the
     * requesting client's IP address (converted to a filesystem-safe key
     * via `Str.ipToFileName`).
     *
     * @param {HandlerType} handler - The handler to rate-limit.
     * @returns {HandlerType} The rate-limited handler.
     */
    handle(handler: HandlerType): HandlerType;
}
