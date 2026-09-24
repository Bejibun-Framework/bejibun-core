import RouterBuilder from "../builders/RouterBuilder.js";
/**
 * Static facade over `RouterBuilder`. Every method here creates a fresh
 * `RouterBuilder` instance and immediately forwards to the matching
 * builder method - this is the entry point route files typically use
 * (e.g. `Router.get(...)`, `Router.prefix(...).group([...])`), rather
 * than instantiating `RouterBuilder` directly.
 */
export default class Router {
    /**
     * Starts a new builder with the given base path prefix.
     *
     * @param {string} basePath - The path prefix (e.g. `/api/v1`).
     * @returns {RouterBuilder} A new builder with the prefix applied.
     */
    static prefix(basePath) {
        return new RouterBuilder().prefix(basePath);
    }
    /**
     * Starts a new builder with the given middleware stack.
     *
     * @param {Array<IMiddleware>} middlewares - The middleware instances to add.
     * @returns {RouterBuilder} A new builder with the middleware applied.
     */
    static middleware(...middlewares) {
        return new RouterBuilder().middleware(...middlewares);
    }
    /**
     * Starts a new builder with the given controller namespace.
     *
     * @param {string} baseNamespace - The namespace/directory controllers are resolved from.
     * @returns {RouterBuilder} A new builder with the namespace applied.
     */
    static namespace(baseNamespace) {
        return new RouterBuilder().namespace(baseNamespace);
    }
    /**
     * Starts a new builder with x402 payment-gated middleware attached.
     *
     * @param {TFacilitator} facilitator - Optional payment facilitator configuration.
     * @param {TRoutePayment} routePayment - Optional per-route payment requirements.
     * @returns {RouterBuilder} A new builder with the x402 middleware applied.
     */
    static x402(facilitator, routePayment) {
        return new RouterBuilder().x402(facilitator, routePayment);
    }
    /**
     * Registers RESTful CRUD routes for a controller.
     *
     * @param {string} path - The base resource path (e.g. `/users`).
     * @param {typeof BaseController} controller - The controller class providing the resource actions.
     * @param {ResourceOptions} options - Optional `only`/`except` action filters.
     * @returns {RouterGroup} The resulting route group.
     */
    static resource(path, controller, options) {
        return new RouterBuilder().resource(path, controller, options);
    }
    /**
     * Groups one or more routes/route groups together.
     *
     * @param {Route | Array<Route> | RouterGroup} routes - The route(s) or group(s) to combine.
     * @returns {RouterGroup | Array<RouterGroup>} The merged route group (or an array of groups).
     */
    static group(routes) {
        return new RouterBuilder().group(routes);
    }
    /**
     * Registers a `CONNECT` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static connect(path, handler) {
        return new RouterBuilder().connect(path, handler);
    }
    /**
     * Registers a `DELETE` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static delete(path, handler) {
        return new RouterBuilder().delete(path, handler);
    }
    /**
     * Registers a `GET` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static get(path, handler) {
        return new RouterBuilder().get(path, handler);
    }
    /**
     * Registers a `HEAD` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static head(path, handler) {
        return new RouterBuilder().head(path, handler);
    }
    /**
     * Registers an `OPTIONS` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static options(path, handler) {
        return new RouterBuilder().options(path, handler);
    }
    /**
     * Registers a `PATCH` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static patch(path, handler) {
        return new RouterBuilder().patch(path, handler);
    }
    /**
     * Registers a `POST` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static post(path, handler) {
        return new RouterBuilder().post(path, handler);
    }
    /**
     * Registers a `PUT` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static put(path, handler) {
        return new RouterBuilder().put(path, handler);
    }
    /**
     * Registers a `TRACE` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static trace(path, handler) {
        return new RouterBuilder().trace(path, handler);
    }
    /**
     * Registers the same path/handler for multiple HTTP methods.
     *
     * @param {Array<HttpMethodEnum>} methods - The HTTP methods to register.
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {RouterGroup} The merged route group covering all given methods.
     */
    static match(methods, path, handler) {
        return new RouterBuilder().match(methods, path, handler);
    }
    /**
     * Registers a route that responds to every HTTP method.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {RouterGroup} The merged route group covering every HTTP method.
     */
    static any(path, handler) {
        return new RouterBuilder().any(path, handler);
    }
    /**
     * Registers a WebSocket upgrade route.
     *
     * @param {string} path - The websocket path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {RouterGroup} The resulting route group.
     */
    static websocket(path, handler) {
        return new RouterBuilder().websocket(path, handler);
    }
    /**
     * Flattens routes/route groups into a single serialized route map.
     *
     * @param {Route | Array<Route> | RouterGroup | Array<RouterGroup>} routes - The route(s) or group(s) to flatten.
     * @returns {RouterGroup} The flattened route map.
     */
    static serialize(routes) {
        return new RouterBuilder().serialize(routes);
    }
}
