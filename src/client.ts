import { InterceptorManager } from './interceptors';
import { createRequestStore } from './request';
import { cacheStore } from './store';
import {
    CreatorRepository,
    InferResponse,
    ReactiveStore,
    RepositoryRequestConfig,
    RequestConfig,
    RequestConfigData,
    RequestInterceptor,
    ServiceConfig,
    ServiceContext
} from './types';

export function createApiClient(serviceConfig: Partial<ServiceConfig> = {}) {
    const baseURL = serviceConfig.baseURL || '';
    const requestInterceptorsManager = new InterceptorManager();

    for(const interceptor of serviceConfig.requestInterceptors || []) {
        requestInterceptorsManager.use(interceptor);
    }

    const serviceContext = {
        baseURL,
        requestInterceptorsManager,
        defaultHeaders: serviceConfig.defaultHeaders ?? {},
        validationType: serviceConfig.validationType ?? 'disabled',
    } satisfies ServiceContext;

    return {
        createRequest: <TConfig extends RequestConfigData>(
            initialConfig: TConfig, 
            finalRequestConfig: RequestConfig
        ): ReactiveStore<InferResponse<TConfig>, Error, TConfig> => createRequestStore<InferResponse<TConfig>, Error, TConfig>(
            finalRequestConfig, 
            serviceContext, 
            initialConfig
        ),
        interceptors: {
            request: {
                use  : (interceptor: RequestInterceptor) => requestInterceptorsManager.use(interceptor),
                eject: (id: number) => requestInterceptorsManager.eject(id),
            },
        },
        invalidateCache: (key: string) => {
            cacheStore.invalidate(key);
        },
        invalidateCacheByPattern: (pattern: RegExp) => {
            cacheStore.invalidateByPattern(pattern);
        },
        clearCache: () => {
            cacheStore.clear();
        },
    };
}

export function clearAllApiCache(): void {
    cacheStore.clear();
}

export function createRepository<const Configs extends readonly RequestConfigData[]>(
    requestConfigs: Configs,
    apiClient: ReturnType<typeof createApiClient>
): CreatorRepository<Configs> {
    // eslint-disable-next-line unicorn/no-array-reduce
    return requestConfigs.reduce((acc, config) => {
        const name = config.name as Configs[number]['name'];

        type CurrentConfig = Extract<Configs[number], { name: typeof name }>;

        acc[name] = ((requestConfig: RepositoryRequestConfig) => {
            const finalConfig: RequestConfig = {
                ...requestConfig.config,
                method: config.method.toUpperCase(),
                url   : config.path,
                ttl   : requestConfig.config?.ttl ?? config.ttl,
            };

            return apiClient.createRequest<CurrentConfig>(config as CurrentConfig, finalConfig);
        }) as CreatorRepository<Configs>[typeof name];

        return acc;
    }, {} as CreatorRepository<Configs>);
}
