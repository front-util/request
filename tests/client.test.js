import { describe, expect, it, spyOn, mock, beforeEach, afterEach } from 'bun:test';

import { createApiClient, createRepository } from '../src/client.js';
import { InterceptorManager } from '../src/interceptors.js';
import Type from 'typebox';

describe('createApiClient', () => {
    it('should create api client with createRequest method', () => {
        const client = createApiClient();

        expect(client).toHaveProperty('createRequest');
        expect(client).toHaveProperty('interceptors');
        expect(typeof client.createRequest).toBe('function');
        expect(client.interceptors).toHaveProperty('request');
        expect(typeof client.interceptors.request.use).toBe('function');
        expect(typeof client.interceptors.request.eject).toBe('function');
    });
});

describe('createRepository', () => {
    it('should create repository with methods for each endpoint', () => {
        const endpoints = [
            {
                name: 'getUser',
                method: 'get',
                path: '/users/:id',
                paramsModel: Type.Object({ id: Type.Number() }),
                responseModel: Type.Object({ id: Type.Number(), name: Type.String() })
            },
            {
                name: 'createUser',
                method: 'post',
                path: '/users',
                bodyModel: Type.Object({ name: Type.String() }),
                responseModel: Type.Object({ id: Type.Number() })
            }
        ];

        const client = createApiClient({ baseURL: 'https://api.example.com' });
        const repo = createRepository(endpoints, client);

        expect(repo).toHaveProperty('getUser');
        expect(repo).toHaveProperty('createUser');
        expect(typeof repo.getUser).toBe('function');
        expect(typeof repo.createUser).toBe('function');
    });

    it('should return reactive store from repository methods', () => {
        const endpoints = [
            {
                name: 'getUser',
                method: 'get',
                path: '/users/:id',
                paramsModel: Type.Object({ id: Type.Number() }),
                responseModel: Type.Object({ id: Type.Number(), name: Type.String() })
            }
        ];

        const client = createApiClient({ baseURL: 'https://api.example.com' });
        const repo = createRepository(endpoints, client);

        const userStore = repo.getUser({});

        expect(userStore).toHaveProperty('$state');
        expect(userStore).toHaveProperty('request');
        expect(typeof userStore.request).toBe('function');
    });
});
