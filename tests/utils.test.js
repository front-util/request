import Type from 'typebox';
import { describe, expect, it } from 'bun:test';

import {
    buildUrlWithParams,
    escapeRegExp,
    inferResponseType,
    isGetMethod,
    parseResponse,
    replaceParam,
    validateSchema,
    buildRequestUrl
} from '../src/utils.js';

describe('buildRequestUrl', () => {
    it('1 - should return valid url', () => {
        expect(buildRequestUrl('/somepath', 'https://test.ru')).toBe('https://test.ru/somepath');
    });

    it('2 - should return valid url', () => {
        expect(buildRequestUrl('/somepath', 'https://test.ru/')).toBe('https://test.ru/somepath');
    });

    it('3 - should return valid url', () => {
        expect(buildRequestUrl('somepath', 'https://test.ru/')).toBe('https://test.ru/somepath');
    });

    it('4 - should return valid url', () => {
        expect(buildRequestUrl('/somepath', '')).toBe('/somepath');
    });

    it('5 - should return valid url', () => {
        expect(buildRequestUrl('https://somepath', 'https://test.ru')).toBe('https://somepath');
    });

    it('6 - should return valid url', () => {
        expect(buildRequestUrl('/somepath', 'https://test.ru/innerurl/url/')).toBe('https://test.ru/innerurl/url/somepath');
    });
});

describe('isGetMethod', () => {
    it('should return true for GET method', () => {
        expect(isGetMethod({ method: 'GET', })).toBe(true);
        expect(isGetMethod({ method: 'get', })).toBe(true);
    });

    it('should return true for default method (assuming GET)', () => {
        expect(isGetMethod({})).toBe(true);
        expect(isGetMethod({ method: null, })).toBe(true);
    });

    it('should return false for non-GET methods', () => {
        expect(isGetMethod({ method: 'POST', })).toBe(false);
        expect(isGetMethod({ method: 'PUT', })).toBe(false);
    });
});

describe('validateSchema', () => {
    const schema = Type.Object({
        name: Type.String(),
        age : Type.Number(),
    });

    it('should return null for valid data', () => {
        const result = validateSchema(schema, { name: 'John', age: 30, }, 'test');

        expect(result).toBeNull();
    });

    it('should return ValidationError for invalid data', () => {
        const result = validateSchema(schema, { name: 'John', age: '30', }, 'test');

        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('Validation Error: Invalid test data');
    });

    it('should return null if no schema', () => {
        const result = validateSchema(null, { name: 'John', }, 'test');

        expect(result).toBeNull();
    });
});

describe('inferResponseType', () => {
    it('should infer json for json content-type', () => {
        expect(inferResponseType('application/json')).toBe('json');
    });

    it('should infer formData for form-data content-type', () => {
        expect(inferResponseType('multipart/form-data')).toBe('formData');
    });

    it('should infer text for text content-type', () => {
        expect(inferResponseType('text/plain')).toBe('text');
    });

    it('should infer blob as default', () => {
        expect(inferResponseType('application/octet-stream')).toBe('blob');
    });
});

describe('parseResponse', () => {
    it('should return null for status 204', async () => {
        const mockResponse = {
            status     : 204,
            headers    : { get: () => '', },
            json       : () => Promise.resolve(null),
            text       : () => Promise.resolve(''),
            blob       : () => Promise.resolve(null),
            arrayBuffer: () => Promise.resolve(null),
            formData   : () => Promise.resolve(null),
        };

        const result = await parseResponse(mockResponse, {});

        expect(result).toBeNull();
    });

    it('should parse json response', async () => {
        const mockResponse = {
            status     : 200,
            headers    : { get: () => 'application/json', },
            json       : () => Promise.resolve({ key: 'value', }),
            text       : () => Promise.resolve(''),
            blob       : () => Promise.resolve(null),
            arrayBuffer: () => Promise.resolve(null),
            formData   : () => Promise.resolve(null),
        };

        const result = await parseResponse(mockResponse, {});

        expect(result).toEqual({ key: 'value', });
    });

    it('should parse text response', async () => {
        const mockResponse = {
            status     : 200,
            headers    : { get: () => 'text/plain', },
            json       : () => Promise.resolve(null),
            text       : () => Promise.resolve('hello'),
            blob       : () => Promise.resolve(null),
            arrayBuffer: () => Promise.resolve(null),
            formData   : () => Promise.resolve(null),
        };

        const result = await parseResponse(mockResponse, {});

        expect(result).toBe('hello');
    });
});

describe('escapeRegExp', () => {
    it('should escape special regex characters', () => {
        expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
    });

    it('should return unchanged string for normal string', () => {
        expect(escapeRegExp('hello')).toBe('hello');
    });
});

describe('replaceParam', () => {
    it('should replace parameter in url segment', () => {
        expect(replaceParam('/users/:id', 'id', 123)).toBe('/users/123');
    });

    it('should not replace if value is null or undefined', () => {
        expect(replaceParam('/users/:id', 'id', null)).toBe('/users/:id');
        expect(replaceParam('/users/:id', 'id')).toBe('/users/:id');
    });

    it('should encode value', () => {
        expect(replaceParam('/search/:query', 'query', 'hello world')).toBe('/search/hello%20world');
    });
});

describe('buildUrlWithParams', () => {
    it('should build url with multiple params', () => {
        const result = buildUrlWithParams('/users/:id/posts/:postId', {
            id    : 123,
            postId: 456,
        });

        expect(result).toBe('/users/123/posts/456');
    });

    it('should leave unmatched params as is', () => {
        const result = buildUrlWithParams('/users/:id/posts/:postId', {
            id: 123,
        });

        expect(result).toBe('/users/123/posts/:postId');
    });
});
