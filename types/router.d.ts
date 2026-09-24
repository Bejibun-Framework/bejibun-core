import type {ApiDocConfig} from "../decorators/ApiDocDecorator.js";
import type {IMiddleware} from "./middleware.d.ts";

/** A resolved route handler function, as ultimately registered with Bun's router. */
export type HandlerType = (request: Bejibun.Request, server: Bun.Server<any>) => Promise<Response>;

/** A map of HTTP method name (e.g. `"GET"`) to its resolved handler, for a single path. */
export type RouterMethodMap = Record<string, HandlerType>;

/** A path -> (method map | nested group) tree, as produced by `RouterBuilder.group()`/`applyGroup()`. */
export type RouterGroup = Record<string, RouterMethodMap | RouterGroup>;

/**
 * The unresolved definition of a single route, capturing everything
 * needed to (re-)resolve its handler later - used internally while
 * routes are being grouped/prefixed/re-namespaced, before final
 * serialization.
 */
export type RawRoute = {
    /** The path prefix this route was defined under. */
    prefix: string;

    /** The middleware chain to apply to this route's handler. */
    middlewares: Array<IMiddleware>;

    /** The controller namespace/directory to resolve a string handler from. */
    namespace: string;

    /** OpenAPI documentation metadata for this route, from `@ApiDoc(...)`. */
    apiDoc: ApiDocConfig;

    /** The HTTP method this route responds to (empty for websocket routes). */
    method: string;

    /** The route's path. */
    path: string;

    /** True if this is a WebSocket upgrade route rather than a regular HTTP route. */
    websocket?: boolean;

    /** A `"Controller@method"` string or a direct handler function. */
    handler: string | HandlerType;
};

/** A single route, carrying both its raw (still-mutable) definition and its serialized `RouterGroup` form. */
export type Route = {
    /** The unresolved route definition. */
    raw: RawRoute;

    /** The route serialized into `{ path: { METHOD: handler } }` form. */
    route: RouterGroup;
};

/** A collection of raw routes alongside their already-grouped `RouterGroup` forms - the shape returned by `RouterBuilder.group()` when raw routes are involved. */
export type RawsRoute = {
    /** The individual raw routes making up this group. */
    raws: Array<Route>;

    /** The corresponding serialized route groups. */
    routes: Array<RouterGroup>;
};

/** The five actions registered by `RouterBuilder.resource()`. */
export type ResourceAction = "index" | "store" | "show" | "update" | "destroy";

export type ResourceOptions = {
    /** Whitelist of resource actions to register - all others are skipped. */
    only?: Array<ResourceAction>;

    /** Blacklist of resource actions to skip - everything else is registered. */
    except?: Array<ResourceAction>;
};
