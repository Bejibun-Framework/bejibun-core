import type { TFacilitator, TRoutePayment } from "@bejibun/x402/types";
import type { ApiDocConfig } from "../decorators/ApiDocDecorator";
import type { IMiddleware } from "../types/middleware";
import type { HandlerType, RawsRoute, ResourceOptions, Route, RouterGroup } from "../types/router";
import HttpMethodEnum from "@bejibun/utils/enums/HttpMethodEnum";
import "reflect-metadata";
import BaseController from "../bases/BaseController";
/**
 * Fluent builder for defining, grouping, and compiling application routes.
 *
 * Each instance accumulates a base path, middleware stack, and controller
 * namespace via its chained setters (`prefix`, `middleware`, `namespace`),
 * then exposes HTTP-verb methods (`get`, `post`, ...), `resource()` for
 * RESTful CRUD routes, and `websocket()` for upgrade routes. Individual
 * routes and route groups are combined with `group()` and finally flattened
 * into a plain `{ path: { METHOD: handler } }` map via `serialize()`,
 * which is what gets handed off to Bun's router.
 */
export default class RouterBuilder {
    /** The path prefix prepended to every route defined by this builder. */
    protected basePath: string;
    /** The middleware stack applied to every route defined by this builder. */
    protected middlewares: Array<IMiddleware>;
    /** The base directory used to resolve string-based controller handlers. */
    protected baseNamespace: string;
    /** The API documentation metadata attached to the next resolved route. */
    protected apiDoc: ApiDocConfig;
    /**
     * Sets the base path prepended to every route defined by this builder.
     *
     * @param {string} basePath - The path prefix (e.g. `/api/v1`).
     * @returns {RouterBuilder} This builder, for chaining.
     */
    prefix(basePath: string): RouterBuilder;
    /**
     * Appends one or more middlewares to the stack applied to every route
     * defined by this builder. Middlewares run in the order given, wrapping
     * the handler from the outside in (last middleware pushed runs closest
     * to the handler).
     *
     * @param {Array<IMiddleware>} middlewares - The middleware instances to add.
     * @returns {RouterBuilder} This builder, for chaining.
     */
    middleware(...middlewares: Array<IMiddleware>): RouterBuilder;
    /**
     * Sets the base controller namespace (directory) to resolve
     * string-based handlers (e.g. `"UserController@index"`).
     *
     * @param {string} baseNamespace - The namespace/directory controllers are resolved from.
     * @returns {RouterBuilder} This builder, for chaining.
     */
    namespace(baseNamespace: string): RouterBuilder;
    /**
     * Attaches x402 payment-gated middleware to every route defined by
     * this builder. Requires the optional `@bejibun/x402` package to be
     * installed.
     *
     * @param {TFacilitator} facilitator - Optional x402 payment facilitator configuration.
     * @param {TRoutePayment} routePayment - Optional per-route payment requirements.
     * @returns {RouterBuilder} This builder, for chaining.
     * @throws {RouterException} If `@bejibun/x402` is not installed.
     */
    x402(facilitator?: TFacilitator, routePayment?: TRoutePayment): RouterBuilder;
    /**
     * Groups one or more routes (or nested route groups) together, applying
     * this builder's current prefix, middleware stack, and namespace to
     * each. Accepts a single `Route`, an array of `Route`/`RouterGroup`
     * values, or an already-grouped `RouterGroup`, and normalizes them all
     * into a single merged group.
     *
     * Internally this resolves every raw route's handler, wraps it with the
     * effective middleware chain (plus `attachRequestHelpers`, unless it's
     * a websocket route), and rewrites its path/namespace/middlewares to
     * reflect the group's settings before merging everything into one
     * `RouterGroup`.
     *
     * @param {Route | Array<Route> | RouterGroup} routes - The route(s) or group(s) to combine.
     * @returns {RouterGroup | Array<RouterGroup>} The merged route group (or an array of groups, for array input without raw routes).
     */
    group(routes: Route | Array<Route> | RouterGroup): RouterGroup | Array<RouterGroup>;
    /**
     * Compiles a single raw route into the group's merged route map:
     * resolves the controller handler, applies the middleware stack,
     * attaches request helpers, registers the handler under its path/method,
     * and records the normalized route in the raw-groups list.
     *
     * @param {Route} route - The raw route to compile.
     * @param {Record<string, any>} newRoutes - The merged route map being built.
     * @param {Array<Route>} rawGroups - The accumulator of compiled raw routes.
     */
    private compileRawRoute;
    /**
     * Registers RESTful CRUD routes for a controller.
     * Generates:
     * - `GET {path}` -> `index`
     * - `POST {path}` -> `store`
     * - `GET {path}/:id` -> `show`
     * - `PUT {path}/:id` -> `update`
     * - `DELETE {path}/:id` -> `destroy`
     *
     * Only actions that exist as methods on the controller are registered;
     * `options.only`/`options.except` further narrow which actions apply.
     *
     * @param {string} path - The base resource path (e.g. `/users`).
     * @param {typeof BaseController} controller - The controller class providing the resource actions.
     * @param {ResourceOptions} options - Optional `only`/`except` action filters.
     * @returns {RouterGroup} The resulting route group.
     */
    resource(path: string, controller: typeof BaseController, options?: ResourceOptions): RouterGroup;
    /**
     * Builds a single-method route: resolves the handler (from a
     * `"Controller@method"` string or a direct function), wraps it with
     * this builder's middleware stack and `attachRequestHelpers`, and
     * returns both the raw route definition and its serialized form.
     *
     * This is the common implementation behind `get`, `post`, `put`, etc.
     *
     * @param {HttpMethodEnum} method - The HTTP method to register.
     * @param {string} path - The route path, relative to this builder's prefix.
     * @param {string | HandlerType} handler - A `"Controller@method"` string or a handler function.
     * @returns {Route} The built route.
     */
    buildSingle(method: HttpMethodEnum, path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `CONNECT` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    connect(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `DELETE` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    delete(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `GET` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    get(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `HEAD` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    head(path: string, handler: string | HandlerType): Route;
    /**
     * Registers an `OPTIONS` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    options(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `PATCH` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    patch(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `POST` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    post(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `PUT` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    put(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `TRACE` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    trace(path: string, handler: string | HandlerType): Route;
    /**
     * Registers the same path/handler for multiple HTTP methods at once.
     *
     * @param {Array<HttpMethodEnum>} methods - The HTTP methods to register the route under.
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - A `"Controller@method"` string or a handler function.
     * @returns {RouterGroup} The merged route group covering all given methods.
     */
    match(methods: Array<HttpMethodEnum>, path: string, handler: string | HandlerType): RouterGroup;
    /**
     * Registers a route that responds to every HTTP method.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - A `"Controller@method"` string or a handler function.
     * @returns {RouterGroup} The merged route group covering every HTTP method.
     */
    any(path: string, handler: string | HandlerType): RouterGroup;
    /**
     * Registers a WebSocket upgrade route. The handler itself just performs
     * the `server.upgrade()` call (tagging the connection with a random UUID
     * and the resolved path); actual message handling is expected to live
     * in a `BaseWebSocket` implementation resolved separately by `path`.
     *
     * Unlike HTTP routes, websocket handlers are NOT wrapped with
     * `attachRequestHelpers`, since there's no request/response payload
     * cycle once the connection is upgraded.
     *
     * @param {string} path - The route path clients connect to.
     * @param {string | HandlerType} handler - A `"Controller@method"` string or a handler function (resolves the associated websocket class).
     * @returns {Route} The built websocket route.
     */
    websocket(path: string, handler: string | HandlerType): Route;
    /**
     * Flattens routes/route groups produced by `group()`, `resource()`, or
     * the HTTP-verb builders into a single plain `{ path: { METHOD: handler } }`
     * map, ready to be passed to Bun's `routes` option.
     *
     * Unwraps `raw`/`raws` wrapper objects first (if present), then merges
     * everything via `mergeRoutes`, logging a warning for any duplicate
     * `METHOD path` combination (the later one wins).
     *
     * @param {Route | Array<Route> | RouterGroup | Array<RouterGroup> | Array<RawsRoute>} routes - The route(s)/group(s) to serialize.
     * @returns {RouterGroup} The flattened route map.
     */
    serialize(routes: Route | Array<Route> | RouterGroup | Array<RouterGroup> | Array<RawsRoute>): RouterGroup;
    /**
     * Merges an array (or single object) of `RouterGroup` path maps into
     * one, warning (via `Logger`) and overwriting when the same
     * `METHOD path` combination is registered more than once.
     *
     * @param {RouterGroup | Array<RouterGroup>} routes - The route group(s) to merge.
     * @returns {RouterGroup} The merged route group.
     */
    private mergeRoutes;
    /**
     * Wraps a handler so every request arriving at it has the predefined
     * Bejibun.Request accessor methods (`get`, `set`, `array`, `boolean`,
     * `float`, `integer`, `object`, `string`, plus the fluent
     * helpers - `input`, `all`, `keys`, `only`, `except`, `has`, `hasAny`,
     * `filled`, `missing`, `header`, `hasHeader`, `bearerToken`, `cookie`,
     * `ip`, `path`, `fullUrl`, `is`, `secure`, `userAgent`, `ajax`,
     * `wantsJson`, `expectsJson`, `file`, `hasFile`, `merge`, `replace`,
     * `isMethod`, and `validate`) available - regardless of whether
     * `RequestMiddleware` (or any other middleware) is attached to the route.
     *
     * Applied as the outermost wrap around every resolved handler, so it
     * runs before any user middleware and the controller itself. The
     * payload-based accessors read `request.payload` lazily at call time,
     * so it doesn't matter that `payload` may not be populated yet when
     * this wrapper runs - only that it's populated by the time
     * `request.integer(...)` etc. is actually called (typically by
     * `RequestMiddleware`, if attached).
     *
     * @param {HandlerType} handler - The handler to wrap with request helpers.
     * @returns {HandlerType} The handler wrapped with request helpers.
     */
    private attachRequestHelpers;
    /**
     * Joins a base path and a relative path into a single normalized,
     * leading-slash path, collapsing duplicate/trailing slashes.
     *
     * @param {string} base - The base path (e.g. the current prefix).
     * @param {string} path - The relative path to append.
     * @returns {string} The joined, normalized path (e.g. `/api/users`).
     */
    private joinPaths;
    /**
     * Resolves a `"Controller@method"` string definition into an actual
     * bound handler function.
     *
     * Tries a synchronous `require()` first (CommonJS/bundled controllers);
     * if that throws, falls back to a lazily-resolved dynamic `import()`
     * wrapper (for ESM-only controllers), so both module formats work
     * transparently. Also attaches `ApiDoc` metadata (via `reflect-metadata`)
     * for the resolved method, and - for websocket routes - stamps the
     * resolved controller class with the route's `path`.
     *
     * @param {string} definition - The `"Controller@method"` string to resolve.
     * @param {string} overrideNamespace - Namespace to resolve the controller from, if different from `this.baseNamespace`.
     * @param {Record<string, any>} websocket - When set, marks this as a websocket route and carries its resolved `path`.
     * @returns {HandlerType} The resolved, bound handler function.
     * @throws {RouterException} If the definition is malformed, the controller can't be found, or the method doesn't exist on it.
     */
    private resolveControllerString;
    /**
     * Resolves which resource actions (`index`, `store`, `show`, `update`,
     * `destroy`) should be registered by `resource()`, based on the
     * `only`/`except` options.
     *
     * @param {ResourceOptions} options - Optional `only`/`except` action filters.
     * @returns {Set<ResourceAction>} The set of resource actions to register. Defaults to all five when no filter is given.
     */
    private resolveIncludedActions;
    /**
     * Type guard: determines whether the given value is a single unresolved
     * `Route` (or array containing one) - i.e. has a `raw` property.
     *
     * @param {RawsRoute | Array<RawsRoute> | Route | Array<Route> | RouterGroup} routes - The value to check.
     * @returns {boolean} True if `routes` is (or contains) a `Route` with a `raw` property.
     */
    private hasRaw;
    /**
     * Type guard: determines whether the given value is an already-grouped
     * `RawsRoute` (or array containing one) - i.e. has a `raws` property.
     *
     * @param {RawsRoute | Array<RawsRoute> | Route | Array<Route> | RouterGroup} routes - The value to check.
     * @returns {boolean} True if `routes` is (or contains) a `RawsRoute` with a `raws` property.
     */
    private hasRaws;
    /**
     * Type guard: determines whether the given value is a `RouterMethodMap`
     * - a plain object whose every value is a handler function (e.g.
     * `{ GET: handler, POST: handler }`), as opposed to a nested `RouterGroup`.
     *
     * @param {any} value - The value to check.
     * @returns {boolean} True if every property of `value` is a function.
     */
    private isMethodMap;
    /**
     * Recursively applies this builder's current prefix, middleware stack,
     * and namespace to a `RouterGroup` (or a single raw `Route`).
     *
     * For raw routes: resolves the handler, applies the effective
     * middleware chain plus `attachRequestHelpers` (unless it's a
     * websocket route), rewrites the path/namespace, and re-wraps the
     * result as `{ raws, routes }`.
     *
     * For plain nested groups: rewrites any path keys starting with `/`
     * against `this.basePath`, wraps any method maps found with the
     * middleware stack + `attachRequestHelpers`, and recurses into any
     * further nested groups.
     *
     * @param {RouterGroup | Route} route - The route or route group to apply this builder's settings to.
     * @returns {RouterGroup} The resulting, fully-resolved route group.
     */
    private applyGroup;
}
