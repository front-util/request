import { ReadonlySignal } from '@preact/signals';
import { Static, TAnySchema, TObject } from '@sinclair/typebox';

import { CancellationError, HttpError, NetworkError, ParsingError, TimeoutError, ValidationError } from './errors';

export type RequestStatus = number | null;

export type FetchState<TData, TError> =
  | { type: 'idle'; status: null; data: undefined; error: undefined }
  | { type: 'loading'; status: null; data: TData | undefined; error: undefined }
  | { type: 'success'; status: number; data: TData; error: undefined }
  | { type: 'empty'; status: number; data: undefined; error: undefined }
  | { type: 'error'; status: RequestStatus; data: undefined; error: TError | NetworkError | ParsingError | HttpError | CancellationError | ValidationError | TimeoutError };

export interface RequestConfigData {
  name: string;
  hostname?: string;
  method: HttpMethodTypes;
  path: string;
  queryModel?: TObject;
  paramsModel?: TObject;
  bodyModel?: TAnySchema;
  responseModel?: TAnySchema;
  doc?: string;
  abortable?: boolean;
  keepalive?: boolean;
}

export type HttpMethodTypes = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options';

export interface RequestConfig extends RequestInit {
  url: string;
  ttl?: number;
  timeout?: number;
  forceRefresh?: boolean;
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';
  emptyStatusCodes?: number[];
  validate?: {
    request?: boolean;
    response?: boolean;
    onValidationError?: (error: ValidationError) => void;
  };
  cacheKey?: string;
  retries?: number;
  retryDelay?: number;
  retryOn?: (error: Error) => boolean;
  schemas?: {
    query?: TAnySchema;
    params?: TAnySchema;
    body?: TAnySchema;
    response?: TAnySchema;
  };
}

export type InferQuery<T> = T extends { queryModel: TObject } 
  ? Static<T['queryModel']> 
  : Record<string, never>;

export type InferParams<T> = T extends { paramsModel: TObject } 
  ? Static<T['paramsModel']> 
  : Record<string, never>;

export type InferBody<T> = T extends { bodyModel: infer TB extends TAnySchema } 
  ? Static<TB> 
  : never;

export type InferResponse<T> = T extends { responseModel: infer TR extends TAnySchema } 
  ? Static<TR> 
  : unknown;

export interface ReactiveStore<TData, TError> {
  state: ReadonlySignal<FetchState<TData, TError>>;
  refetch: () => Promise<void>;
  cancel: () => void;
  destroy: () => void;
}

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

export interface ServiceConfig {
  baseURL?: string;
  requestInterceptors?: RequestInterceptor[];
  strictValidation?: boolean;
  defaultHeaders?: Record<string, string>;
}

export interface CacheEntry<TData = unknown> {
  data: TData;
  status: number;
  ttlTimestamp: number;
}

export type RepositoryRequestConfig<T extends RequestConfigData> = {
  query?: InferQuery<T>;
  urlParams?: InferParams<T>;
  body?: InferBody<T>;
  config?: Omit<RequestConfig, 'url' | 'method' | 'body'>;
};

export type RepositoryMethod<T extends RequestConfigData> = (
  requestConfig: RepositoryRequestConfig<T>
) => ReactiveStore<InferResponse<T>, Error>;

export type CreatorRepository<T extends readonly RequestConfigData[]> = {
  [K in T[number]['name']]: RepositoryMethod<Extract<T[number], { name: K }>>;
};
