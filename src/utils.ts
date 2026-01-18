import { encodeQueryParams } from '@front-utils/utils';

import { ParsingError } from './errors';
import { RequestConfig } from './types';

export function isGetMethod(config: { method?: string | null }): boolean {
    return (config.method || 'GET').toUpperCase() === 'GET';
}

export function inferResponseType(
    contentType: string
): 'json' | 'text' | 'blob' | 'arrayBuffer' | 'formData' {
    if(contentType.includes('json')) return 'json';
    if(contentType.includes('form-data')) return 'formData';
    if(contentType.includes('text')) return 'text';
    return 'blob';
}

export async function parseResponse<TData>(
    response: Response,
    config: Pick<RequestConfig, 'responseType'>
): Promise<TData | null> {
    const contentType = response.headers.get('content-type') || '';
    const responseType = config.responseType || inferResponseType(contentType);

    if(response.status === 204 || response.status === 205) {
        return null;
    }

    try {
        let parsedBody: unknown = null;

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
            case 'arrayBuffer': {
                parsedBody = await response.arrayBuffer();
                break;
            }
            case 'formData': {
                parsedBody = await response.formData().catch(() => null);
                break;
            }
        }

        if(parsedBody === null || parsedBody === undefined) {
            return null;
        }

        return parsedBody as TData;
    } catch(error) {
        throw new ParsingError(`Failed to parse response body as ${responseType}`, error);
    }
}

export function escapeRegExp(string: string): string {
    return string.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

export function replaceParam(urlSegment: string, key: string, value: unknown): string {
    if(value === undefined || value === null) {
        return urlSegment;
    }
    // eslint-disable-next-line security/detect-non-literal-regexp
    const pattern = new RegExp(`:${escapeRegExp(key)}\\b`, 'g');

    return urlSegment.replace(pattern, encodeURIComponent(String(value)));
}

export function buildUrlWithParams(path: string, urlParams: Record<string, unknown>): string {
    let url = path;

    for(const [key, value] of Object.entries(urlParams)) {
        url = replaceParam(url, key, value);
    }
    return url;
}

export function appendQueryParams(url: string, query: Record<string, unknown>): string {
    const queryParams = encodeQueryParams(query);
    const queryString = queryParams?.toString?.();

    if(!queryString) return url;

    const urlParts = url.split('?');

    return urlParts.length > 1 ? `${urlParts[0]}?${urlParts[1]}&${queryString}` : `${url}?${queryString}`;
}

export function isEmptyStatus(
    status: number,
    configEmptyCodes?: number[]
): boolean {
    const defaultCodes = [204, 205];
    const combinedCodes = configEmptyCodes ? [...defaultCodes, ...configEmptyCodes] : defaultCodes;

    return combinedCodes.includes(status);
}

export function buildRequestUrl(url: string, baseURL: string): string {
    if(!baseURL) return url;
    if(url.startsWith('http')) return url;
    const emptyUrl = new URL('', baseURL);
    const pathname = `${emptyUrl.pathname}/${url}`.replaceAll(/\/{2,}/g, "/");

    return new URL(pathname, emptyUrl).href;
}

export function checkIsJSON(headers: Record<string, string>, body: unknown) {
    const headersFinal = new Headers(headers);
    const isJSONByHeader = headersFinal.get('content-type')?.includes("application/json");

    return isJSONByHeader && (typeof body === 'object' || Array.isArray(body));
}
