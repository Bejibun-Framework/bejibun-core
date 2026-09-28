import type {EnumItem} from "@bejibun/utils/types";
import type {TFacilitator, TRoutePayment} from "@bejibun/x402/types";
import type {ApiDocConfig} from "@/decorators/ApiDocDecorator";
import type {IMiddleware} from "@/types/middleware";
import type {
    HandlerType,
    RawsRoute,
    ResourceAction,
    Route,
    RouterGroup,
    RouterMethodMap
} from "@/types/router";
import App from "@bejibun/app";
import Logger from "@bejibun/logger";
import {defineValue, isEmpty, isModuleExists, isNotEmpty} from "@bejibun/utils";
import HttpMethodEnum from "@bejibun/utils/enums/HttpMethodEnum";
import Enum from "@bejibun/utils/facades/Enum";
import "reflect-metadata";
import BaseController from "@/bases/BaseController";
import {ApiDocDecoratorKey} from "@/decorators/ApiDocDecorator";
import RouterException from "@/exceptions/RouterException";

export interface ResourceOptions {
    only?: Array<ResourceAction>;
    except?: Array<ResourceAction>;
}

export default class RouterBuilder {
    protected basePath: string = "";
    protected middlewares: Array<IMiddleware> = [];
    protected baseNamespace: string = "app/controllers";
    protected apiDoc: ApiDocConfig = {
        description: "",
        deprecated: false,
        request: {
            params: []
        },
        response: {}
    };

    public prefix(basePath: string): RouterBuilder {
        this.basePath = basePath;

        return this;
    }

    public middleware(...middlewares: Array<IMiddleware>): RouterBuilder {
        this.middlewares.push(...middlewares);

        return this;
    }

    public namespace(baseNamespace: string): RouterBuilder {
        this.baseNamespace = baseNamespace;

        return this;
    }

    public x402(facilitator?: TFacilitator, routePayment?: TRoutePayment): RouterBuilder {
        if (!isModuleExists("@bejibun/x402")) throw new RouterException("@bejibun/x402 is not installed.");

        const X402Middleware = require("@/middlewares/X402Middleware").default;
        this.middlewares.push(new X402Middleware(facilitator, routePayment));

        return this;
    }

    public group(routes: Route | Array<Route> | RouterGroup): RouterGroup | Array<RouterGroup> {
        const rawGroups: Array<Route> = [];
        let routeGroups: RouterGroup = {};

        if (this.hasRaws(routes)) {
            const routeList: Array<RawsRoute | Route | RouterGroup> = Array.isArray(routes) ? routes.flat() : [routes];
            const routerGroups: Array<RouterGroup> = routeList.filter((value: Route | RouterGroup) => !this.hasRaws(value) && !this.hasRaw(value));
            const rawRoutes: Array<Route> = routeList.filter((value: Route | RouterGroup) => this.hasRaws(value)).map((value: RawsRoute) => value.raws).flat();
            const newRoutes: Record<string, any> = {};

            for (const route of rawRoutes) {
                const middlewares: Array<IMiddleware> = this.middlewares.concat(defineValue(route.raw.middlewares, []));
                const effectiveNamespace: string = route.raw.websocket ?
                    defineValue("app/websockets", route.raw.namespace) :
                    defineValue(this.baseNamespace, route.raw.namespace);
                const cleanPath: string = this.joinPaths(defineValue(route.raw.prefix, this.basePath), route.raw.path);

                let resolvedHandler: HandlerType = typeof route.raw.handler === "string" ?
                    this.resolveControllerString(route.raw.handler, effectiveNamespace, route.raw.websocket ? {
                        path: cleanPath
                    } : undefined) :
                    route.raw.handler;

                for (const middleware of [...middlewares].reverse()) {
                    resolvedHandler = middleware.handle(resolvedHandler);
                }

                if (isEmpty(newRoutes[cleanPath])) newRoutes[cleanPath] = {};

                if (isEmpty(route.raw.method)) {
                    newRoutes[cleanPath] = resolvedHandler;
                } else {
                    Object.assign(newRoutes[cleanPath], {
                        [route.raw.method]: resolvedHandler
                    });
                }

                route.raw.middlewares = middlewares;
                route.raw.namespace = effectiveNamespace;
                route.raw.path = cleanPath;

                rawGroups.push(route);
            }

            routeGroups = Object.assign(
                {},
                ...routerGroups.map((value: RouterGroup) => this.applyGroup(value)),
                newRoutes
            );
        }

        if (this.hasRaw(routes)) {
            const routeList: Array<Route | RouterGroup> = Array.isArray(routes) ? routes.flat() : [routes];
            const routerGroups: Array<RouterGroup> = routeList.filter((value: Route | RouterGroup) => !this.hasRaws(value) && !this.hasRaw(value));
            const rawRoutes: Array<Route> = routeList.filter((value: Route | RouterGroup) => this.hasRaw(value));
            const newRoutes: Record<string, any> = {};

            for (const route of rawRoutes) {
                const middlewares: Array<IMiddleware> = this.middlewares.concat(defineValue(route.raw.middlewares, []));
                const effectiveNamespace: string = route.raw.websocket ?
                    defineValue("app/websockets", route.raw.namespace) :
                    defineValue(this.baseNamespace, route.raw.namespace);
                const cleanPath: string = this.joinPaths(defineValue(route.raw.prefix, this.basePath), route.raw.path);

                let resolvedHandler: HandlerType = typeof route.raw.handler === "string" ?
                    this.resolveControllerString(route.raw.handler, effectiveNamespace, route.raw.websocket ? {
                        path: cleanPath
                    } : undefined) :
                    route.raw.handler;

                for (const middleware of [...middlewares].reverse()) {
                    resolvedHandler = middleware.handle(resolvedHandler);
                }

                if (isEmpty(newRoutes[cleanPath])) newRoutes[cleanPath] = {};

                if (isEmpty(route.raw.method)) {
                    newRoutes[cleanPath] = resolvedHandler;
                } else {
                    Object.assign(newRoutes[cleanPath], {
                        [route.raw.method]: resolvedHandler
                    });
                }

                route.raw.middlewares = middlewares;
                route.raw.namespace = effectiveNamespace;
                route.raw.path = cleanPath;

                rawGroups.push(route);
            }

            routeGroups = Object.assign(
                {},
                ...routerGroups.map((value: RouterGroup) => this.applyGroup(value)),
                newRoutes
            );
        }

        if (isNotEmpty(routeGroups)) return {
            raws: rawGroups,
            routes: routeGroups
        };

        if (isEmpty(routes)) return {};

        if (Array.isArray(routes)) {
            return routes.map((value: RawsRoute | Route | RouterGroup) => {
                if (isNotEmpty(value.raws)) return value.raws;

                return value;
            })
                .flat()
                .map((route: RouterGroup | Route) => this.applyGroup(route));
        }

        return this.applyGroup(routes);
    }

    public resource(path: string, controller: typeof BaseController, options?: ResourceOptions): RouterGroup {
        const ClassController: any = new controller();
        const cleanPath: string = this.joinPaths(this.basePath, path);

        const allRoutes: Record<string, Record<string, ResourceAction>> = {
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

        const includedActions: Set<ResourceAction> = this.resolveIncludedActions(options);

        const raws: Array<Route> = [];
        const routes: RouterGroup = {};

        for (const path in allRoutes) {
            const methods: Record<string, string> = allRoutes[path];
            const methodMap: RouterMethodMap = {};

            for (const method in methods) {
                const action: string = methods[method];
                let handler: any = ClassController[action];

                if (includedActions.has(action as ResourceAction) && isNotEmpty(handler)) {
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

    public buildSingle(method: HttpMethodEnum, path: string, handler: string | HandlerType): Route {
        const cleanPath: string = this.joinPaths(this.basePath, path);

        let resolvedHandler: HandlerType = typeof handler === "string" ?
            this.resolveControllerString(handler) :
            handler;

        for (const middleware of [...this.middlewares].reverse()) {
            resolvedHandler = middleware.handle(resolvedHandler);
        }

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

    public connect(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Connect, path, handler);
    }

    public delete(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Delete, path, handler);
    }

    public get(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Get, path, handler);
    }

    public head(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Head, path, handler);
    }

    public options(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Options, path, handler);
    }

    public patch(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Patch, path, handler);
    }

    public post(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Post, path, handler);
    }

    public put(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Put, path, handler);
    }

    public trace(path: string, handler: string | HandlerType): Route {
        return this.buildSingle(HttpMethodEnum.Trace, path, handler);
    }

    public match(methods: Array<HttpMethodEnum>, path: string, handler: string | HandlerType): RouterGroup {
        const routers: Array<Route> = [];

        for (const method of methods) {
            routers.push(this.buildSingle(method, path, handler));
        }

        return this.group(routers);
    }

    public any(path: string, handler: string | HandlerType): RouterGroup {
        return this.match(Enum.setEnums(HttpMethodEnum).toArray().map((value: EnumItem) => value.value), path, handler);
    }

    public websocket(path: string, handler: string | HandlerType): Route {
        const cleanPath: string = this.joinPaths(this.basePath, path);

        let resolvedHandler: any = (request: Bun.BunRequest, server: Bun.Server<any>) => {
            server.upgrade(request, {
                data: {
                    id: Bun.randomUUIDv7(),
                    path: cleanPath
                } as any
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

    public serialize(routes: Route | Array<Route> | RouterGroup | Array<RouterGroup> | Array<RawsRoute>): RouterGroup {
        if (Array.isArray(routes)) {
            if (this.hasRaw(routes)) routes = routes.map((value: Route) => value.route);
            if (this.hasRaws(routes)) routes = (routes as any).map((value: any) => value.routes).flat();
        } else {
            if (this.hasRaw(routes)) routes = routes.route;
            if (this.hasRaws(routes)) routes = routes.routes;
        }

        const mergedRoutes = this.mergeRoutes(routes);

        if (Array.isArray(mergedRoutes)) return Object.assign({}, ...mergedRoutes);

        return mergedRoutes;
    }

    private mergeRoutes(routes: RouterGroup | Array<RouterGroup>): RouterGroup {
        const merged: RouterGroup = {};

        const routeEntries = Array.isArray(routes) ?
            routes :
            Object.entries(routes).map(([path, methods]) => ({
                [path]: methods
            }));

        for (const route of routeEntries) {
            for (const [path, methods] of Object.entries(route)) {
                if (isEmpty(merged[path])) merged[path] = {};

                for (const [method, handler] of Object.entries(methods as RouterMethodMap)) {
                    if (isNotEmpty(merged[path][method])) Logger.setContext("Router").warn(`Duplicate route: ${method} ${path} - overwriting.`);

                    merged[path][method] = handler;
                }
            }
        }

        return merged;
    }

    private joinPaths(base: string, path: string): string {
        base = base.replace(/\/+$/, "");
        path = path.replace(/^\/+/, "");

        return `/${[base, path].filter(Boolean).join("/")}`;
    }

    private resolveControllerString(definition: string, overrideNamespace?: string, websocket?: Record<string, any>): HandlerType {
        const [controllerName, methodName] = definition.split("@");

        if (isEmpty(controllerName) || isEmpty(methodName)) {
            throw new RouterException(`Invalid router controller definition: ${definition}.`);
        }

        const controllerPath = App.Path.rootPath(defineValue(overrideNamespace, this.baseNamespace));
        let location: any = null;

        try {
            location = Bun.resolveSync(`./${controllerName}.ts`, controllerPath);
        } catch {
            return async () => {
                throw new RouterException(`Invalid router for controller location [${controllerPath}]`);
            };
        }

        let ControllerClass: any;

        try {
            ControllerClass = require(location).default;

            if (isNotEmpty(websocket)) ControllerClass.path = (websocket as any)?.path;

            this.apiDoc = Reflect.getMetadata(ApiDocDecoratorKey, ControllerClass.prototype, methodName);
        } catch {
            return async (...args: Array<any>) => {
                const module = await import(location);
                const ESMController = module.default;

                if (isNotEmpty(websocket)) ESMController.path = (websocket as any)?.path;

                this.apiDoc = Reflect.getMetadata(ApiDocDecoratorKey, ESMController.prototype, methodName);

                const instance = new ESMController();

                if (typeof instance[methodName] !== "function") {
                    throw new RouterException(`Method "${methodName}" not found in ${controllerName}.`);
                }

                return instance[methodName](...args);
            };
        }

        if (isEmpty(ControllerClass)) {
            throw new RouterException(`Controller not found: ${controllerName}.`);
        }

        const instance = new ControllerClass();

        if (typeof instance[methodName] !== "function") {
            throw new RouterException(`Method "${methodName}" not found in ${controllerName}.`);
        }

        return instance[methodName].bind(instance);
    }

    private resolveIncludedActions(options?: ResourceOptions): Set<ResourceAction> {
        const all: Array<ResourceAction> = ["index", "store", "show", "update", "destroy"];

        if (options?.only) {
            return new Set(options.only);
        }

        if (options?.except) {
            return new Set(all.filter(action => !options.except!.includes(action)));
        }

        return new Set(all);
    }

    private hasRaw(routes: RawsRoute | Array<RawsRoute> | Route | Array<Route> | RouterGroup): routes is Route {
        if (Array.isArray(routes)) return routes.flat().some(route => isNotEmpty(route) && "raw" in route);

        return (
            isNotEmpty(routes) &&
            typeof routes === "object" &&
            "raw" in routes
        );
    }

    private hasRaws(routes: RawsRoute | Array<RawsRoute> | Route | Array<Route> | RouterGroup): routes is RawsRoute {
        if (Array.isArray(routes)) return routes.flat().some(route => isNotEmpty(route) && "raws" in route);

        return (
            isNotEmpty(routes) &&
            typeof routes === "object" &&
            "raws" in routes
        );
    }

    private isMethodMap(value: any): value is RouterMethodMap {
        return (
            isNotEmpty(value) &&
            typeof value === "object" &&
            Object.values(value).every((v: any) => typeof v === "function")
        );
    }

    private applyGroup(route: RouterGroup | Route): RouterGroup {
        if (isEmpty(route)) return route;

        if (this.hasRaw(route)) {
            const routeList: Array<Route | RouterGroup> = Array.isArray(route) ? route.flat() : [route];
            const rawRoutes: Array<Route> = routeList.filter((value: Route | RouterGroup) => this.hasRaw(value));
            const newRoutes: Record<string, any> = {};
            const rawGroups: Array<Route> = [];

            for (const route of rawRoutes) {
                const middlewares: Array<IMiddleware> = route.raw.middlewares.concat(defineValue(this.middlewares, []));
                const cleanPath: string = this.joinPaths(defineValue(route.raw.prefix, this.basePath), route.raw.path);
                const effectiveNamespace: string = route.raw.websocket ?
                    defineValue(
                        this.baseNamespace === "app/websockets" ?
                            null :
                            this.baseNamespace,
                        route.raw.namespace
                    ) :
                    defineValue(
                        this.baseNamespace === "app/controllers" ?
                            null :
                            this.baseNamespace,
                        route.raw.namespace
                    );

                let resolvedHandler: HandlerType = typeof route.raw.handler === "string" ?
                    this.resolveControllerString(route.raw.handler, effectiveNamespace, route.raw.websocket ? {
                        path: cleanPath
                    } : undefined) :
                    route.raw.handler;

                for (const middleware of [...middlewares].reverse()) {
                    resolvedHandler = middleware.handle(resolvedHandler);
                }

                if (isEmpty(newRoutes[cleanPath])) newRoutes[cleanPath] = {};

                Object.assign(newRoutes[cleanPath], {
                    [route.raw.method]: resolvedHandler
                });

                route.raw.middlewares = middlewares;
                route.raw.namespace = effectiveNamespace;
                route.raw.path = cleanPath;

                rawGroups.push(route);
            }

            if (isNotEmpty(rawGroups)) return {
                raws: rawGroups,
                routes: newRoutes
            };

            return newRoutes;
        }

        const result: RouterGroup = {};

        for (const [key, value] of Object.entries(route)) {
            const newKey = key.startsWith("/") ? this.joinPaths(this.basePath, key) : key;

            if (this.isMethodMap(value)) {
                const wrappedMethods: RouterMethodMap = {};

                for (const [method, handler] of Object.entries(value)) {
                    let resolvedHandler: HandlerType = handler;

                    for (const middleware of [...this.middlewares].reverse()) {
                        resolvedHandler = middleware.handle(resolvedHandler);
                    }

                    wrappedMethods[method] = resolvedHandler;
                }

                result[newKey] = wrappedMethods;
                continue;
            }

            if (isNotEmpty(value) && typeof value === "object") {
                result[newKey] = this.applyGroup(value);
                continue;
            }

            result[newKey] = value;
        }

        return result;
    }
}