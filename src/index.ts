import { computed, ReadonlySignal, signal } from '@preact/signals';
import { Static, TAnySchema, TObject, TProperties, TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

// *******************************************************************
// I. ТИПЫ, ИНТЕРФЕЙСЫ И КАСТОМНЫЕ ОШИБКИ
// *******************************************************************

/** Ошибка, возникающая при сетевых сбоях (DNS, недоступность сервера). */
export class NetworkError extends Error {

    constructor(message: string, public originalError?: unknown) {
        super(`Network Error: ${message}`);
        this.name = 'NetworkError';
    }

}

/** Ошибка, возникающая при HTTP-статусах 4xx/5xx. */
export class HttpError<TError> extends Error {

    constructor(
        message: string,
       public status: number,
       public responseBody?: TError
    ) {
        super(`HTTP Error ${status}: ${message}`);
        this.name = 'HttpError';
    }

}

/** Ошибка, возникающая при сбое парсинга ответа (например, невалидный JSON). */
export class ParsingError extends Error {

    constructor(message: string, public originalError?: unknown) {
        super(`Parsing Error: ${message}`);
        this.name = 'ParsingError';
    }

}

/** Ошибка, возникающая при отмене запроса. */
export class CancellationError extends Error {

    constructor() {
        super('Request was cancelled.');
        this.name = 'CancellationError';
    }

}

/** Ошибка валидации схемы */
export class ValidationError extends Error {

    constructor(
        message: string, 
       public schema: TSchema,
       public details?: any
    ) {
        super(`Validation Error: ${message}`);
        this.name = 'ValidationError';
    }

}

// --- Модель состояния (Дискриминированные объединения) ---

export type RequestStatus = number | null;

export type FetchState<TData, TError = any> =
  | { type: 'idle'; status: null; data: undefined; error: undefined }
  | { type: 'loading'; status: null; data: TData | undefined; error: undefined }
  | { type: 'success'; status: number; data: TData; error: undefined }
  | { type: 'empty'; status: number; data: undefined; error: undefined }
  | { type: 'error'; status: RequestStatus; data: undefined; error: TError | NetworkError | ParsingError | HttpError<TError> | CancellationError | ValidationError };

// --- Конфигурация и публичный интерфейс запроса ---

// Интерфейс для конфигурации запроса с поддержкой TypeBox схем
export interface RequestConfigData {
   name: string;
   hostname?: string;
   method: HttpMethodTypes;
   path: string;
   /** Схема query параметров */
   queryModel?: TObject<TProperties>;
   /** Схема параметров URL /url/:id */
   paramsModel?: TObject<TProperties>;
   /** Схема тела запроса */
   bodyModel?: TAnySchema;
   /** Схема тела ответа */
   responseModel?: TAnySchema;
   doc?: string;
   /** Разрешить абортирование метода при повторном запросе */
   abortable?: boolean;
   keepalive?: boolean;
}

export type HttpMethodTypes = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options';

// Расширенная конфигурация запроса с типизацией
export interface RequestConfig extends RequestInit {
   url: string;
   ttl?: number;
   responseType?: 'json' | 'text' | 'blob';
   emptyStatusCodes?: number[];
   // Параметры для валидации
   validate?: {
      request?: boolean;
      response?: boolean;
      onValidationError?: (error: ValidationError) => void;
   };
   // Кастомный ключ кэша
   cacheKey?: string;
   // Параметры для retry
   retries?: number;
   retryDelay?: number;
   retryOn?: (error: Error) => boolean;
   // Схемы для валидации
   schemas?: {
      query?: TAnySchema;
      params?: TAnySchema;
      body?: TAnySchema;
      response?: TAnySchema;
   };
}

// Типы для инференции данных из схем
export type InferQuery<T extends RequestConfigData> = T extends { queryModel: TObject<infer TP> } ? Static<TObject<TP>> : never;

export type InferParams<T extends RequestConfigData> = T extends { paramsModel: TObject<infer TP> } ? Static<TObject<TP>> : never;

export type InferBody<T extends RequestConfigData> = T extends { bodyModel: infer TB extends TAnySchema } ? Static<TB> : never;

export type InferResponse<T extends RequestConfigData> = T extends { responseModel: infer TR extends TAnySchema } ? Static<TR> : unknown;

// --- Публичный интерфейс, возвращаемый утилитой createRequest. ---
export interface ReactiveStore<TData, TError = Error> {
   state: ReadonlySignal<FetchState<TData, TError>>;
   data: ReadonlySignal<TData | undefined>;
   isLoading: ReadonlySignal<boolean>;
   isError: ReadonlySignal<boolean>;
   isEmpty: ReadonlySignal<boolean>;
   status: ReadonlySignal<RequestStatus>;
   // Методы refetch и cancel остаются асинхронными, так как executeRequest асинхронна
   refetch: () => Promise<void>;
   cancel: () => void;
   // Метод для очистки ресурсов
   destroy: () => void;
}

// --- Интерсейсы Сервиса и Интерсепторов ---

/** Интерсептор, который принимает и возвращает RequestConfig (может быть асинхронным). */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

/** Конфигурация, передаваемая в createApiClient. */
export interface ServiceConfig {
   baseURL?: string;
   requestInterceptors?: RequestInterceptor[];
}

// *******************************************************************
// II. МЕНЕДЖЕР ИНТЕРСЕПТОРОВ И УТИЛИТЫ КЭША
// *******************************************************************

/**
* Менеджер для регистрации и применения цепочки интерсепторов.
*/
class InterceptorManager {

    private handlers: RequestInterceptor[] = [];

    public use(interceptor: RequestInterceptor): void {
        this.handlers.push(interceptor);
    }

    public async applyInterceptors(config: RequestConfig): Promise<RequestConfig> {
        let currentConfig = config;

        for(const handler of this.handlers) {
            currentConfig = await handler(currentConfig);
        }
        return currentConfig;
    }

}

// --- Утилиты Кэша ---

interface CacheEntry<TData> {
    data: TData;
   status: number;
   ttlTimestamp: number;
}

/**
* Создает детерминированный и компактный ключ кэша (синхронно).
* Максимально быстрая версия - только метод и URL.
*/
function generateCacheKey(config: RequestConfig): string {
    return config.cacheKey || `${config.method || 'GET'}:${config.url}`;
}

/**
* Имплементация in-memory кэша с TTL.
*/
export class CacheStore {

    private cache = new Map<string, CacheEntry<any>>();

    // Синхронное получение ключа и записи
    public get<TData>(config: RequestConfig): CacheEntry<TData> | null {
        const key = generateCacheKey(config);
        const entry = this.cache.get(key);

        if(!entry) return null;
        if(entry.ttlTimestamp < Date.now()) {
            this.cache.delete(key);
            return null;
        }
        return entry as CacheEntry<TData>;
    }

    // Синхронная установка
    public set(config: RequestConfig, data: any, status: number, ttl: number): void {
        const key = generateCacheKey(config);

        if(ttl > 0 && (config.method || 'GET').toUpperCase() === 'GET') {
            const entry: CacheEntry<any> = {
                data,
                status,
                ttlTimestamp: Date.now() + ttl,
            };

            this.cache.set(key, entry);
        }
    }

    // Синхронная инвалидация по конфигурации или кастомному ключу
    public invalidate(configOrKey: RequestConfig | string): void {
        const key = typeof configOrKey === 'string'
            ? configOrKey
            : generateCacheKey(configOrKey);

        this.cache.delete(key);
    }

    // Метод для очистки всего кэша
    public clear(): void {
        this.cache.clear();
    }

}

export const apiCache = new CacheStore();

// --- Валидация схем TypeBox ---

/**
* Валидирует данные по схеме с использованием TypeBox Value.Check
*/
function validateSchema(schema: TSchema, data: unknown, context: string): ValidationError | null {
    if(!schema) return null;
   
    try {
        const isValid = Value.Check(schema, data);

        if(isValid) return null;
       
        const errors = [...Value.Errors(schema, data)];

        return new ValidationError(`Invalid ${context} data`, schema, data, errors);
    } catch(error) {
        return new ValidationError(
            `Validation failed for ${context}`,
            schema,
            data,
            error instanceof Error ? error.message : String(error)
        );
    }
}

// --- Адаптер Парсинга Ответа ---

export async function parseResponse<TData>(
    response: Response,
    config: Pick<RequestConfig, 'responseType'>
): Promise<TData | null> {
    const contentType = response.headers.get('content-type') || '';
    const responseType = config.responseType || (contentType.includes('json') ? 'json' : 'text');

    // Статусы 204/205 не имеют тела
    if(response.status === 204 || response.status === 205) {
        return null;
    }

    try {
        let parsedBody: TData | string | Blob | null = null;
       
        switch(responseType) {
            case 'json': {
                parsedBody = await response.json().catch(() => null);
                break;
            }
            case 'text': {
                parsedBody = await response.text();
                if(parsedBody === '') return null;
                break;
            }
            case 'blob': {
                parsedBody = await response.blob();
                break;
            }
        }

        if(parsedBody === null || parsedBody === undefined) {
            return null;
        }
       
        // Пустые массивы и объекты - это валидные данные, не считаем их пустыми
        return parsedBody as TData;
    } catch(error) {
        throw new ParsingError(`Failed to parse response body as ${responseType}`, error);
    }
}

// *******************************************************************
// III. ОСНОВНАЯ УТИЛИТА И ФАБРИКА СЕРВИСА
// *******************************************************************

let globalRequestCounter = 0;

interface ServiceContext {
   baseURL: string;
   requestInterceptorsManager: InterceptorManager;
}

/**
* Внутренняя функция для создания реактивного хранилища запроса.
*/
function createRequestInternal<TData, TError = any>(
    initialConfig: RequestConfig,
    serviceContext: ServiceContext
): ReactiveStore<TData, TError> {
    const currentConfig = initialConfig;
    let abortController: AbortController | null = null;
    let currentExecutionId = 0;
    let isDestroyed = false;

    const initialState: FetchState<TData, TError> = { type: 'idle', status: null, data: undefined, error: undefined, };
    const stateSignal = signal<FetchState<TData, TError>>(initialState);

    const updateState = (newState: FetchState<TData, TError>) => {
        if(!isDestroyed) {
            stateSignal.value = newState;
        }
    };

    const isExplicitlyEmptyStatus = (status: number) => {
        const defaultEmptyCodes = [204, 205];
        const configEmptyCodes = currentConfig.emptyStatusCodes || [];
        const combinedCodes = [...defaultEmptyCodes, ...configEmptyCodes];

        return combinedCodes.includes(status);
    };
   
    const isGetRequest = (currentConfig.method || 'GET').toUpperCase() === 'GET';
    const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS']);

    async function executeRequestWithRetry(isRefetch: boolean = false, retryAttempt: number = 1): Promise<void> {
        if(isDestroyed) return;

        // Для не-refetch GET запросов проверяем кэш сразу
        if(!isRefetch && isGetRequest) {
            const cached = apiCache.get<TData>(currentConfig);

            if(cached) {
                updateState({ type: 'success', status: cached.status, data: cached.data, error: undefined, });
                return;
            }
        }

        // Отмена предыдущего запроса
        if(abortController) {
            abortController.abort();
        }
       
        currentExecutionId = ++globalRequestCounter;
        const executionId = currentExecutionId;

        abortController = new AbortController();
        const {signal,} = abortController;

        try {
            await executeRequestInternal(signal, executionId, isRefetch, retryAttempt);
        } catch(error) {
            // Ошибки обрабатываются внутри executeRequestInternal
        }
    }

    async function executeRequestInternal(
        signal: AbortSignal, 
        executionId: number, 
        isRefetch: boolean,
        retryAttempt: number = 1
    ): Promise<void> {
        if(isDestroyed) return;

        let previousData: TData | undefined;

        if(stateSignal.value.type === 'success' || stateSignal.value.type === 'loading') {
            previousData = stateSignal.value.data;
        }

        updateState({ type: 'loading', status: null, data: previousData, error: undefined, });

        // --- 1. ПРИМЕНЕНИЕ ИНТЕРСЕПТОРОВ ---
        let finalConfig: RequestConfig;

        try {
            finalConfig = await serviceContext.requestInterceptorsManager.applyInterceptors(currentConfig);
        } catch(error) {
            const errorState: FetchState<TData, TError> = { type: 'error', status: null, data: undefined, error: error as Error, };

            updateState(errorState);
            return;
        }
       
        // --- 2. URL RESOLUTION (BASE URL) ---
        let finalUrl = finalConfig.url;
        const isAbsolute = finalUrl.startsWith('http://') || finalUrl.startsWith('https://') || finalUrl.startsWith('//');
       
        if(!isAbsolute && serviceContext.baseURL) {
            const base = serviceContext.baseURL.endsWith('/') ? serviceContext.baseURL : `${serviceContext.baseURL}/`;
            const path = finalUrl.startsWith('/') ? finalUrl.slice(1) : finalUrl;

            finalUrl = base + path;
        }

        // --- 3. ВЫПОЛНЕНИЕ FETCH ---
        try {
            const response = await fetch(finalUrl, {
                ...finalConfig,
                signal,
            });

            const responseClone = response.clone();
            const {status,} = response;
            let resultData: TData | null = null;

            if(signal.aborted) {
                throw new CancellationError();
            }
           
            if(executionId !== currentExecutionId || isDestroyed) return;

            // Обработка успешных статусов (200-299)
            if(response.ok) {
                try {
                    resultData = await parseResponse<TData>(responseClone, finalConfig);
                } catch(error) {
                    throw new ParsingError('Failed to parse successful response body', error);
                }
               
                // Валидация ответа если требуется (даже для null)
                if(finalConfig.validate?.response && finalConfig.schemas?.response) {
                    const validationError = validateSchema(finalConfig.schemas.response, resultData, 'response');

                    if(validationError && finalConfig.validate.onValidationError) {
                        finalConfig.validate.onValidationError(validationError);
                    }
                }
               
                // Статусы 204 и 205 всегда считаются пустыми
                if(status === 204 || status === 205) {
                    const emptyState: FetchState<TData, TError> = { type: 'empty', status, data: undefined, error: undefined, };

                    updateState(emptyState);
                    apiCache.invalidate(finalConfig);
                }
                // Явно указанные empty статусы
                else if(isExplicitlyEmptyStatus(status)) {
                    const emptyState: FetchState<TData, TError> = { type: 'empty', status, data: undefined, error: undefined, };

                    updateState(emptyState);
                    apiCache.invalidate(finalConfig);
                }
                // Нормальный успешный ответ (включая пустые массивы и объекты)
                else {
                    const successState: FetchState<TData, TError> = { type: 'success', status, data: resultData as TData, error: undefined, };

                    updateState(successState);
                    // Кэширование
                    if(finalConfig.ttl && finalConfig.ttl > 0) {
                        apiCache.set(finalConfig, resultData, status, finalConfig.ttl);
                    }
                }
           
                // Обработка HTTP-ошибок (4xx, 5xx)
            } else {
                // Статусы, явно указанные как empty, даже при ошибке
                if(isExplicitlyEmptyStatus(status)) {
                    const emptyState: FetchState<TData, TError> = { type: 'empty', status, data: undefined, error: undefined, };

                    updateState(emptyState);
                    apiCache.invalidate(finalConfig);
                } else {
                    let errorBody: TError | undefined;

                    try {
                        errorBody = await responseClone.json() as TError;
                    } catch{ /* Игнорируем ошибку парсинга тела ошибки */ }

                    const httpError = new HttpError<TError>(response.statusText, status, errorBody);
                    const errorState: FetchState<TData, TError> = { type: 'error', status, data: undefined, error: httpError, };

                    updateState(errorState);
                    // Инвалидируем кэш при ошибках
                    apiCache.invalidate(finalConfig);
                }
            }
       
            // Обработка сетевых/парсинг-ошибок
        } catch(error) {
            if(error instanceof DOMException && error.name === 'AbortError') return;

            if(executionId !== currentExecutionId || isDestroyed) return;

            // Логика retry
            const canRetry = finalConfig.retries && retryAttempt <= finalConfig.retries;

            if(canRetry) {
                const shouldRetry = finalConfig.retryOn 
                    ? finalConfig.retryOn(error as Error)
                    : (error instanceof NetworkError || 
                      (error instanceof HttpError && error.status >= 500));
               
                if(shouldRetry) {
                    const delay = (finalConfig.retryDelay || 1000) * 2**(retryAttempt - 1);

                    await new Promise((resolve) => setTimeout(resolve, delay));
                    return executeRequestWithRetry(isRefetch, retryAttempt + 1);
                }
            }

            let finalError: Error;
            let status: RequestStatus = null;

            if(error instanceof ParsingError || error instanceof HttpError || error instanceof CancellationError) {
                finalError = error;
                status = (error instanceof HttpError) ? error.status : null;
            } else {
                finalError = new NetworkError((error as Error)?.message || 'Unknown network error', error);
            }
           
            const errorState: FetchState<TData, TError> = { type: 'error', status, data: undefined, error: finalError, };

            updateState(errorState);
        }
    }

    // --- Публичные методы ---

    const refetch = () => {
        apiCache.invalidate(currentConfig);
        return executeRequestWithRetry(true);
    };
   
    const cancel = () => {
        if(abortController) {
            abortController.abort();
        }
    };

    const destroy = () => {
        isDestroyed = true;
        cancel();
    };
   
    // --- Производные сигналы (Computed) ---
   
    const dataComputed = computed(() => {
        const current = stateSignal.value;

        return (current.type === 'success' || current.type === 'loading') ? current.data : undefined;
    });

    const isLoadingComputed = computed(() => stateSignal.value.type === 'loading');
    const isErrorComputed = computed(() => stateSignal.value.type === 'error');
    const isEmptyComputed = computed(() => stateSignal.value.type === 'empty');
    const statusComputed = computed(() => stateSignal.value.status);
   
    if(isGetRequest && !isDestroyed) {
        executeRequestWithRetry();
    }

    return {
        state    : stateSignal,
        dataComputed,
        isLoading: isLoadingComputed,
        isError  : isErrorComputed,
        isEmpty  : isEmptyComputed,
        status   : statusComputed,
        refetch,
        cancel,
        destroy,
    };
}

/**
* Фабрика для создания экземпляра API-клиента с базовым URL и интерсепторами.
*/
export function createApiClient(serviceConfig: Partial<ServiceConfig> = {}) {
    const baseURL = serviceConfig.baseURL || '';
    const requestInterceptorsManager = new InterceptorManager();

    // Добавляем начальные интерсепторы, если они есть
    for(const interceptor of (serviceConfig.requestInterceptors || [])) {
        requestInterceptorsManager.use(interceptor);
    }
   
    return {
        /**
        * Создает реактивный клиент для конкретного запроса.
        */
        createRequest: <TData, TError = any>(
            initialConfig: RequestConfig
        ): ReactiveStore<TData, TError> => createRequestInternal<TData, TError>(
            initialConfig,
            {
                baseURL,
                requestInterceptorsManager,
            }
        ),
       
        /**
        * Менеджер интерсепторов для добавления логики перед отправкой запроса.
        */
        interceptors: {
            request: {
                use: (interceptor: RequestInterceptor) => requestInterceptorsManager.use(interceptor),
            },
        },
       
        /**
        * Метод для инвалидации кэша по кастомному ключу
        */
        invalidateCache: (key: string) => {
            apiCache.invalidate(key);
        },
       
        /**
        * Метод для очистки всего кэша (вызывать при logout)
        */
        clearCache: () => {
            apiCache.clear();
        },
    };
}

// Экспортируем глобальную функцию очистки для удобства
export const clearAllApiCache = () => {
    apiCache.clear();
};

// *******************************************************************
// IV. ТИПЫ И УТИЛИТЫ ДЛЯ TYPEBOX СХЕМ
// *******************************************************************

/**
* Тип для метода репозитория с полной типизацией
*/
export type RepositoryMethod<T extends RequestConfigData> = (
   requestConfig: {
      query?: InferQuery<T>;
      urlParams?: InferParams<T>;
      body?: InferBody<T>;
      config?: Omit<RequestConfig, 'url'>;
   }
) => ReactiveStore<InferResponse<T>>;

/**
* Тип для параметров метода репозитория
*/
export type RepositoryMethodParameters<T extends RequestConfigData> = 
   (T['queryModel'] extends TObject<TProperties> ? { query: InferQuery<T> } : { query?: never }) &
   (T['paramsModel'] extends TObject<TProperties> ? { urlParams: InferParams<T> } : { urlParams?: never }) &
   (T['bodyModel'] extends TAnySchema ? { body: InferBody<T> } : { body?: never }) &
   { config?: Omit<RequestConfig, 'url'> };

/**
* Тип для фабрики репозитория
*/
export type CreatorRepository<Configs extends readonly RequestConfigData[]> = {
   [K in keyof Configs as Configs[K]['name']]: RepositoryMethod<Configs[K]>;
};

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
* Функция для создания репозитория с типизацией на основе схем
*/
export function createRepository<Configs extends readonly RequestConfigData[]>(
    requestConfigs: Configs, 
    apiClient: ReturnType<typeof createApiClient>
) {
    return requestConfigs.reduce((acc, config) => {
        const name = config.name as string;
       
        // Создаем метод для каждого конфига
        acc[name] = (requestConfig: any) => {
            // Сборка URL с параметрами
            let url = config.path;

            if(requestConfig.urlParams) {
                // Замена параметров в URL /users/:id -> /users/123
                for(const [key, value] of Object.entries(requestConfig.urlParams)) {
                    url = url.replaceAll(new RegExp(`:${key}\\b`, 'g'), String(value));
                }
            }
           
            // Добавление query параметров
            let finalUrl = url;

            if(requestConfig.query) {
                const queryParams = new URLSearchParams();

                for(const [key, value] of Object.entries(requestConfig.query)) {
                    if(Array.isArray(value)) {
                        for(const v of value) {
                            if(v !== undefined && v !== null) {
                                queryParams.append(key, String(v));
                            }
                        }
                    } else if(value !== undefined && value !== null) {
                        queryParams.set(key, String(value));
                    }
                }
                if(queryParams.toString()) {
                    const urlParts = url.split('?');

                    finalUrl = urlParts.length > 1 ? `${urlParts[0]}?${urlParts[1]}&${queryParams.toString()}` : `${url}?${queryParams.toString()}`;
                }
            }
           
            // Сборка схем для валидации
            const schemas = {
                query   : config.queryModel,
                params  : config.paramsModel,
                body    : config.bodyModel,
                response: config.responseModel,
            };
           
            // Валидация запроса если требуется (только информирование)
            if(requestConfig.config?.validate?.request) {
                if(config.queryModel && requestConfig.query) {
                    const validationError = validateSchema(config.queryModel, requestConfig.query, 'query');

                    if(validationError && requestConfig.config.validate.onValidationError) {
                        requestConfig.config.validate.onValidationError(validationError);
                    }
                }
               
                if(config.bodyModel && requestConfig.body) {
                    const validationError = validateSchema(config.bodyModel, requestConfig.body, 'body');

                    if(validationError && requestConfig.config.validate.onValidationError) {
                        requestConfig.config.validate.onValidationError(validationError);
                    }
                }
               
                if(config.paramsModel && requestConfig.urlParams) {
                    const validationError = validateSchema(config.paramsModel, requestConfig.urlParams, 'params');

                    if(validationError && requestConfig.config.validate.onValidationError) {
                        requestConfig.config.validate.onValidationError(validationError);
                    }
                }
            }
           
            const httpMethod = config.method.toUpperCase();
            const hasBody = requestConfig.body && !METHODS_WITHOUT_BODY.has(httpMethod);
           
            // Сборка финальной конфигурации
            const finalConfig: RequestConfig = {
                method: httpMethod,
                url   : finalUrl,
                schemas,
                ...requestConfig.config,
                ...(hasBody ? { body: requestConfig.body, } : {}),
            };
           
            return apiClient.createRequest<InferResponse<typeof config>>(finalConfig);
        };
       
        return acc;
    }, {} as CreatorRepository<Configs>);
}
