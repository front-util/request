import { signal } from '@preact/signals';

import { CancellationError, HttpError, ParsingError } from './errors';
import { InterceptorManager } from './interceptors';
import { cacheStore } from './store';
import { FetchState, ReactiveStore, RequestConfig, RequestConfigData, RequestParams } from './types';
import { appendQueryParams, buildRequestUrl, buildUrlWithParams, isEmptyStatus, isGetMethod, parseResponse } from './utils';

interface ServiceContext {
  baseURL: string;
  requestInterceptorsManager: InterceptorManager;
  strictValidation?: boolean;
  defaultHeaders?: Record<string, string>;
}

export function createRequestStore<TData, TError, TConfig extends RequestConfigData>(
    initialConfig: RequestConfig,
    serviceContext: ServiceContext
): ReactiveStore<TData, TError, TConfig> {
    const requestConfig = {
        ...initialConfig,
    };
    let activeRequestController: AbortController | null = null;
    let isRequestStoreDestroyed = false;
    const stateSignal = signal<FetchState<TData, TError>>({
        type  : 'idle',
        status: null,
        data  : undefined,
        error : undefined,
    });
    const isGetRequest = isGetMethod(requestConfig);

    const updateState = (newState: FetchState<TData, TError>) => {
        if(!isRequestStoreDestroyed) {
            stateSignal.value = newState;
        }
    };

    async function handleResponse(
        response: Response,
        finalConfig: RequestConfig,
        finalUrl: string
    ): Promise<FetchState<TData, TError>> {
        const responseClone = response.clone();
        const { status, } = response;
        let resultData: TData | null = null;

        if(response.ok) {
            try {
                resultData = await parseResponse<TData>(responseClone, finalConfig);
            } catch(error) {
                throw new ParsingError('Failed to parse successful response body', error);
            }

            if(isEmptyStatus(status, requestConfig.emptyStatusCodes || [])) {
                cacheStore.invalidate(finalConfig);
                return {
                    type : 'empty',
                    status,
                    data : undefined,
                    error: undefined,
                };
            }
            if(finalConfig.ttl && finalConfig.ttl > 0) {
                cacheStore.set(finalConfig, resultData, status, finalConfig.ttl);
            }
            return {
                type : 'success',
                status,
                data : resultData as TData,
                error: undefined,
            };
        } else {
            let errorBody: TError | undefined;

            try {
                errorBody = (await responseClone.json()) as TError;
            } catch{
                /* Игнорируем ошибку парсинга тела ошибки */
            }
            cacheStore.invalidate(finalConfig);

            return {
                type : 'error',
                status,
                data : undefined,
                error: new HttpError<TError>(
                    response.statusText,
                    status,
                    errorBody,
                    finalUrl,
                    finalConfig.method
                ),
            };
        }
    }

    const buildFinalConfig = (reqParams: RequestParams<TConfig>): RequestConfig => {
        const urlWithParams = buildUrlWithParams(requestConfig.url, reqParams.urlParams || {});
        const finalUrl = appendQueryParams(urlWithParams, reqParams.query || {});
        const finalConfig: RequestConfig = {
            ...requestConfig,
            ...reqParams.config,
            url: finalUrl,
        };

        if(reqParams.body && !isGetMethod(finalConfig)) {
            finalConfig.body = reqParams.body as BodyInit;
        }
        return finalConfig;
    };

    const checkCache = (config: RequestConfig): boolean => {
        if(isGetRequest && !config.forceRefresh) {
            const cached = cacheStore.get<TData>(config);

            if(cached) {
                updateState({
                    type  : 'success',
                    status: cached.status,
                    data  : cached.data,
                    error : undefined,
                });
                return true;
            }
        }
        return false;
    };

    const performRequest = async (config: RequestConfig): Promise<void> => {
        if(activeRequestController && !activeRequestController.signal.aborted) {
            activeRequestController.abort();
        }
        activeRequestController = new AbortController();

        updateState({
            type  : 'loading',
            status: null,
            data  : stateSignal.value.type === 'success' ? stateSignal.value.data : undefined,
            error : undefined,
        });

        try {
            const finalConfig = await serviceContext.requestInterceptorsManager.applyInterceptors(config);
            const finalUrl = buildRequestUrl(finalConfig.url, serviceContext.baseURL);
            const headers = {
                ...serviceContext.defaultHeaders,
                ...finalConfig.headers,
            };
            const response = await fetch(finalUrl, {
                ...finalConfig,
                headers,
                signal: activeRequestController?.signal,
            });

            if(activeRequestController?.signal.aborted) {
                updateState({
                    type  : 'error',
                    status: null,
                    data  : undefined,
                    error : new CancellationError(),
                });
                return;
            }
            const resultState = await handleResponse(response, finalConfig, finalUrl);

            updateState(resultState);
        } catch(error) {
            const finalErr = (error instanceof DOMException && error.name === 'AbortError') ? 
                new CancellationError() : 
                error as Error;

            updateState({
                type  : 'error',
                status: null,
                data  : undefined,
                error : finalErr,
            });
        }
    };

    const request = async (reqParams: RequestParams<TConfig>): Promise<void> => {
        const finalConfig = buildFinalConfig(reqParams);

        if(checkCache(finalConfig)) {
            return;
        }
        await performRequest(finalConfig);
    };

    const cancel = () => {
        if(activeRequestController) {
            activeRequestController.abort();
        }
    };

    const destroy = () => {
        isRequestStoreDestroyed = true;
        cancel();
    };

    return {
        $state: stateSignal,
        request,
        cancel,
        destroy,
    };
}
