import { nativeRequest } from './httpService';
import { 
    NativeHttpInterceptorsParams, 
    RequestConfig, 
    NativeHttpRequestParamsWithAdapapter, 
    Interceptor
} from './types';

export const createHttpService = ({ baseURL, ...initConfig }: {baseURL: string;} & RequestConfig) => {
    let interceptors: Interceptor[] = [];

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
                length: interceptors.length,
                use   : (interceptor: Interceptor) => {
                    interceptors.push(interceptor);
                },
                remove: (interceptor: Interceptor) => {
                    interceptors = interceptors.filter((val) => val !== interceptor);
                },
            },
        },
    };
};

export const initHttpService = (baseURL: string, externalInterceptors: Interceptor[] = []) => {
    const service = createHttpService({
        baseURL,
    });

    externalInterceptors.forEach((interceptor) => {
        service.interceptors.request.use(interceptor);
    });
    return service;
};