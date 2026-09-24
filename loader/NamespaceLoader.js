import NamespaceBuilder from "../builders/NamespaceBuilder.js";
/**
 * Thin static wrapper around `NamespaceBuilder`, used by `bootstrap.ts`
 * to autoload every job and model class under a given directory so they
 * register their namespace without requiring explicit imports.
 */
export default class NamespaceLoader {
    /**
     * Scans and loads every class file under the given directory.
     *
     * @param {string} directory - The absolute directory path to scan.
     */
    static async load(directory) {
        return await new NamespaceBuilder().load(directory);
    }
}
