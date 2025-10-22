import { TSchema } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

import { ParsingError, ValidationError } from './errors';
import { RequestConfig } from './types';

export function isGetMethod(config: { method?: string | null }): boolean {
    return (config.method || 'GET').toUpperCase() === 'GET';
}

export function validateSchema(
    schema: TSchema,
    data: unknown,
    context: string
): ValidationError | null {
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
