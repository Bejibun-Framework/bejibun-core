import vine, { VineNumber, VineString } from "@vinejs/vine";
import BaseModel from "../../bases/BaseModel.js";
/**
 * Async Vine rule implementation backing `.exists()`: fails validation
 * unless a matching row is found in the configured table/column.
 *
 * @param {unknown} value - The field value being validated.
 * @param {ExtendOptions} options - The resolved `exists` options (table, column, withTrashed, nullable).
 * @param {any} field - Vine's field context, used to report validation errors.
 */
const exists = async (value, options, field) => {
    if (!field.isValid)
        return;
    if (options.nullable)
        return;
    const column = options.column || field.name;
    let query = options.table;
    if (options.withTrashed)
        query = query.withTrashed();
    else
        query = query.query();
    const row = await query.where(column, value).first();
    if (!row)
        field.report("The {{ field }} field doesn't exists", "exists", field);
};
/** The compiled Vine rule wrapping `exists()`, marked async. */
const existsRule = vine.createRule(exists, { isAsync: true });
/**
 * Registers an `.exists(tableOrOptions, column?, withTrashed?, nullable?)`
 * macro on the given Vine schema type (`VineString`/`VineNumber`),
 * normalizing either call signature (a model class + separate args, or a
 * single `ExtendOptions` object) into the `ExtendOptions` shape the rule expects.
 *
 * @param {any} Type - The Vine schema type class to attach the macro to.
 */
const registerExistsMacro = (Type) => {
    Type.macro("exists", function (tableOrOptions, column, withTrashed, nullable) {
        const isModel = typeof tableOrOptions === "function" &&
            Object.prototype.isPrototypeOf.call(BaseModel, tableOrOptions);
        const options = isModel
            ? {
                table: tableOrOptions,
                column,
                withTrashed,
                nullable
            }
            : tableOrOptions;
        return this.use(existsRule(options));
    });
};
registerExistsMacro(VineString);
registerExistsMacro(VineNumber);
