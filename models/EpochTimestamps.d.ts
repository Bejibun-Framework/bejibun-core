import BaseModel from "../bases/BaseModel.js";
/**
 * Mixin that overrides `BaseModel`'s default `$beforeInsert`/`$beforeUpdate`
 * timestamp hooks to stamp `createdColumn`/`updatedColumn` with Unix
 * epoch integers (via `DateTime.toUnixInteger()`). Useful for tables
 * (like the built-in `jobs` table - see `JobModel`) that store timestamps
 * as integer columns.
 *
 * @param {typeof BaseModel} Base - The `BaseModel` subclass to apply epoch timestamps to.
 * @returns {any} A new class extending `Base` with epoch-integer timestamp hooks.
 */
declare const EpochTimestamps: (Base: typeof BaseModel) => any;
export default EpochTimestamps;
