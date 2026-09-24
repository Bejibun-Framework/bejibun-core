import App from "@bejibun/app";
import Response from "../facades/Response.js";
/**
 * Middleware that short-circuits every request with the configured
 * maintenance message/status while the application is in maintenance
 * mode (see `App.Maintenance`), returning the maintenance response
 * before reaching the handler.
 * Enabled globally via `performance.middlewares.maintenance` in `server.ts`.
 */
export default class MaintenanceMiddleware {
    /**
     * Wraps the handler with a maintenance-mode check.
     *
     * @param {HandlerType} handler - The handler to guard.
     * @returns {HandlerType} The maintenance-aware handler.
     */
    handle(handler) {
        return async (request, server) => {
            if (await App.Maintenance.isMaintenanceMode()) {
                const maintenance = await App.Maintenance.getData();
                return Response.setMessage(maintenance.message)
                    .setStatus(maintenance.status)
                    .send();
            }
            return handler(request, server);
        };
    }
}
