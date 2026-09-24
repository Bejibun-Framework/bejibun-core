import { errors } from "@vinejs/vine";
import ValidatorException from "../exceptions/ValidatorException.js";
/**
 * Runs a Vine validator against the given body, normalizing any
 * validation failure into a `ValidatorException`.
 *
 * Shared by `BaseController.validate()` and `Bejibun.Request.validate()`
 * so both entry points behave identically.
 *
 * @param {Bejibun.Validator} validator - The Vine validator to run.
 * @param {Record<string, any>} body - The data to validate.
 * @returns {Promise<any>} The validated (and type-coerced) data.
 * @throws {ValidatorException} When validation fails.
 */
export async function validatePayload(validator, body) {
    try {
        return await validator.validate(body);
    }
    catch (error) {
        let message;
        if (error instanceof errors.E_VALIDATION_ERROR && error.messages?.length)
            message = error.messages[0]?.message;
        else
            message = error?.message || "Invalid syntax validation.";
        throw new ValidatorException(message);
    }
}
