import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';
import { Type } from '@sinclair/typebox';

import { createRequestInternal } from '../src/request.js';
import { apiCache } from '../src/cache.js';
import { InterceptorManager } from '../src/interceptors.js';

const mockFetch = mock(() => {});
global.fetch = mockFetch;

describe('createRequestInternal', () => {
    let store;
    let serviceContext;

    beforeEach(() => {
        mockFetch.mockReset();
        serviceContext = {
            baseURL: 'https://api.example.com',
            requestInterceptorsManager: new InterceptorManager(),
            strictValidation: false,
            defaultHeaders: { common: 'header' },
        };
    });

    afterEach(() => {
        if (store) {
            store.destroy();
        }
    });

    describe('GET requests', () => {
        test('should fetch data from cache if available', async () => {
            const mockCached = {
                data: { cached: true },
                status: 200,
                ttlTimestamp: Date.now() + 10000,
            };
            const originalGet = apiCache.get;
            apiCache.get = mock(() => mockCached);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Promise.resolve();
            
            expect(mockFetch).not.toHaveBeenCalled();
            expect(store.state.value).toEqual({
                type: 'success',
                status: 200,
                data: { cached: true },
                error: undefined,
            });

            apiCache.get = originalGet;
        });

        test('should fetch data from network if not cached', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ data: 'success' }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(mockFetch).toHaveBeenCalled();
            expect(store.state.value).toEqual({
                type: 'success',
                status: 200,
                data: { data: 'success' },
                error: undefined,
            });

            apiCache.get = originalGet;
        });

        test('should handle empty status codes', async () => {
            const mockResponse = {
                ok: true,
                status: 204,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({}),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            const originalInvalidate = apiCache.invalidate;
            apiCache.get = mock(() => null);
            apiCache.invalidate = mock(() => {});

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(store.state.value).toEqual({
                type: 'empty',
                status: 204,
                data: undefined,
                error: undefined,
            });
            expect(apiCache.invalidate).toHaveBeenCalled();

            apiCache.get = originalGet;
            apiCache.invalidate = originalInvalidate;
        });

        test('should cache successful responses', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ cached: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            const originalSet = apiCache.set;
            apiCache.get = mock(() => null);
            apiCache.set = mock(() => {});

            const config = { url: '/users', method: 'GET', ttl: 5000 };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(apiCache.set).toHaveBeenCalled();

            apiCache.get = originalGet;
            apiCache.set = originalSet;
        });

        test('should skip caching if ttl is 0', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ data: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            const originalSet = apiCache.set;
            apiCache.get = mock(() => null);
            apiCache.set = mock(() => {});

            const config = { url: '/users', method: 'GET', ttl: 0 };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(store.state.value.type).toBe('success');
            expect(apiCache.set).not.toHaveBeenCalled();

            apiCache.get = originalGet;
            apiCache.set = originalSet;
        });
    });

    describe('POST requests', () => {
        test('should include body in request', async () => {
            const mockResponse = {
                ok: true,
                status: 201,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ created: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);

            const config = { url: '/users', method: 'POST', body: JSON.stringify({ name: 'John' }) };
            store = createRequestInternal(config, serviceContext);

            store.refetch()

            await Bun.sleep(50);
            
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ name: 'John' }),
                    headers: expect.objectContaining({ common: 'header' }),
                })
            );
        });

        test('should include body in request when refetch is called', async () => {
            const mockResponse = {
                ok: true,
                status: 201,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ created: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);

            const config = { url: '/users', method: 'POST', body: JSON.stringify({ name: 'John' }) };
            store = createRequestInternal(config, serviceContext);

            await store.refetch();
            await Bun.sleep(50);
            
            expect(mockFetch).toHaveBeenCalled();
            expect(mockFetch.mock.calls[0][0]).toBe('https://api.example.com/users');
            expect(mockFetch.mock.calls[0][1].method).toBe('POST');
            expect(mockFetch.mock.calls[0][1].body).toBe(JSON.stringify({ name: 'John' }));
            expect(mockFetch.mock.calls[0][1].headers).toMatchObject({ common: 'header' });
        });

    });

    describe('error handling', () => {
        test('should handle network errors', async () => {
            mockFetch.mockRejectedValue(new TypeError('Network error'));
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(store.state.value.type).toBe('error');
            expect(store.state.value.error.name).toBe('NetworkError');

            apiCache.get = originalGet;
        });

        test('should handle HTTP errors', async () => {
            const mockResponse = {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ error: 'Not found' }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            const originalInvalidate = apiCache.invalidate;
            apiCache.get = mock(() => null);
            apiCache.invalidate = mock(() => {});

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(store.state.value.type).toBe('error');
            expect(store.state.value.status).toBe(404);
            expect(store.state.value.error.name).toBe('HttpError');
            expect(apiCache.invalidate).toHaveBeenCalled();

            apiCache.get = originalGet;
            apiCache.invalidate = originalInvalidate;
        });

        test('should handle timeout errors', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET', timeout: 50 };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(100);
            
            expect(store.state.value.type).toBe('error');
            expect(store.state.value.error.name).toBe('TimeoutError');

            apiCache.get = originalGet;
        });

        test('should parse response body correctly', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ parsed: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(store.state.value.data).toEqual({ parsed: true });

            apiCache.get = originalGet;
        });
    });

    describe('cancellation', () => {
        test('should handle cancellation via cancel method', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(10);
            store.cancel();

            expect(['idle', 'loading']).toContain(store.state.value.type);

            apiCache.get = originalGet;
        });

        test('should destroy and clean up', () => {
            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            store.destroy();

            expect(() => store.cancel()).not.toThrow();
        });
    });

    describe('interceptors', () => {
        test('should apply interceptors to config', async () => {
            const interceptor = mock((config) => Promise.resolve({ ...config, modified: true }));
            serviceContext.requestInterceptorsManager.use(interceptor);

            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ success: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(interceptor).toHaveBeenCalled();
            expect(mockFetch).toHaveBeenCalled();

            apiCache.get = originalGet;
        });

        test('should handle interceptor errors', async () => {
            const interceptor = mock(() => {
                throw new Error('Interceptor error');
            });
            serviceContext.requestInterceptorsManager.use(interceptor);
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(store.state.value.type).toBe('error');
            expect(store.state.value.error.message).toBe('Interceptor error');

            apiCache.get = originalGet;
        });
    });

    describe('validation', () => {
        test('should validate response if enabled', async () => {
            const schema = Type.Object({ success: Type.Boolean() });
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ success: 123 }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);
            const onValidationError = mock(() => {});

            const config = {
                url: '/users',
                method: 'GET',
                validate: { response: true, onValidationError },
                schemas: { response: schema },
            };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(onValidationError).toHaveBeenCalled();

            apiCache.get = originalGet;
        });
    });

    describe('refetch', () => {
        test('should invalidate cache and refetch', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ refetched: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            
            const originalGet = apiCache.get;
            const originalInvalidate = apiCache.invalidate;
            let callCount = 0;
            apiCache.get = mock(() => {
                callCount++;
                if (callCount === 1) {
                    return { data: { old: true }, status: 200, ttlTimestamp: Date.now() + 10000 };
                }
                return null;
            });
            apiCache.invalidate = mock(() => {});

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Promise.resolve();
            expect(store.state.value.data).toEqual({ old: true });

            await store.refetch();
            await Bun.sleep(50);
            
            expect(apiCache.invalidate).toHaveBeenCalled();
            expect(store.state.value.data).toEqual({ refetched: true });

            apiCache.get = originalGet;
            apiCache.invalidate = originalInvalidate;
        });
    });

    describe('computed properties', () => {
        test('should compute data correctly', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ success: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(store.data.value).toEqual({ success: true });
            expect(store.isLoading.value).toBe(false);
            expect(store.isError.value).toBe(false);
            expect(store.isEmpty.value).toBe(false);
            expect(store.status.value).toBe(200);

            apiCache.get = originalGet;
        });
    });

    describe('URL building', () => {
        test('should handle absolute URLs', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ success: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);

            const config = { url: 'https://example.com/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(mockFetch).toHaveBeenCalledWith(
                'https://example.com/users',
                expect.any(Object)
            );
        });

        test('should append base URL for relative paths', async () => {
            const mockResponse = {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                clone: () => mockResponse,
                json: () => Promise.resolve({ success: true }),
            };
            mockFetch.mockResolvedValue(mockResponse);
            const originalGet = apiCache.get;
            apiCache.get = mock(() => null);

            const config = { url: '/users', method: 'GET' };
            store = createRequestInternal(config, serviceContext);

            await Bun.sleep(50);
            
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.any(Object)
            );

            apiCache.get = originalGet;
        });
    });
});
