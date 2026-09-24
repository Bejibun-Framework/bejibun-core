import BaseModel from "../bases/BaseModel.js";

/**
 * Options accepted by the framework's custom `exists`/`unique` Vine rules,
 * as an alternative to passing the model class directly as the first
 * argument.
 */
export type ExtendOptions = {
    /** The model class whose table the rule should check against. */
    table: typeof BaseModel;

    /** The column to check. Defaults to the field name being validated. */
    column?: string;

    /** Whether soft-deleted rows should be included in the check. */
    withTrashed?: boolean;

    /** Whether `null`/`undefined` values should be allowed to skip the check. */
    nullable?: boolean;
};

/**
 * Module augmentation registering the framework's custom `exists()` and
 * `unique()` database-lookup rules on Vine's `VineNumber` and `VineString`
 * schema types, so they're available as `vine.number().exists(...)` /
 * `vine.string().unique(...)` once `@/utils/vine` has been imported
 * (which registers the runtime implementations - see `utils/vines/exists.ts`
 * and `utils/vines/unique.ts`).
 */
declare module "@vinejs/vine" {
    interface VineNumber {
        /**
         * Validates that a matching row exists in the given table/column.
         *
         * @param {typeof BaseModel | ExtendOptions} tableOrOptions - The model class to check against, or a full `ExtendOptions` object.
         * @param {string} column - The column to check (when `tableOrOptions` is a model class).
         * @param {boolean} withTrashed - Whether to include soft-deleted rows.
         * @param {boolean} nullable - Whether `null`/`undefined` values should skip the check.
         */
        exists(
            tableOrOptions: typeof BaseModel | ExtendOptions,
            column?: string,
            withTrashed?: boolean,
            nullable?: boolean
        ): this;

        /**
         * Validates that no matching row already exists in the given table/column.
         *
         * @param {typeof BaseModel | ExtendOptions} tableOrOptions - The model class to check against, or a full `ExtendOptions` object.
         * @param {string} column - The column to check (when `tableOrOptions` is a model class).
         * @param {boolean} withTrashed - Whether to include soft-deleted rows.
         * @param {boolean} nullable - Whether `null`/`undefined` values should skip the check.
         */
        unique(
            tableOrOptions: typeof BaseModel | ExtendOptions,
            column?: string,
            withTrashed?: boolean,
            nullable?: boolean
        ): this;
    }

    interface VineString {
        /**
         * Validates that a matching row exists in the given table/column.
         *
         * @param {typeof BaseModel | ExtendOptions} tableOrOptions - The model class to check against, or a full `ExtendOptions` object.
         * @param {string} column - The column to check (when `tableOrOptions` is a model class).
         * @param {boolean} withTrashed - Whether to include soft-deleted rows.
         * @param {boolean} nullable - Whether `null`/`undefined` values should skip the check.
         */
        exists(
            tableOrOptions: typeof BaseModel | ExtendOptions,
            column?: string,
            withTrashed?: boolean,
            nullable?: boolean
        ): this;

        /**
         * Validates that no matching row already exists in the given table/column.
         *
         * @param {typeof BaseModel | ExtendOptions} tableOrOptions - The model class to check against, or a full `ExtendOptions` object.
         * @param {string} column - The column to check (when `tableOrOptions` is a model class).
         * @param {boolean} withTrashed - Whether to include soft-deleted rows.
         * @param {boolean} nullable - Whether `null`/`undefined` values should skip the check.
         */
        unique(
            tableOrOptions: typeof BaseModel | ExtendOptions,
            column?: string,
            withTrashed?: boolean,
            nullable?: boolean
        ): this;
    }
}

export {};
