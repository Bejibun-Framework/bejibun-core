import App from "@bejibun/app";
import path from "path";
import BaseModel from "./bases/BaseModel.js";
import RuntimeException from "./exceptions/RuntimeException.js";
import Schedule from "./facades/Schedule.js";
import WebSocketLoader from "./loader/WebSocketLoader.js";
/**
 * Framework bootstrap kernel. Provides the static registration routines
 * invoked during application startup to wire up the Commander CLI,
 * cron-style schedulers, custom decorators, and WebSocket handlers -
 * all discovered by scanning the filesystem rather than requiring
 * manual imports.
 */
export default class Kernel {
    /**
     * Discovers and registers every Ace command with the given Commander
     * `program` instance.
     *
     * Scans three locations for command files: the application's own
     * `commands` directory, this package's bundled `commands` directory,
     * and `node_modules/@bejibun/database/commands`, plus any additional
     * package command paths declared in `config/command.ts`. Each
     * discovered file is required, instantiated, and skipped unless it
     * exposes both a `$signature` and a `handle()` method. Valid commands
     * are sorted alphabetically by signature and registered on `program`
     * with their options/arguments, wiring `handle()` as the action
     * callback and ensuring the DB connection (`BaseModel.knex()`) is
     * destroyed afterward regardless of success or failure.
     *
     * @param {Command} program - The Commander program to register commands on.
     */
    static registerCommands(program) {
        const rootCommands = require(App.Path.configPath("command.ts")).default;
        const paths = [
            {
                absolute: true,
                cwd: App.Path.commandsPath()
            },
            {
                absolute: true,
                cwd: path.resolve(__dirname, "commands")
            },
            {
                absolute: true,
                cwd: "node_modules/@bejibun/database/commands"
            }
        ].concat(rootCommands.map((value) => ({
            absolute: true,
            cwd: `node_modules/${value.path}`
        })));
        const files = paths
            .map((value) => Array.from(new Bun.Glob("**/*").scanSync({
            absolute: value.absolute,
            cwd: value.cwd
        })))
            .flat()
            .filter((value) => /\.(m?js|ts)$/.test(value) &&
            !value.endsWith(".d.ts") &&
            !value.includes("Kernel"));
        const instances = [];
        for (const file of files) {
            try {
                const { default: CommandClass } = require(file);
                const instance = new CommandClass();
                if (!instance.$signature || typeof instance.handle !== "function")
                    continue;
                instances.push(instance);
            }
            catch {
                // do nothing
            }
        }
        for (const instance of instances.sort((a, b) => a.$signature.localeCompare(b.$signature))) {
            const cmd = program
                .command(instance.$signature)
                .description(instance.$description || "");
            if (Array.isArray(instance.$options)) {
                for (const option of instance.$options) {
                    cmd.option(...option);
                }
            }
            if (Array.isArray(instance.$arguments)) {
                for (const argument of instance.$arguments) {
                    cmd.argument(...argument);
                }
            }
            cmd.action(async (...args) => {
                const commandObj = args[args.length - 1];
                const options = typeof commandObj.opts === "function" ? commandObj.opts() : commandObj;
                const positionalArgs = args[0];
                try {
                    await instance.handle(options, positionalArgs);
                }
                finally {
                    await BaseModel.knex().destroy();
                }
            });
        }
    }
    /**
     * Loads the application's `app/commands/Kernel.ts` (the user-defined
     * kernel, distinct from this framework `Kernel`), instantiates it,
     * and invokes its `schedule()` method with the `Schedule` facade so
     * the application can register its cron-style scheduled tasks.
     *
     * @throws {RuntimeException} If the application's Kernel class or its `schedule()` method can't be found.
     */
    static registerSchedulers() {
        const kernelPath = App.Path.commandsPath("Kernel.ts");
        const { default: Kernel } = require(kernelPath);
        if (!Kernel)
            throw new RuntimeException(`Kernel class not found [${kernelPath}].`);
        const instance = new Kernel();
        if (typeof instance.schedule !== "function")
            throw new RuntimeException(`Kernel class has no schedule function in [${kernelPath}].`);
        instance.schedule(Schedule);
    }
    /**
     * Scans this package's `decorators` directory and registers each
     * exported decorator function as a global, keyed by its function name
     * with the `Decorator` suffix stripped (e.g. `ApiDocDecorator` becomes
     * the global `ApiDoc`).
     */
    static registerDecorator() {
        const paths = [
            {
                absolute: true,
                cwd: path.resolve(__dirname, "decorators")
            }
        ];
        const files = paths
            .map((value) => Array.from(new Bun.Glob("**/*").scanSync({
            absolute: value.absolute,
            cwd: value.cwd
        })))
            .flat()
            .filter((value) => /\.(m?js|ts)$/.test(value) &&
            !value.endsWith(".d.ts") &&
            !value.includes("Kernel"));
        for (const file of files) {
            const { default: decorator } = require(file);
            if (typeof decorator !== "function")
                continue;
            if (decorator.name)
                globalThis[decorator.name.replace("Decorator", "")] = decorator;
        }
    }
    /**
     * Scans the application's `app/websockets` directory and registers
     * every discovered WebSocket handler class with `WebSocketLoader`, so
     * incoming upgrade requests can be routed to the correct handler.
     */
    static registerWebSockets() {
        const files = Array.from(new Bun.Glob("**/*").scanSync({
            absolute: true,
            cwd: App.Path.appPath("websockets")
        }))
            .flat()
            .filter((value) => /\.(m?js|ts)$/.test(value) && !value.endsWith(".d.ts"));
        for (const file of files) {
            const { default: WebSocketClass } = require(file);
            WebSocketLoader.add(WebSocketClass);
        }
    }
}
