import type {ApiDocConfig} from "../decorators/ApiDocDecorator.js";
import type {BejibunRequest} from "./request.d.ts";
import {SchemaTypes, VineValidator} from "@vinejs/vine";

declare global {
    /**
     * Retrieves a configuration value by key.
     *
     * @param {string} key - The dot-notated (or plain) key identifying the config value to retrieve.
     * @param {T} defaultValue - The value to return if the config key is not found.
     * @returns {T} The configuration value associated with the key, or defaultValue if not found.
     */
    function config<T = any>(key: string, defaultValue?: T): T;

    /**
     * Retrieves an environment variable value by key.
     *
     * @param {string} key - The name of the environment variable to retrieve.
     * @param {T} defaultValue - The value to return if the environment variable is not set.
     * @returns {T} The environment variable value, or defaultValue if not set.
     */
    function env<T = any>(key: string, defaultValue?: T): T;

    /**
     * Class method decorator that attaches OpenAPI documentation metadata
     * to a controller action, stored via `reflect-metadata` and read back
     * by `RouterBuilder.resolveControllerString()` when the route is
     * resolved. Registered globally by `Kernel.registerDecorator()`
     * (aliased from `ApiDocDecorator`).
     *
     * @param {ApiDocConfig} config - The OpenAPI metadata (description, params, responses, etc.) to attach.
     */
    function ApiDoc(config: ApiDocConfig): any;

    namespace Bejibun {
        /**
         * The extended Bun request type available on every route handler,
         * carrying the payload accessors and request helpers
         * attached by `RouterBuilder.attachRequestHelpers()`. Defaults to
         * an untyped path (`params: Record<string, string>`); pass a
         * literal path type to get typed route params, mirroring Bun's
         * own `BunRequest<Path>`.
         */
        type Request<Path extends string = string> = BejibunRequest<Path>;

        /**
         * A VineJS validator instance used to validate and type-check
         * incoming request payloads. Wraps `VineValidator` from
         * `@vinejs/vine`, scoped to schemas returning a plain object
         * (or `undefined`) shape, suitable for validating request
         * bodies, query params, or other structured input.
         */
        type Validator = VineValidator<SchemaTypes, Record<string, any> | undefined>;

        /**
         * The framework response type returned by helpers and middleware
         * that produce HTTP responses. Alias of the standard Web
         * `Response`, so all standard properties (status, headers, body,
         * `json()`, etc.) are available directly.
         */
        type Response = globalThis.Response;
    }
}

export {};
