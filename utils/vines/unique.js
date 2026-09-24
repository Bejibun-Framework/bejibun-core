import vine, { VineNumber, VineString } from "@vinejs/vine";
import BaseModel from "../../bases/BaseModel.js";
/**
 * Async Vine rule implementation backing `.unique()`: fails validation if
 * a matching row already exists in the configured table/column.
 *
 * @param {unknown} value - The field value being validated.
 * @param {ExtendOptions} options - The resolved `unique` options (table, column, withTrashed, nullable).
 * @param {any} field - Vine's field context, used to report validation errors.
 */
const unique = async (value, options, field) => {
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
    if (row)
        field.report("The {{ field }} field is already exists", "unique", field);
};
/** The compiled Vine rule wrapping `unique()`, marked async. */
const uniqueRule = vine.createRule(unique, { isAsync: true });
/**
 * Registers a `.unique(tableOrOptions, column?, withTrashed?, nullable?)`
 * macro on the given Vine schema type (`VineString`/`VineNumber`),
 * normalizing either call signature (a model class + separate args, or a
 * single `ExtendOptions` object) into the `ExtendOptions` shape the rule expects.
 *
 * @param {any} Type - The Vine schema type class to attach the macro to.
 */
const registerUniqueMacro = (Type) => {
    Type.macro("unique", function (tableOrOptions, column, withTrashed, nullable) {
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
        return this.use(uniqueRule(options));
    });
};
registerUniqueMacro(VineString);
registerUniqueMacro(VineNumber);
