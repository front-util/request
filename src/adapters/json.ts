import { safeHandleDecorateAsync } from "@front-utils/utils";

export const safeHandleAsync = async <R>(operation: () => Promise<R>) => {
    return await safeHandleDecorateAsync(operation)();
};

export const _isJSON = (response: Response) => response.headers.get("content-type")?.includes("application/json");

export const jsonAdapter = async <T>(response: Response): Promise<T | undefined> => {
    const [, result] = await safeHandleAsync<T>(() => response.json());

    return result ?? undefined;
};