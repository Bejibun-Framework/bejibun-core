import type { TFacilitator, TRoutePayment } from "@bejibun/x402/types";
import type { IMiddleware } from "../types/middleware.d.ts";
import type { HandlerType, ResourceOptions, RouterGroup } from "../types/router.d.ts";
import HttpMethodEnum from "@bejibun/utils/enums/HttpMethodEnum";
import BaseController from "../bases/BaseController.js";
import RouterBuilder from "../builders/RouterBuilder.js";
import { Route } from "../types/router.d.ts";
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
    static prefix(basePath: string): RouterBuilder;
    /**
     * Starts a new builder with the given middleware stack.
     *
     * @param {Array<IMiddleware>} middlewares - The middleware instances to add.
     * @returns {RouterBuilder} A new builder with the middleware applied.
     */
    static middleware(...middlewares: Array<IMiddleware>): RouterBuilder;
    /**
     * Starts a new builder with the given controller namespace.
     *
     * @param {string} baseNamespace - The namespace/directory controllers are resolved from.
     * @returns {RouterBuilder} A new builder with the namespace applied.
     */
    static namespace(baseNamespace: string): RouterBuilder;
    /**
     * Starts a new builder with x402 payment-gated middleware attached.
     *
     * @param {TFacilitator} facilitator - Optional payment facilitator configuration.
     * @param {TRoutePayment} routePayment - Optional per-route payment requirements.
     * @returns {RouterBuilder} A new builder with the x402 middleware applied.
     */
    static x402(facilitator?: TFacilitator, routePayment?: TRoutePayment): RouterBuilder;
    /**
     * Registers RESTful CRUD routes for a controller.
     *
     * @param {string} path - The base resource path (e.g. `/users`).
     * @param {typeof BaseController} controller - The controller class providing the resource actions.
     * @param {ResourceOptions} options - Optional `only`/`except` action filters.
     * @returns {RouterGroup} The resulting route group.
     */
    static resource(path: string, controller: typeof BaseController, options?: ResourceOptions): RouterGroup;
    /**
     * Groups one or more routes/route groups together.
     *
     * @param {Route | Array<Route> | RouterGroup} routes - The route(s) or group(s) to combine.
     * @returns {RouterGroup | Array<RouterGroup>} The merged route group (or an array of groups).
     */
    static group(routes: Route | Array<Route> | RouterGroup): RouterGroup | Array<RouterGroup>;
    /**
     * Registers a `CONNECT` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static connect(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `DELETE` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static delete(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `GET` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static get(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `HEAD` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static head(path: string, handler: string | HandlerType): Route;
    /**
     * Registers an `OPTIONS` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static options(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `PATCH` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static patch(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `POST` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static post(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `PUT` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static put(path: string, handler: string | HandlerType): Route;
    /**
     * Registers a `TRACE` route.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {Route} The built route.
     */
    static trace(path: string, handler: string | HandlerType): Route;
    /**
     * Registers the same path/handler for multiple HTTP methods.
     *
     * @param {Array<HttpMethodEnum>} methods - The HTTP methods to register.
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {RouterGroup} The merged route group covering all given methods.
     */
    static match(methods: Array<HttpMethodEnum>, path: string, handler: string | HandlerType): RouterGroup;
    /**
     * Registers a route that responds to every HTTP method.
     *
     * @param {string} path - The route path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {RouterGroup} The merged route group covering every HTTP method.
     */
    static any(path: string, handler: string | HandlerType): RouterGroup;
    /**
     * Registers a WebSocket upgrade route.
     *
     * @param {string} path - The websocket path.
     * @param {string | HandlerType} handler - The controller definition (`"Controller@method"`) or handler function.
     * @returns {RouterGroup} The resulting route group.
     */
    static websocket(path: string, handler: string | HandlerType): RouterGroup;
    /**
     * Flattens routes/route groups into a single serialized route map.
     *
     * @param {Route | Array<Route> | RouterGroup | Array<RouterGroup>} routes - The route(s) or group(s) to flatten.
     * @returns {RouterGroup} The flattened route map.
     */
    static serialize(routes: Route | Array<Route> | RouterGroup | Array<RouterGroup>): RouterGroup;
}
