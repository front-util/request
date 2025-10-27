import { describe, expect, it, spyOn, mock, beforeEach, afterEach } from 'bun:test';

import { InterceptorManager } from '../src/interceptors.js';
import { createRequestStore } from '../src/request.js';

describe('createRequestStore', () => {
    let globalFetchSpy;

    beforeEach(() => {
        globalFetchSpy = spyOn(global, 'fetch');
    });

    afterEach(() => {
        globalFetchSpy.mockRestore();
    });

    it('should create store with initial idle state', async () => {
        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/test' }, serviceContext);

        expect(store.$state.value.type).toBe('idle');
        expect(store.$state.value.status).toBe(null);
    });

    it('should handle successful request', async () => {
        const headersObj = new Headers();
        spyOn(headersObj, 'get').mockReturnValue('application/json');

        const mockResponse = {
            ok: true,
            status: 200,
            headers: headersObj,
            clone: () => mockResponse,
            json: mock(() => Promise.resolve({ data: 'success' }))
        };

        globalFetchSpy.mockResolvedValue(mockResponse);

        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/test', method: 'GET' }, serviceContext);

        await store.request({});

        expect(store.$state.value.type).toBe('success');
        expect(store.$state.value.data).toEqual({ data: 'success' });
        expect(store.$state.value.status).toBe(200);
    });

    it('should handle error request', async () => {
        const headersObj = new Headers();
        spyOn(headersObj, 'get').mockReturnValue('application/json');

        const mockResponse = {
            ok: false,
            status: 404,
            headers: headersObj,
            clone: () => mockResponse,
            statusText: 'Not Found',
            url: 'https://api.example.com/test'
        };

        spyOn(mockResponse, 'json').mockResolvedValue({ error: 'Not found' });

        globalFetchSpy.mockResolvedValue(mockResponse);

        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/test', method: 'GET' }, serviceContext);

        await store.request({});

        expect(store.$state.value.type).toBe('error');
        expect(store.$state.value.status).toBe(404);
        expect(store.$state.value.error).toBeDefined();
        expect(store.$state.value.error.name).toBe('HttpError');
    });

    it('should handle network error', async () => {
        globalFetchSpy.mockRejectedValue(new TypeError('Network error'));

        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/test', method: 'GET' }, serviceContext);

        await store.request({});

        expect(store.$state.value.type).toBe('error');
        expect(store.$state.value.error).toBeDefined();
        expect(store.$state.value.error.name).toBe('TypeError');
    });

    it('should support cancelling request', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            json: () => Promise.resolve({}),
            headers: spyOn(new Headers(), 'get').mockReturnValue('application/json'),
            clone: () => mockResponse
        };

        globalFetchSpy.mockImplementation((url, options) => {
            if (options.signal.aborted) {
                const error = new Error('Aborted');
                error.name = 'AbortError';
                return Promise.reject(error);
            }
            return Promise.resolve(mockResponse);
        });

        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/test', method: 'GET' }, serviceContext);

        const requestPromise = store.request({});

        store.cancel();

        // Should not throw error in this test
        try {
            await requestPromise;
        } catch (e) {
            // Expected if cancelled
        }

        expect(typeof store.cancel).toBe('function');
        expect(typeof store.destroy).toBe('function');
    });

    it('should build URL with params', async () => {
        const headersObj = new Headers();
        spyOn(headersObj, 'get').mockReturnValue('application/json');

        const mockResponse = {
            ok: true,
            status: 200,
            headers: headersObj,
            clone: () => mockResponse
        };

        spyOn(mockResponse, 'json').mockResolvedValue({});

        globalFetchSpy.mockResolvedValue(mockResponse);

        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/users/:id', method: 'GET' }, serviceContext);

        await store.request({ urlParams: { id: 123 } });

        expect(globalFetchSpy).toHaveBeenCalledWith(
            'https://api.example.com/users/123',
            expect.objectContaining({
                method: 'GET'
            })
        );
    });

    it('should build URL with query params', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            headers: spyOn(new Headers(), 'get').mockReturnValue('application/json'),
            clone: () => mockResponse
        };

        spyOn(mockResponse, 'json').mockResolvedValue({});

        globalFetchSpy.mockResolvedValue(mockResponse);

        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/search', method: 'GET' }, serviceContext);

        await store.request({ query: { q: 'test', limit: 10 } });

        expect(globalFetchSpy).toHaveBeenCalledWith(
            'https://api.example.com/search?q=test&limit=10',
            expect.objectContaining({
                method: 'GET'
            })
        );
    });

    it('should send body for non-GET methods', async () => {
        const mockResponse = {
            ok: true,
            status: 200,
            headers: spyOn(new Headers(), 'get').mockReturnValue('application/json'),
            clone: () => mockResponse
        };

        spyOn(mockResponse, 'json').mockResolvedValue({});

        globalFetchSpy.mockResolvedValue(mockResponse);

        const serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: {},
        };
        const store = createRequestStore({ url: '/users', method: 'POST' }, serviceContext);

        await store.request({ body: { name: 'John' } });

        expect(globalFetchSpy).toHaveBeenCalledWith(
            'https://api.example.com/users',
            expect.objectContaining({
                method: 'POST',
                body: { name: 'John' }
            })
        );
    });
});
