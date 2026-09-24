import type { TFacilitator, TRoutePayment } from "@bejibun/x402/types";
import type { HandlerType } from "../types/router.d.ts";
/**
 * Middleware that gates a route behind x402 payment verification, via the
 * optional `@bejibun/x402` package. Attached to a route through
 * `RouterBuilder.x402()`.
 */
export default class X402Middleware {
    /** The payment facilitator configuration for x402 payment verification and settlement. */
    protected facilitator?: TFacilitator;
    /** Per-route payment requirements (price, asset, etc.). */
    protected routePayment?: TRoutePayment;
    /**
     * @param {TFacilitator} facilitator - Optional payment facilitator configuration.
     * @param {TRoutePayment} routePayment - Optional per-route payment requirements.
     */
    constructor(facilitator?: TFacilitator, routePayment?: TRoutePayment);
    /**
     * Wraps the handler so the request must satisfy the configured x402
     * payment requirements before it's allowed to run.
     *
     * @param {HandlerType} handler - The handler to protect.
     * @returns {HandlerType} The payment-gated handler.
     */
    handle(handler: HandlerType): HandlerType;
}
