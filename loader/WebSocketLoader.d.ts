import BaseWebSocket from "../bases/BaseWebSocket.js";
/**
 * Registry of discovered WebSocket handler classes, populated by
 * `Kernel.registerWebSockets()` and consumed by `server.ts` to dispatch
 * incoming WebSocket messages to the correct controller.
 */
export default class WebSocketLoader {
    /** Every registered WebSocket handler class. */
    static controllers: Array<BaseWebSocket>;
    /**
     * Registers a WebSocket handler class.
     *
     * @param {BaseWebSocket} schedule - The WebSocket handler class to register.
     */
    static add(schedule: BaseWebSocket): void;
}
