import App from "@bejibun/app";
import fs from "fs";
import RuntimeException from "../exceptions/RuntimeException.js";
/**
 * Side-effect-only import (via `bootstrap.ts`) that installs the `config()`
 * and `env()` global functions declared in `@/types/global.d.ts`.
 */
/**
 * Global `config(key, defaultValue)` implementation. Resolves a
 * dot-notated key (e.g. `"database.connections.mysql"`) against the
 * matching `config/<file>.ts` module, where the first segment names the
 * file and the rest walks into its default export.
 */
globalThis.config = (key, defaultValue = null) => {
    const keys = key.split(".");
    if (keys.length === 0)
        throw new RuntimeException("Invalid key config.");
    const filename = keys.shift();
    const configPath = App.Path.configPath(`${filename}.ts`);
    if (!fs.existsSync(configPath))
        throw new RuntimeException("Invalid config path.");
    const config = require(configPath).default;
    let value = config;
    for (const segment of keys) {
        if (value && typeof value === "object" && segment in value) {
            value = value[segment];
        }
        else {
            return defaultValue;
        }
    }
    return value;
};
/**
 * Global `env(key, defaultValue)` implementation. Thin wrapper around
 * `Bun.env`, falling back to `defaultValue` when the variable is unset.
 */
globalThis.env = (key, defaultValue = null) => Bun.env[key] || defaultValue;
