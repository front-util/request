import { HttpStatusCode } from './httpCodes';
import { 
    LoadError, 
    HttpRequestResult, 
    RequestConfig, 
    NativeHttpRequestParamsWithAdapapter, 
    StandartErrorResponse,
    ResponseType
} from './types';
import { blobAdapter } from './adapters/blob';
import { _isJSON, jsonAdapter } from './adapters/json';

const resultParser = async <T>({response, type, skipResult, signal, onLoadProcess,} : {
    response: Response;
    type: ResponseType;
    skipResult?: boolean;
    signal: AbortSignal | null | undefined;
    onLoadProcess?: NativeHttpRequestParamsWithAdapapter<T>['onLoadProcess'];
}): Promise<T | undefined> => {
    let result = response as unknown as T | undefined;

    if(skipResult || response.status !== HttpStatusCode.OK) {
        return;
    }

    try {
        if(type === 'blob') {
            result = await blobAdapter<T>({response, signal, onLoadProcess,});
        }
        if(type === 'json' && _isJSON(response)) {
            result = await jsonAdapter<T>(response);
        }
    } catch(error) {
        console.error(error);
    }
    return result;
};

const errorParser = async (response: Response) => {
    const baseError = {
        error    : response.statusText,
        status   : response.status,
        errorData: null,
    };

    if(!_isJSON(response)) {
        return baseError;
    }

    try {
        const parsedErrorInfo = await jsonAdapter<StandartErrorResponse>(response);

        return {
            ...baseError,
            error    : parsedErrorInfo?.message ?? parsedErrorInfo?.error ?? response.statusText ?? 'unknown server error', 
            errorData: {
                ...parsedErrorInfo,
                status: response.status,
            },
        };
    } catch(_) {
        return baseError;
    }
};

export const nativeRequest = async <T = unknown>({
    url,
    responseType = 'json',
    params,
    headers,
    skipResult,
    method = 'GET',
    signal,
    adapter,
    onLoadProcess,
    ...options
}: NativeHttpRequestParamsWithAdapapter<T>): Promise<HttpRequestResult<T>> => {
    try {
        const fetchOptions = {
            method,
            ...params && {
                body: JSON.stringify(params),
            },
            ...options,
            headers: headers ?? {},
            signal,
        } as RequestConfig;

        const response = await fetch(url, fetchOptions);

        if(!response.ok) {
            return errorParser(response);
        }
        const resultPromise = adapter ? 
            adapter(response) : 
            resultParser<T>({
                response, 
                type: responseType, 
                skipResult,
                signal,
                onLoadProcess,
            });

        return {
            result: await resultPromise as T,
            status: response.status,
        };
    } catch(error) {                
        if((error as Error).name == 'AbortError') { // обработать ошибку от вызова controller.abort()
            return {
                error      : null,
                status     : null,
                errorData  : null,
                isCancelled: true,
            };
        }
        return {
            error    : error as LoadError,
            status   : null,
            errorData: null,
        };
    }
};