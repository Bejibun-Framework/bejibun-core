import App from "@bejibun/app";
import Str from "@bejibun/utils/facades/Str";
import { program } from "commander";
import os from "os";
import Kernel from "./Kernel.js";
import { version } from "package.json";
// Entry point for the `bun ace <command>` CLI, invoked directly by the
// `ace` binary. Boots the application's bootstrap.ts first (so DB, cors,
// and namespace loaders are initialized before any command runs), then
// configures and parses the Commander program.
await import(App.Path.rootPath("bootstrap.ts"));
/** The name of the CLI binary, used for help and version output. */
const commandExec = "ace";
program
    .name(commandExec)
    .version(version, "-v, --version", "Show the current version")
    .description(`${Str.toPascalCase(commandExec)} for your commander${os.EOL}Author: Havea Crenata <havea.crenata@gmail.com>`)
    .addHelpText("after", [
    `${os.EOL}Examples:`,
    `$ bun ${commandExec} --help`,
    `$ bun ${commandExec} --version`,
    `$ bun ${commandExec} migrate:latest`
].join(`${os.EOL}  `));
// Discovers and registers every Ace command (see Kernel.registerCommands).
Kernel.registerCommands(program);
program.parse();
