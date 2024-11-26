import { HttpStatusCode } from "./httpCodes";
import { createHttpService } from "./httpFactory";

export type ResponseType =
    | 'arraybuffer'
    | 'blob'
    | 'document'
    | 'json'
    | 'text'
    | 'stream';

export interface ServerError {
    message?: string;
    code?: number;
    status?: number;
}

export type LoadError = string | null;

export interface StandartErrorResponse {
    message: string;
    code?: number;
    error?: string;
    status?: number;
    timestamp?: number;
    path?: string;
}

export type RequestHeaders = Record<string, string>;

export interface RequestConfig extends RequestInit {
    headers?: RequestHeaders;
}

export type NativeHttpService = ReturnType<typeof createHttpService>;

export type HttpMethods = 'GET' | 'POST' | 'DELETE';

export type HttpStatusCodeExtended = (number & HttpStatusCode) | null;

export interface ErrorResult {
    result?: never;
    errorData?: ServerError | null;
    error: LoadError | null;
    status?: HttpStatusCodeExtended | -1;
    isCancelled?: boolean;
}

export interface EmptyResult {
    result?: never;
    status?: HttpStatusCode.NO_CONTENT;
    error?: never;
    errorData?: never;
    isCancelled?: never;
}

export interface SuccessResult<T> {
    result: T;
    status: HttpStatusCode.OK | HttpStatusCode.NO_CONTENT;
    error?: never;
    errorData?: never;
    isCancelled?: never;
}

export type HttpRequestResult<T> = SuccessResult<T> | ErrorResult | EmptyResult;

export interface HttpService {
    request: <T>({ url, params, ...options }: NativeHttpRequestParams) => Promise<HttpRequestResult<T>>;
    interceptors: {
        request: {
            use: (interceptor: (config: NativeHttpInterceptorsParams) => NativeHttpInterceptorsParams) => void;
        };
    };
}

export interface HttpRequestParams {
    url: string;
    method?: HttpMethods;
    params?: object;
    headers?: RequestHeaders;
    httpService: HttpService;
    responseType?: ResponseType;
}

export type NativeHttpRequestParams = Pick<HttpRequestParams, 'url' | 'params'> & RequestConfig & {
    responseType?: ResponseType;
    /** пропуск парсинга результата успешного запроса */
    skipResult?: boolean;
};

export type NativeHttpInterceptorsParams = Omit<NativeHttpRequestParams, 'params' | 'method' | 'url'> & Pick<HttpRequestParams, 'method' | 'url'>;

export interface NativeHttpRequestParamsWithAdapapter<T> extends NativeHttpRequestParams {
    adapter?: (data: Response) => Promise<T | undefined>;
    /** используется при загрузке blob - возвращает размер загружаемых чанков и общий размер (при наличии в заголовке)  */
    onLoadProcess?: (chinkSize: number, fullSize?: number) => void;
};

export type Interceptor = (config: NativeHttpInterceptorsParams) => NativeHttpInterceptorsParams;