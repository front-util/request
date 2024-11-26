import { nativeRequest } from './httpService';
import { JSONTypeInterceptor } from './request_interceptors/requestJSONType';
import { 
    NativeHttpInterceptorsParams, 
    RequestConfig, 
    NativeHttpRequestParamsWithAdapapter, 
    Interceptor
} from './types';

export const baseInterceptors = [
    JSONTypeInterceptor
] as Interceptor[];

export const createHttpService = ({ baseURL, ...initConfig }: {baseURL: string;} & RequestConfig) => {
    const interceptors: Interceptor[] = [];

    const request = <T>({ url, params, ...options }: NativeHttpRequestParamsWithAdapapter<T>) => {
        const modifiedConfig = interceptors.reduce((acc, interceptor) => {
            acc = interceptor(acc);
            return acc;
        }, {
            url,
            ...initConfig,
            ...options,
        } as NativeHttpInterceptorsParams);

        const fullUrl = (modifiedConfig.url as string).startsWith('http') ? modifiedConfig.url : `${baseURL}${modifiedConfig.url}`;

        return nativeRequest<T>({
            ...modifiedConfig,
            url: fullUrl as string,
            params,
        });
    };

    return {
        request,
        interceptors: {
            request: {
                use: (interceptor: Interceptor) => {
                    interceptors.push(interceptor);
                },
            },
        },
    };
};

export const initHttpService = (baseURL: string) => {
    const service = createHttpService({
        baseURL,
    });

    baseInterceptors.forEach((interceptor) => {
        service.interceptors.request.use(interceptor);
    });
};