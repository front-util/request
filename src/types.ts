import { ReadonlySignal } from '@preact/signals';
import { Static, TObject, TSchema } from 'typebox';

import { CancellationError, HttpError, NetworkError, ParsingError, TimeoutError, ValidationError } from './errors';

export type RequestStatus = number | null;

export type FetchState<TData, TError> =
  | { type: 'idle'; status: null; data: undefined; error: undefined }
  | { type: 'loading'; status: null; data: TData | undefined; error: undefined }
  | { type: 'success'; status: number; data: TData; error: undefined }
  | { type: 'empty'; status: number; data: undefined; error: undefined }
  | { type: 'error'; status: RequestStatus; data: undefined; error: TError | NetworkError | ParsingError | HttpError | CancellationError | ValidationError | TimeoutError };

export interface RequestConfigData {
  // uniq name for request store
  name: string;
  hostname?: string;
  method: HttpMethodTypes;
  path: string;
  queryModel?: TObject;
  paramsModel?: TObject;
  bodyModel?: TSchema;
  responseModel?: TSchema;
  doc?: string;
  abortable?: boolean;
  keepalive?: boolean;
  ttl?: number;
}

export type HttpMethodTypes = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options';

export interface RequestConfig extends RequestInit {
  url: string;
  ttl?: number;
  forceRefresh?: boolean;
  responseType?: 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData';
  emptyStatusCodes?: number[];
  cacheKey?: string;
}

export type InferQuery<T> = T extends { queryModel: TObject } 
  ? Static<T['queryModel']> 
  : never;

export type InferParams<T> = T extends { paramsModel: TObject } 
  ? Static<T['paramsModel']> 
  : never;

export type InferBody<T> = T extends { bodyModel: infer TB extends TSchema } 
  ? Static<TB> 
  : never;

export type InferResponse<T> = T extends { responseModel: infer TR extends TSchema } 
  ? Static<TR> 
  : unknown;

export interface ReactiveStore<TData, TError, TConfig extends RequestConfigData> {
  $state: ReadonlySignal<FetchState<TData, TError>>;
  request: (requestParams: RequestParams<TConfig>) => Promise<void>;
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

export type RepositoryRequestConfig = {
  config?: Omit<RequestConfig, 'url' | 'method' | 'body'>;
};

export type RequestParams<T extends RequestConfigData> = (
  T['queryModel'] extends TObject ? { query: InferQuery<T> } : {query?: never;}
) & (
  T['paramsModel'] extends TObject ? { urlParams: InferParams<T> } : {urlParams?: never;}
) & (
  T['bodyModel'] extends TSchema ? { body: InferBody<T> } : {body?: never;}
) & {
  config?: Omit<RequestConfig, 'url' | 'method' | 'body'>;
};

export type RepositoryMethod<T extends RequestConfigData> = (
  requestConfig: RepositoryRequestConfig
) => ReactiveStore<InferResponse<T>, Error, T>;

export type CreatorRepository<T extends readonly RequestConfigData[]> = {
  [K in T[number]['name']]: RepositoryMethod<Extract<T[number], { name: K }>>;
};
