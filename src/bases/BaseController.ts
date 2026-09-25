import {defineValue, isNotEmpty} from "@bejibun/utils";
import {default as Bobject} from "@bejibun/utils/facades/Object";
import {errors, VineValidator} from "@vinejs/vine";
import ValidatorException from "@/exceptions/ValidatorException";
import Response from "@/facades/Response";

export default class BaseController {
    public async parse(request: Bun.BunRequest): Promise<Record<string, any>> {
        const contentType: string = defineValue(request?.headers?.get("content-type"), "");
        const formData: FormData = new FormData();

        let data: Record<string, any> = {};

        try {
            if (contentType.includes("application/json")) Object.assign(data, Bobject.serialize(defineValue(await request?.json(), {})));

            for (const [key, value] of Object.entries(defineValue(request?.params, {}))) {
                formData.append(key, value as string);
            }

            const url = new URL(defineValue(request?.url, ""));
            for (const [key, value] of url.searchParams) {
                formData.append(key, value);
            }

            if (
                contentType.includes("multipart/form-data") ||
                contentType.includes("application/x-www-form-urlencoded")
            ) {
                const body = defineValue(await request?.formData(), {});

                for (const [key, value] of body) {
                    formData.append(key, value);
                }
            }

            const text = defineValue(await request?.text(), "");
            if (isNotEmpty(text)) formData.append("text", text);
        } catch {
            // do nothing
        }

        return Object.assign(data, Bobject.parseFormData(formData));
    }

    public get response(): typeof Response {
        return Response;
    }

    public async validate(validator: VineValidator<any, Record<string, any> | undefined>, body: Record<string, any>): Promise<any> {
        try {
            return await validator.validate(body);
        } catch (error: typeof errors.E_VALIDATION_ERROR | any) {
            const defaultMessage: string = "Invalid syntax validation.";
            let message: string = defaultMessage;

            if (isNotEmpty(error?.messages)) message = defineValue(error?.messages[0]?.message, defaultMessage);
            else message = defineValue(error?.message, defaultMessage);

            throw new ValidatorException(message);
        }
    }
}