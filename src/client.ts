import { encodeQueryParams } from '@front-utils/utils';
import { Type } from '@sinclair/typebox';

import { apiCache } from './cache';
import { ValidationError } from './errors';
import { InterceptorManager } from './interceptors';
import { createRequestInternal } from './request';
import {
    CreatorRepository,
    ReactiveStore,
    RepositoryRequestConfig,
    RequestConfig,
    RequestConfigData,
    RequestInterceptor,
    ServiceConfig
} from './types';
import { buildUrlWithParams, validateSchema } from './utils';

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS']);

function appendQueryParams(url: string, query: Record<string, unknown>): string {
    const queryParams = encodeQueryParams(query);
    const queryString = queryParams?.toString?.();

    if(!queryString) return url;

    const urlParts = url.split('?');

    return urlParts.length > 1 ? `${urlParts[0]}?${urlParts[1]}&${queryString}` : `${url}?${queryString}`;
}

function validateRequest<T extends RequestConfigData>(
    config: T,
    rc: RepositoryRequestConfig<T>
): void {
    if(!rc.config?.validate?.request) return;
    const onError = rc.config.validate.onValidationError;

    if(!onError) return;

    const errors: ValidationError[] = [];

    if(config.queryModel && rc.query) {
        const error = validateSchema(config.queryModel, rc.query, 'query');

        if(error) errors.push(error);
    }

    if(config.bodyModel && rc.body) {
        const error = validateSchema(config.bodyModel, rc.body, 'body');

        if(error) errors.push(error);
    }

    if(config.paramsModel && rc.urlParams) {
        const error = validateSchema(config.paramsModel, rc.urlParams, 'params');

        if(error) errors.push(error);
    }

    if(errors.length > 0) {
        const combinedError = new ValidationError(
            errors.map((err) => err.message).join('; '),
            undefined,
            undefined,
            errors
        );

        onError(combinedError);
    }
}

export function createApiClient(serviceConfig: Partial<ServiceConfig> = {}) {
    const baseURL = serviceConfig.baseURL || '';
    const requestInterceptorsManager = new InterceptorManager();

    for(const interceptor of serviceConfig.requestInterceptors || []) {
        requestInterceptorsManager.use(interceptor);
    }

    const serviceContext = {
        baseURL,
        requestInterceptorsManager,
        strictValidation: serviceConfig.strictValidation ?? false,
        defaultHeaders  : serviceConfig.defaultHeaders ?? {},
    };

    return {
        createRequest: <TData, TError = Error>(
            initialConfig: RequestConfig
        ): ReactiveStore<TData, TError> =>
            createRequestInternal<TData, TError>(initialConfig, serviceContext),

        interceptors: {
            request: {
                use: (interceptor: RequestInterceptor) =>
                    requestInterceptorsManager.use(interceptor),
                eject: (id: number) => requestInterceptorsManager.eject(id),
            },
        },

        invalidateCache: (key: string) => {
            apiCache.invalidate(key);
        },

        invalidateCacheByPattern: (pattern: RegExp) => {
            apiCache.invalidateByPattern(pattern);
        },

        clearCache: () => {
            apiCache.clear();
        },
    };
}

export function clearAllApiCache(): void {
    apiCache.clear();
}

export function createRepository<const Configs extends readonly RequestConfigData[]>(
    requestConfigs: Configs,
    apiClient: ReturnType<typeof createApiClient>
): CreatorRepository<Configs> {
    // eslint-disable-next-line unicorn/no-array-reduce
    return requestConfigs.reduce((acc, config) => {
        const name = config.name as Configs[number]['name'];

    type CurrentConfig = Extract<Configs[number], { name: typeof name }>;
     
    acc[name] = ((requestConfig: RepositoryRequestConfig<CurrentConfig>) => {
        const finalUrl = appendQueryParams(
            buildUrlWithParams(config.path, requestConfig.urlParams || {}),
            requestConfig.query || {}
        );

        // validateRequest(config, requestConfig);

        const httpMethod = config.method.toUpperCase();
        const hasBody = !!requestConfig.body && !METHODS_WITHOUT_BODY.has(httpMethod);

        const finalConfig: RequestConfig = {
            method : httpMethod,
            url    : finalUrl,
            schemas: {
                query   : config.queryModel,
                params  : config.paramsModel,
                body    : config.bodyModel,
                response: config.responseModel,
            },
            ...requestConfig.config,
        };

        if(hasBody) {
            finalConfig.body = requestConfig.body as BodyInit | null;
        }

        return apiClient.createRequest(finalConfig);
    }) as CreatorRepository<Configs>[typeof name];

    return acc;
    }, {} as CreatorRepository<Configs>);
}

// const endpoints = [
//     {
//         name         : 'getUser',
//         method       : 'get',
//         path         : '/users/:id',
//         paramsModel  : Type.Object({ id: Type.String(), }),
//         queryModel   : Type.Object({ includePosts: Type.Optional(Type.Boolean()), }),
//         responseModel: Type.Object({ id: Type.String(), name: Type.String(), }),
//     },
//     {
//         name         : 'createUser',
//         method       : 'post',
//         path         : '/users',
//         bodyModel    : Type.Object({ name: Type.String(), email: Type.String(), }),
//         responseModel: Type.Object({ id: Type.String(), name: Type.String(), email: Type.String(), }),
//     }
// ] as const;

// const apiClient = createApiClient({
//     baseURL       : 'https://api.example.com',
//     defaultHeaders: { 'Content-Type': 'application/json', },
// });

// const userRepo = createRepository(endpoints, apiClient);

// const res = userRepo.getUser({});