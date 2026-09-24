/**
 * Side-effect-only import that registers the framework's custom Vine
 * rules (`exists`, `unique`) as macros on `VineString`/`VineNumber`.
 * Imported once by `BaseValidator` so every validator gets the extended
 * rule set automatically.
 */
import "./vines/exists.js";
import "./vines/unique.js";
