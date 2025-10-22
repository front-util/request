import { describe, expect, it, mock, spyOn } from 'bun:test';
import { Type } from '@sinclair/typebox';
import { ValidationError } from '../src/errors.js';

import { createApiClient, createRepository, clearAllApiCache } from '../src/client.js';
import { apiCache } from '../src/cache.js';


describe('createApiClient', () => {
    it('should create api client with default config', () => {
        const client = createApiClient();

        expect(client).toHaveProperty('createRequest');
        expect(client).toHaveProperty('interceptors');
        expect(client.interceptors).toHaveProperty('request');
        expect(client.interceptors.request).toHaveProperty('use');
        expect(client.interceptors.request).toHaveProperty('eject');
        expect(client).toHaveProperty('invalidateCache');
        expect(client).toHaveProperty('invalidateCacheByPattern');
        expect(client).toHaveProperty('clearCache');
    });

    it('should add request interceptors', () => {
        const interceptor = mock();
        const client = createApiClient({
            requestInterceptors: [interceptor],
        });

        const result = client.interceptors.request.use(interceptor);
        expect(result).toBe(1);
    });

    it('should handle empty interceptors config', () => {
        const client = createApiClient({ requestInterceptors: [] });

        expect(client.interceptors.request.use(mock())).toBe(0);
    });

    it('should create client with cache methods available', () => {
        const client = createApiClient();

        expect(typeof client.invalidateCache).toBe('function');
        expect(typeof client.invalidateCacheByPattern).toBe('function');
        expect(typeof client.clearCache).toBe('function');
    });
});

describe('createRepository', () => {
    const mockApiClient = {
        createRequest: mock(),
    };

    const requestConfig = {
        name      : 'getUser',
        hostname  : 'api.example.com',
        method    : 'get',
        path      : '/users/:id',
        paramsModel: Type.Object({ id: Type.String() }),
        queryModel : Type.Object({ active: Type.Boolean() }),
        bodyModel  : Type.Object({ name: Type.String() }),
        responseModel: Type.Object({ id: Type.String(), name: Type.String() }),
    };
      const endpoints = [
    {
      name: 'getUser',
      method: 'get',
      path: '/users/:id',
      paramsModel: Type.Object({ id: Type.String() }),
      queryModel: Type.Object({ includeDetails: Type.Optional(Type.Boolean()) }),
      responseModel: Type.Object({ id: Type.String(), name: Type.String() }),
    },
    {
      name: 'createUser',
      method: 'post',
      path: '/users',
      bodyModel: Type.Object({ name: Type.String(), email: Type.String() }),
      responseModel: Type.Object({ id: Type.String(), name: Type.String(), email: Type.String() }),
    },
  ];

  const apiClient = createApiClient({
    baseURL: 'https://api.example.com',
    strictValidation: true,
    defaultHeaders: { 'Content-Type': 'application/json' },
  });

  const repo = createRepository(endpoints, apiClient);

  it('should call onValidationError for invalid parameter types', () => {
    const onValidationError = mock();

    repo.getUser({
      urlParams: { id: 123 }, // invalid type, should be string
      query: { includeDetails: 'yes' }, // invalid type, should be boolean
      config: { validate: { request: true, onValidationError } }
    });

    expect(onValidationError).toHaveBeenCalled();
    expect(onValidationError.mock.calls[0][0]).toBeInstanceOf(ValidationError);
  });

  it('should use forceRefresh to bypass cache', () => {
    const spyCreateRequest = spyOn(apiClient, 'createRequest');
    repo.getUser({
      urlParams: { id: 'abc' },
      config: { forceRefresh: true }
    });
    expect(spyCreateRequest).toHaveBeenCalled();
  });

  it('should not include body in GET request', () => {
    const spyCreateRequest = spyOn(apiClient, 'createRequest');
    repo.getUser({
      urlParams: { id: 'abc' },
      body: { some: 'data' },
    });
    const lastCall = spyCreateRequest.mock.calls[spyCreateRequest.mock.calls.length - 1][0];
    expect(lastCall.body).toBeUndefined();
  });

  it('should include body in POST request', () => {
    const spyCreateRequest = spyOn(apiClient, 'createRequest');
    repo.createUser({
      body: { name: 'John', email: 'john@example.com' },
    });
    const lastCall = spyCreateRequest.mock.calls[spyCreateRequest.mock.calls.length - 1][0];
    expect(lastCall.body).toEqual({ name: 'John', email: 'john@example.com' });
  });

  it('should build URL with params and query correctly', () => {
    const spyCreateRequest = spyOn(apiClient, 'createRequest');
    repo.getUser({
      urlParams: { id: '123' },
      query: { includeDetails: true }
    });
    const calledUrl = spyCreateRequest.mock.calls[spyCreateRequest.mock.calls.length - 1][0].url;
    expect(calledUrl).toContain('/users/123');
    expect(calledUrl).toContain('includeDetails=true');
  });

  it('should add and remove interceptors', () => {
    const interceptor = mock(cfg => cfg);
    const id = apiClient.interceptors.request.use(interceptor);
    expect(typeof id).toBe('number');
    apiClient.interceptors.request.eject(id);
    // Cannot test private field, but ejection is internal
  });

    it('should create repository with multiple methods', () => {
        const configs = [
            requestConfig,
            {
                name: 'createUser',
                method: 'post',
                path: '/users',
                bodyModel: Type.Object({ name: Type.String() }),
                responseModel: Type.Object({ id: Type.String() }),
            },
        ];

        const repository = createRepository(configs, mockApiClient);

        expect(repository).toHaveProperty('getUser');
        expect(repository).toHaveProperty('createUser');
    });

    it('should create repository with methods', () => {
        const repository = createRepository([requestConfig], mockApiClient);

        expect(repository).toHaveProperty('getUser');
        expect(typeof repository.getUser).toBe('function');
    });

    it('should call createRequest with correct config', () => {
        const repository = createRepository([requestConfig], mockApiClient);
        const rc = {
            urlParams: { id: '123' },
            query: { active: true },
            config: { ttl: 1000 },
        };

        repository.getUser(rc);

        expect(mockApiClient.createRequest).toHaveBeenCalledWith({
            method: 'GET',
            url: '/users/123?active=true',
            schemas: {
                query: requestConfig.queryModel,
                params: requestConfig.paramsModel,
                body: requestConfig.bodyModel,
                response: requestConfig.responseModel,
            },
            ttl: 1000,
        });
    });

    it('should handle config without params', () => {
        const config = {
            name: 'listUsers',
            method: 'get',
            path: '/users',
            queryModel: Type.Object({ limit: Type.Number() }),
            responseModel: Type.Object({ users: Type.Array(Type.String()) }),
        };

        const repository = createRepository([config], mockApiClient);
        repository.listUsers({ query: { limit: 10 }, config: {} });

        expect(mockApiClient.createRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
                url: '/users?limit=10',
                schemas: expect.any(Object),
            })
        );
    });

    it('should include body if method allows', () => {
        const postConfig = {
            ...requestConfig,
            method: 'post',
            name: 'createUser',
        };
        const repository = createRepository([postConfig], mockApiClient);
        const rc = {
            urlParams: { id: '123' },
            body: { name: 'John' },
        };

        repository.createUser(rc);

        expect(mockApiClient.createRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'POST',
                url: '/users/123',
                body: { name: 'John' },
            })
        );
    });

    it('should not include body for GET method', () => {
        mockApiClient.createRequest.mockClear();
        const repository = createRepository([requestConfig], mockApiClient);
        const rc = {
            urlParams: { id: '123' },
            body: { name: 'John' }, // Should be ignored
        };

        repository.getUser(rc);

        expect(mockApiClient.createRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'GET',
            })
        );
        expect(mockApiClient.createRequest).not.toHaveBeenCalledWith(
            expect.objectContaining({
                body: { name: 'John' },
            })
        );
    });

    it('should handle empty configs', () => {
        const repository = createRepository([], mockApiClient);

        expect(repository).toEqual({});
    });

    it('should validate request if enabled', () => {
        const configWithValidation = {
            ...requestConfig,
            paramsModel: Type.Object({ id: Type.Number() }), // id should be number
        };

        const repository = createRepository([configWithValidation], mockApiClient);
        const onValidationError = mock();

        const rc = {
            urlParams: { id: 'not a number' },
            config: {
                validate: {
                    request: true,
                    onValidationError,
                },
            },
        };

        repository.getUser(rc);

        // Validation error should be called
        expect(onValidationError).toHaveBeenCalled();
    });
});

describe('clearAllApiCache', () => {
    it('should call apiCache.clear', () => {
        const spy = spyOn(apiCache, 'clear').mockImplementation(() => {});
        clearAllApiCache();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
