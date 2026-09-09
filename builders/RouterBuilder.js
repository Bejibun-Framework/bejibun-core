import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import { defineValue, isEmpty, isModuleExists, isNotEmpty } from "@bejibun/utils";
import HttpMethodEnum from "@bejibun/utils/enums/HttpMethodEnum";
import Enum from "@bejibun/utils/facades/Enum";
import "reflect-metadata";
import { ApiDocDecoratorKey } from "../decorators/ApiDocDecorator";
import RouterException from "../exceptions/RouterException";
import { RequestServers, RequestWrapper } from "../utils/request";
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
    basePath = "";
    /** The middleware stack applied to every route defined by this builder. */
    middlewares = [];
    /** The base directory used to resolve string-based controller handlers. */
    baseNamespace = "app/controllers";
    /** The API documentation metadata attached to the next resolved route. */
    apiDoc = {
        description: "",
        deprecated: false,
        request: {
            params: []
        },
        response: {}
    };
    /**
     * Sets the base path prepended to every route defined by this builder.
     *
     * @param {string} basePath - The path prefix (e.g. `/api/v1`).
     * @returns {RouterBuilder} This builder, for chaining.
     */
    prefix(basePath) {
        this.basePath = basePath;
        return this;
    }
    /**
     * Appends one or more middlewares to the stack applied to every route
     * defined by this builder. Middlewares run in the order given, wrapping
     * the handler from the outside in (last middleware pushed runs closest
     * to the handler).
     *
     * @param {Array<IMiddleware>} middlewares - The middleware instances to add.
     * @returns {RouterBuilder} This builder, for chaining.
     */
    middleware(...middlewares) {
        this.middlewares.push(...middlewares);
        return this;
    }
    /**
     * Sets the base controller namespace (directory) to resolve
     * string-based handlers (e.g. `"UserController@index"`).
     *
     * @param {string} baseNamespace - The namespace/directory controllers are resolved from.
     * @returns {RouterBuilder} This builder, for chaining.
     */
    namespace(baseNamespace) {
        this.baseNamespace = baseNamespace;
        return this;
    }
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
    x402(facilitator, routePayment) {
        if (!isModuleExists("@bejibun/x402"))
            throw new RouterException("@bejibun/x402 is not installed.");
        const X402Middleware = require("../middlewares/X402Middleware").default;
        this.middlewares.push(new X402Middleware(facilitator, routePayment));
        return this;
    }
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
    group(routes) {
        const rawGroups = [];
        let routeGroups = {};
        const compile = (rawRoutes, routerGroups) => {
            const newRoutes = {};
            for (const route of rawRoutes) {
                this.compileRawRoute(route, newRoutes, rawGroups);
            }
            routeGroups = Object.assign({}, ...routerGroups.map((value) => this.applyGroup(value)), newRoutes);
        };
        if (this.hasRaws(routes)) {
            const routeList = Array.isArray(routes)
                ? routes.flat()
                : [routes];
            const routerGroups = routeList.filter((value) => !this.hasRaws(value) && !this.hasRaw(value));
            const rawRoutes = routeList
                .filter((value) => this.hasRaws(value))
                .map((value) => value.raws)
                .flat();
            compile(rawRoutes, routerGroups);
        }
        if (this.hasRaw(routes)) {
            const routeList = Array.isArray(routes)
                ? routes.flat()
                : [routes];
            const routerGroups = routeList.filter((value) => !this.hasRaws(value) && !this.hasRaw(value));
            const rawRoutes = routeList.filter((value) => this.hasRaw(value));
            compile(rawRoutes, routerGroups);
        }
        if (isNotEmpty(routeGroups))
            return {
                raws: rawGroups,
                routes: routeGroups
            };
        if (isEmpty(routes))
            return {};
        if (Array.isArray(routes)) {
            return routes
                .map((value) => {
                if (isNotEmpty(value.raws))
                    return value.raws;
                return value;
            })
                .flat()
                .map((route) => this.applyGroup(route));
        }
        return this.applyGroup(routes);
    }
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
    compileRawRoute(route, newRoutes, rawGroups) {
        const middlewares = this.middlewares.concat(route.raw.middlewares || []);
        const effectiveNamespace = route.raw.websocket
            ? defineValue("app/websockets", route.raw.namespace)
            : defineValue(this.baseNamespace, route.raw.namespace);
        const cleanPath = this.joinPaths(route.raw.prefix || this.basePath, route.raw.path);
        let resolvedHandler = typeof route.raw.handler === "string"
            ? this.resolveControllerString(route.raw.handler, effectiveNamespace, route.raw.websocket
                ? {
                    path: cleanPath
                }
                : undefined)
            : route.raw.handler;
        for (const middleware of [...middlewares].reverse()) {
            resolvedHandler = middleware.handle(resolvedHandler);
        }
        if (!route.raw.websocket)
            resolvedHandler = this.attachRequestHelpers(resolvedHandler);
        if (!newRoutes[cleanPath])
            newRoutes[cleanPath] = {};
        if (!route.raw.method) {
            newRoutes[cleanPath] = resolvedHandler;
        }
        else {
            Object.assign(newRoutes[cleanPath], {
                [route.raw.method]: resolvedHandler
            });
        }
        route.raw.middlewares = middlewares;
        route.raw.namespace = effectiveNamespace;
        route.raw.path = cleanPath;
        rawGroups.push(route);
    }
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
    resource(path, controller, options) {
        const ClassController = new controller();
        const cleanPath = this.joinPaths(this.basePath, path);
        const allRoutes = {
            [cleanPath]: {
                GET: "index",
                POST: "store"
            },
            [`${cleanPath}/:id`]: {
                GET: "show",
                PUT: "update",
                DELETE: "destroy"
            }
        };
        const includedActions = this.resolveIncludedActions(options);
        const raws = [];
        const routes = {};
        for (const path in allRoutes) {
            const methods = allRoutes[path];
            const methodMap = {};
            for (const method in methods) {
                const action = methods[method];
                const handler = ClassController[action];
                if (includedActions.has(action) && handler) {
                    raws.push({
                        raw: {
                            prefix: this.basePath,
                            middlewares: [],
                            namespace: this.baseNamespace,
                            apiDoc: this.apiDoc,
                            method,
                            path,
                            handler
                        },
                        route: {
                            [path]: {
                                [method]: handler
                            }
                        }
                    });
                }
            }
            if (Object.keys(methodMap).length > 0) {
                routes[path] = methodMap;
            }
        }
        return this.applyGroup({
            raws,
            routes
        });
    }
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
    buildSingle(method, path, handler) {
        const cleanPath = this.joinPaths(this.basePath, path);
        let resolvedHandler = typeof handler === "string" ? this.resolveControllerString(handler) : handler;
        for (const middleware of [...this.middlewares].reverse()) {
            resolvedHandler = middleware.handle(resolvedHandler);
        }
        resolvedHandler = this.attachRequestHelpers(resolvedHandler);
        return {
            raw: {
                prefix: this.basePath,
                middlewares: this.middlewares,
                namespace: this.baseNamespace,
                apiDoc: this.apiDoc,
                method,
                path,
                handler
            },
            route: {
                [cleanPath]: {
                    [method]: resolvedHandler
                }
            }
        };
    }
    /**
     * Registers a `CONNECT` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    connect(path, handler) {
        return this.buildSingle(HttpMethodEnum.Connect, path, handler);
    }
    /**
     * Registers a `DELETE` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    delete(path, handler) {
        return this.buildSingle(HttpMethodEnum.Delete, path, handler);
    }
    /**
     * Registers a `GET` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    get(path, handler) {
        return this.buildSingle(HttpMethodEnum.Get, path, handler);
    }
    /**
     * Registers a `HEAD` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    head(path, handler) {
        return this.buildSingle(HttpMethodEnum.Head, path, handler);
    }
    /**
     * Registers an `OPTIONS` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    options(path, handler) {
        return this.buildSingle(HttpMethodEnum.Options, path, handler);
    }
    /**
     * Registers a `PATCH` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    patch(path, handler) {
        return this.buildSingle(HttpMethodEnum.Patch, path, handler);
    }
    /**
     * Registers a `POST` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    post(path, handler) {
        return this.buildSingle(HttpMethodEnum.Post, path, handler);
    }
    /**
     * Registers a `PUT` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    put(path, handler) {
        return this.buildSingle(HttpMethodEnum.Put, path, handler);
    }
    /**
     * Registers a `TRACE` route.
     *
     * @param {string} path - Route path.
     * @param {string | HandlerType} handler - Controller string or handler function.
     * @returns {Route} The built route.
     */
    trace(path, handler) {
        return this.buildSingle(HttpMethodEnum.Trace, path, handler);
    }
    /**
     * Registers the same path/handler for multiple HTTP methods at once.
     *
     * @param {Array<HttpMethodEnum>} methods - The HTTP methods to register the route under.
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - A `"Controller@method"` string or a handler function.
     * @returns {RouterGroup} The merged route group covering all given methods.
     */
    match(methods, path, handler) {
        const routers = [];
        for (const method of methods) {
            routers.push(this.buildSingle(method, path, handler));
        }
        return this.group(routers);
    }
    /**
     * Registers a route that responds to every HTTP method.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - A `"Controller@method"` string or a handler function.
     * @returns {RouterGroup} The merged route group covering every HTTP method.
     */
    any(path, handler) {
        return this.match(Enum.setEnums(HttpMethodEnum)
            .toArray()
            .map((value) => value.value), path, handler);
    }
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
    websocket(path, handler) {
        const cleanPath = this.joinPaths(this.basePath, path);
        let resolvedHandler = (request, server) => {
            server.upgrade(request, {
                data: {
                    id: Bun.randomUUIDv7(),
                    path: cleanPath
                }
            });
        };
        for (const middleware of [...this.middlewares].reverse()) {
            resolvedHandler = middleware.handle(resolvedHandler);
        }
        return {
            raw: {
                prefix: this.basePath,
                middlewares: this.middlewares,
                namespace: "app/websockets",
                apiDoc: this.apiDoc,
                method: "",
                path,
                websocket: true,
                handler
            },
            route: {
                [cleanPath]: resolvedHandler
            }
        };
    }
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
    serialize(routes) {
        if (Array.isArray(routes)) {
            if (this.hasRaw(routes))
                routes = routes.map((value) => value.route);
            if (this.hasRaws(routes))
                routes = routes.map((value) => value.routes).flat();
        }
        else {
            if (this.hasRaw(routes))
                routes = routes.route;
            if (this.hasRaws(routes))
                routes = routes.routes;
        }
        const mergedRoutes = this.mergeRoutes(routes);
        if (Array.isArray(mergedRoutes))
            return Object.assign({}, ...mergedRoutes);
        return mergedRoutes;
    }
    /**
     * Merges an array (or single object) of `RouterGroup` path maps into
     * one, warning (via `Logger`) and overwriting when the same
     * `METHOD path` combination is registered more than once.
     *
     * @param {RouterGroup | Array<RouterGroup>} routes - The route group(s) to merge.
     * @returns {RouterGroup} The merged route group.
     */
    mergeRoutes(routes) {
        const merged = {};
        const routeEntries = Array.isArray(routes)
            ? routes
            : Object.entries(routes).map(([path, methods]) => ({
                [path]: methods
            }));
        for (const route of routeEntries) {
            for (const [path, methods] of Object.entries(route)) {
                if (!merged[path])
                    merged[path] = {};
                for (const [method, handler] of Object.entries(methods)) {
                    if (merged[path][method])
                        Logger.setContext("Router").warn(`Duplicate route: ${method} ${path} - overwriting.`);
                    merged[path][method] = handler;
                }
            }
        }
        return merged;
    }
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
    attachRequestHelpers(handler) {
        return (request, server) => {
            if (!request.payload)
                request.payload = {};
            RequestServers.set(request, server);
            Object.assign(request, RequestWrapper);
            return handler(request, server);
        };
    }
    /**
     * Joins a base path and a relative path into a single normalized,
     * leading-slash path, collapsing duplicate/trailing slashes.
     *
     * @param {string} base - The base path (e.g. the current prefix).
     * @param {string} path - The relative path to append.
     * @returns {string} The joined, normalized path (e.g. `/api/users`).
     */
    joinPaths(base, path) {
        base = base.replace(/\/+$/, "");
        path = path.replace(/^\/+/, "");
        return `/${[base, path].filter(Boolean).join("/")}`;
    }
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
    resolveControllerString(definition, overrideNamespace, websocket) {
        const [controllerName, methodName] = definition.split("@");
        if (!controllerName || !methodName) {
            throw new RouterException(`Invalid router controller definition: ${definition}.`);
        }
        const controllerPath = App.Path.rootPath(overrideNamespace || this.baseNamespace);
        let location = null;
        try {
            location = Bun.resolveSync(`./${controllerName}.ts`, controllerPath);
        }
        catch {
            return async () => {
                throw new RouterException(`Invalid router for controller location [${controllerPath}]`);
            };
        }
        let ControllerClass;
        try {
            ControllerClass = require(location).default;
            if (websocket)
                ControllerClass.path = websocket?.path;
            this.apiDoc = Reflect.getMetadata(ApiDocDecoratorKey, ControllerClass.prototype, methodName);
        }
        catch {
            return async (...args) => {
                const module = await import(location);
                const ESMController = module.default;
                if (websocket)
                    ESMController.path = websocket?.path;
                this.apiDoc = Reflect.getMetadata(ApiDocDecoratorKey, ESMController.prototype, methodName);
                const instance = new ESMController();
                if (typeof instance[methodName] !== "function") {
                    throw new RouterException(`Method "${methodName}" not found in ${controllerName}.`);
                }
                return instance[methodName](...args);
            };
        }
        if (!ControllerClass) {
            throw new RouterException(`Controller not found: ${controllerName}.`);
        }
        const instance = new ControllerClass();
        if (typeof instance[methodName] !== "function") {
            throw new RouterException(`Method "${methodName}" not found in ${controllerName}.`);
        }
        return instance[methodName].bind(instance);
    }
    /**
     * Resolves which resource actions (`index`, `store`, `show`, `update`,
     * `destroy`) should be registered by `resource()`, based on the
     * `only`/`except` options.
     *
     * @param {ResourceOptions} options - Optional `only`/`except` action filters.
     * @returns {Set<ResourceAction>} The set of resource actions to register. Defaults to all five when no filter is given.
     */
    resolveIncludedActions(options) {
        const all = ["index", "store", "show", "update", "destroy"];
        if (options?.only) {
            return new Set(options.only);
        }
        if (options?.except) {
            return new Set(all.filter((action) => !options.except.includes(action)));
        }
        return new Set(all);
    }
    /**
     * Type guard: determines whether the given value is a single unresolved
     * `Route` (or array containing one) - i.e. has a `raw` property.
     *
     * @param {RawsRoute | Array<RawsRoute> | Route | Array<Route> | RouterGroup} routes - The value to check.
     * @returns {boolean} True if `routes` is (or contains) a `Route` with a `raw` property.
     */
    hasRaw(routes) {
        if (Array.isArray(routes))
            return routes.flat().some((route) => isNotEmpty(route) && "raw" in route);
        return isNotEmpty(routes) && typeof routes === "object" && "raw" in routes;
    }
    /**
     * Type guard: determines whether the given value is an already-grouped
     * `RawsRoute` (or array containing one) - i.e. has a `raws` property.
     *
     * @param {RawsRoute | Array<RawsRoute> | Route | Array<Route> | RouterGroup} routes - The value to check.
     * @returns {boolean} True if `routes` is (or contains) a `RawsRoute` with a `raws` property.
     */
    hasRaws(routes) {
        if (Array.isArray(routes))
            return routes.flat().some((route) => isNotEmpty(route) && "raws" in route);
        return isNotEmpty(routes) && typeof routes === "object" && "raws" in routes;
    }
    /**
     * Type guard: determines whether the given value is a `RouterMethodMap`
     * - a plain object whose every value is a handler function (e.g.
     * `{ GET: handler, POST: handler }`), as opposed to a nested `RouterGroup`.
     *
     * @param {any} value - The value to check.
     * @returns {boolean} True if every property of `value` is a function.
     */
    isMethodMap(value) {
        return (isNotEmpty(value) &&
            typeof value === "object" &&
            Object.keys(value).length > 0 &&
            Object.values(value).every((v) => typeof v === "function"));
    }
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
    applyGroup(route) {
        if (isEmpty(route))
            return route;
        if (this.hasRaw(route)) {
            const routeList = Array.isArray(route)
                ? route.flat()
                : [route];
            const rawRoutes = routeList.filter((value) => this.hasRaw(value));
            const newRoutes = {};
            const rawGroups = [];
            for (const route of rawRoutes) {
                const middlewares = route.raw.middlewares.concat(this.middlewares || []);
                const cleanPath = this.joinPaths(route.raw.prefix || this.basePath, route.raw.path);
                const effectiveNamespace = route.raw.websocket
                    ? defineValue(this.baseNamespace === "app/websockets" ? null : this.baseNamespace, route.raw.namespace)
                    : defineValue(this.baseNamespace === "app/controllers" ? null : this.baseNamespace, route.raw.namespace);
                let resolvedHandler = typeof route.raw.handler === "string"
                    ? this.resolveControllerString(route.raw.handler, effectiveNamespace, route.raw.websocket
                        ? {
                            path: cleanPath
                        }
                        : undefined)
                    : route.raw.handler;
                for (const middleware of [...middlewares].reverse()) {
                    resolvedHandler = middleware.handle(resolvedHandler);
                }
                if (!route.raw.websocket)
                    resolvedHandler = this.attachRequestHelpers(resolvedHandler);
                if (!newRoutes[cleanPath])
                    newRoutes[cleanPath] = {};
                Object.assign(newRoutes[cleanPath], {
                    [route.raw.method]: resolvedHandler
                });
                route.raw.middlewares = middlewares;
                route.raw.namespace = effectiveNamespace;
                route.raw.path = cleanPath;
                rawGroups.push(route);
            }
            if (rawGroups.length > 0)
                return {
                    raws: rawGroups,
                    routes: newRoutes
                };
            return newRoutes;
        }
        const result = {};
        for (const [key, value] of Object.entries(route)) {
            const newKey = key.startsWith("/") ? this.joinPaths(this.basePath, key) : key;
            if (this.isMethodMap(value)) {
                const wrappedMethods = {};
                for (const [method, handler] of Object.entries(value)) {
                    let resolvedHandler = handler;
                    for (const middleware of [...this.middlewares].reverse()) {
                        resolvedHandler = middleware.handle(resolvedHandler);
                    }
                    resolvedHandler = this.attachRequestHelpers(resolvedHandler);
                    wrappedMethods[method] = resolvedHandler;
                }
                result[newKey] = wrappedMethods;
                continue;
            }
            if (value && typeof value === "object") {
                result[newKey] = this.applyGroup(value);
                continue;
            }
            result[newKey] = value;
        }
        return result;
    }
}
