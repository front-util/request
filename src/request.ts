import { computed, signal } from '@preact/signals';

import { apiCache } from './cache';
import { CancellationError, HttpError, NetworkError, ParsingError, TimeoutError } from './errors';
import { InterceptorManager } from './interceptors';
import { FetchState, ReactiveStore, RequestConfig, RequestStatus } from './types';
import { isGetMethod, parseResponse, validateSchema } from './utils';

let globalRequestCounter = 0;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_EMPTY_STATUS_CODES = [204, 205] as const;

interface ServiceContext {
  baseURL: string;
  requestInterceptorsManager: InterceptorManager;
  strictValidation?: boolean;
  defaultHeaders?: Record<string, string>;
}

export function createRequestInternal<TData, TError>(
    initialConfig: RequestConfig,
    serviceContext: ServiceContext
): ReactiveStore<TData, TError> {
    const requestConfig = initialConfig;
    let activeRequestController: AbortController | null = null;
    let requestExecutionId = 0;
    let isRequestStoreDestroyed = false;
    let timeoutId: number | null = null;

    const initialState: FetchState<TData, TError> = {
        type  : 'idle',
        status: null,
        data  : undefined,
        error : undefined,
    };

    const stateSignal = signal<FetchState<TData, TError>>(initialState);

    const updateState = (newState: FetchState<TData, TError>) => {
        if(!isRequestStoreDestroyed) {
            stateSignal.value = newState;
        }
    };

    const isExplicitlyEmptyStatus = (status: number) => {
        const configEmptyCodes = requestConfig.emptyStatusCodes || [];
        const combinedCodes = [...DEFAULT_EMPTY_STATUS_CODES, ...configEmptyCodes];

        return combinedCodes.includes(status);
    };

    const isGetRequest = isGetMethod(requestConfig);

    function buildRequestUrl(url: string): string {
        const isAbsolute = url.startsWith('http') || url.startsWith('//');

        if(!isAbsolute && serviceContext.baseURL) {
            const base = serviceContext.baseURL.endsWith('/') 
                ? serviceContext.baseURL 
                : `${serviceContext.baseURL}/`;
            const path = url.startsWith('/') ? url.slice(1) : url;

            return base + path;
        }
        return url;
    }

    function clearTimeoutIfSet() {
        if(timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    async function applyInterceptors(config: RequestConfig): Promise<RequestConfig> {
        try {
            return await serviceContext.requestInterceptorsManager.applyInterceptors(config);
        } catch(_error) {
            const error = _error as Error;
            const errorState: FetchState<TData, TError> = {
                type  : 'error',
                status: null,
                data  : undefined,
                error,
            };

            updateState(errorState);
            throw error;
        }
    }

    async function handleResponse(
        response: Response,
        finalConfig: RequestConfig,
        finalUrl: string
    ): Promise<'continue'> {
        const responseClone = response.clone();
        const { status, } = response;
        let resultData: TData | null = null;

        if(response.ok) {
            try {
                resultData = await parseResponse<TData>(responseClone, finalConfig);
            } catch(error) {
                throw new ParsingError('Failed to parse successful response body', error);
            }

            if(finalConfig.validate?.response && finalConfig.schemas?.response) {
                const validationError = validateSchema(
                    finalConfig.schemas.response,
                    resultData,
                    'response'
                );

                if(validationError && finalConfig.validate.onValidationError) {
                    finalConfig.validate.onValidationError(validationError);
                }
            }

            if(isExplicitlyEmptyStatus(status)) {
                const emptyState: FetchState<TData, TError> = {
                    type : 'empty',
                    status,
                    data : undefined,
                    error: undefined,
                };

                updateState(emptyState);
                apiCache.invalidate(finalConfig);
            } else {
                const successState: FetchState<TData, TError> = {
                    type : 'success',
                    status,
                    data : resultData as TData,
                    error: undefined,
                };

                updateState(successState);

                if(finalConfig.ttl && finalConfig.ttl > 0) {
                    apiCache.set(finalConfig, resultData, status, finalConfig.ttl);
                }
            }
        } else {
            if(isExplicitlyEmptyStatus(status)) {
                const emptyState: FetchState<TData, TError> = {
                    type : 'empty',
                    status,
                    data : undefined,
                    error: undefined,
                };

                updateState(emptyState);
                apiCache.invalidate(finalConfig);
            } else {
                let errorBody: TError | undefined;

                try {
                    errorBody = (await responseClone.json()) as TError;
                } catch{
                    /* Игнорируем ошибку парсинга тела ошибки */
                }
                const httpError = new HttpError<TError>(
                    response.statusText,
                    status,
                    errorBody,
                    finalUrl,
                    finalConfig.method
                );
                const errorState: FetchState<TData, TError> = {
                    type : 'error',
                    status,
                    data : undefined,
                    error: httpError,
                };

                updateState(errorState);
                apiCache.invalidate(finalConfig);
            }
        }
        return 'continue';
    }

    async function executeRequestAttempt(
        abortSignal: AbortSignal,
        executionId: number,
        _isRefetch: boolean,
        _retryAttempt: number
    ): Promise<void> {
        if(isRequestStoreDestroyed) return;

        let previousData: TData | undefined;

        if(
            stateSignal.value.type === 'success' ||
      stateSignal.value.type === 'loading'
        ) {
            previousData = stateSignal.value.data;
        }

        updateState({
            type  : 'loading',
            status: null,
            data  : previousData,
            error : undefined,
        });

        let finalConfig: RequestConfig;

        try {
            finalConfig = await applyInterceptors(requestConfig);
        } catch(_) {
            return;
        }

        const finalUrl = buildRequestUrl(finalConfig.url);

        const headers = {
            ...serviceContext.defaultHeaders,
            ...finalConfig.headers,
        };

        if(finalConfig.timeout && finalConfig.timeout > 0) {
            timeoutId = globalThis.setTimeout(() => {
                if(activeRequestController) {
                    activeRequestController.abort();
                }
            }, finalConfig.timeout) as unknown as number;
        }

        try {
            const response = await fetch(finalUrl, {
                ...finalConfig,
                headers,
                signal: abortSignal,
            });

            clearTimeoutIfSet();

            if(abortSignal.aborted) {
                throw new CancellationError();
            }

            if(executionId !== requestExecutionId || isRequestStoreDestroyed) return;

            await handleResponse(response, finalConfig, finalUrl);
        } catch(_error) {
            clearTimeoutIfSet();

            const error = _error as Error;

            if(error.name === 'AbortError' && finalConfig.timeout) {
                throw new TimeoutError();
            }

            if(executionId !== requestExecutionId || isRequestStoreDestroyed) throw _error;
            throw _error;
        }
    }

    async function executeRequestWithRetry(
        isRefetch: boolean = false,
        retryAttempt: number = 1
    ): Promise<void> {
        if(isRequestStoreDestroyed) return;

        if(!isRefetch && isGetRequest && !requestConfig.forceRefresh) {
            const cached = apiCache.get<TData>(requestConfig);

            if(cached) {
                updateState({
                    type  : 'success',
                    status: cached.status,
                    data  : cached.data,
                    error : undefined,
                });
                return;
            }
        }

        let attempt = retryAttempt;

        while(true) {
            if(activeRequestController) {
                activeRequestController.abort();
            }

            requestExecutionId = ++globalRequestCounter;
            const executionId = requestExecutionId;

            activeRequestController = new AbortController();

            try {
                await executeRequestAttempt(
                    activeRequestController.signal,
                    executionId,
                    isRefetch,
                    attempt
                );
                return;
            } catch(_error) {
                const error = _error as Error;

                if(error instanceof DOMException && error.name === 'AbortError') return;

                const shouldRetry =
          requestConfig.retries &&
          attempt <= requestConfig.retries &&
          (requestConfig.retryOn
              ? requestConfig.retryOn(error)
              : error instanceof NetworkError ||
              error instanceof TimeoutError ||
              (error instanceof HttpError && error.status >= 500));

                if(!shouldRetry) {
                    let finalError: Error;
                    let status: RequestStatus = null;

                    if(
                        error instanceof ParsingError ||
            error instanceof HttpError ||
            error instanceof CancellationError ||
            error instanceof TimeoutError
                    ) {
                        finalError = error;
                        status = error instanceof HttpError ? error.status : null;
                    } else {
                        finalError = new NetworkError(
                            (error as Error)?.message || 'Unknown network error',
                            requestConfig.url,
                            requestConfig.method,
                            error
                        );
                    }

                    const errorState: FetchState<TData, TError> = {
                        type : 'error',
                        status,
                        data : undefined,
                        error: finalError,
                    };

                    updateState(errorState);
                    return;
                }

                const delay = (requestConfig.retryDelay || DEFAULT_RETRY_DELAY) * 2 ** (attempt - 1);

                await new Promise((resolve) => setTimeout(resolve, delay));
                attempt++;
            }
        }
    }

    const refetch = () => {
        apiCache.invalidate(requestConfig);
        return executeRequestWithRetry(true);
    };

    const cancel = () => {
        if(activeRequestController) {
            activeRequestController.abort();
        }
    };

    const destroy = () => {
        isRequestStoreDestroyed = true;
        cancel();
        clearTimeoutIfSet();
    };

    const dataComputed = computed(() => {
        const current = stateSignal.value;

        return current.type === 'success' || current.type === 'loading'
            ? current.data
            : undefined;
    });

    const isLoadingComputed = computed(() => stateSignal.value.type === 'loading');
    const isErrorComputed = computed(() => stateSignal.value.type === 'error');
    const isEmptyComputed = computed(() => stateSignal.value.type === 'empty');
    const statusComputed = computed(() => stateSignal.value.status);

    if(isGetRequest && !isRequestStoreDestroyed) {
        executeRequestWithRetry();
    }

    return {
        state    : stateSignal,
        data     : dataComputed,
        isLoading: isLoadingComputed,
        isError  : isErrorComputed,
        isEmpty  : isEmptyComputed,
        status   : statusComputed,
        refetch,
        cancel,
        destroy,
    };
}
