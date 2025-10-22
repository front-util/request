const testInterceptor1 = (config) => ({ ...config, test: 1, });
const testInterceptor2 = (config) => ({ ...config, test: 2, });
const simpleInterceptor = (config) => config;
const modifyInterceptor = (config) => ({ ...config, modified: true, });
const step1Interceptor = (config) => ({ ...config, step: 1, });
const step2Interceptor = (config) => ({ ...config, step: 2, });
const asyncInterceptor = async (config) => ({ ...config, async: true, });

import { beforeEach, describe, expect, it } from 'bun:test';

import { InterceptorManager } from '../src/interceptors.js';

describe('InterceptorManager', () => {
    let manager;

    beforeEach(() => {
        manager = new InterceptorManager();
    });

    describe('use', () => {
        it('should add interceptor and return id', () => {
            const id1 = manager.use(testInterceptor1);
            const id2 = manager.use(testInterceptor2);

            expect(id1).toBe(0);
            expect(id2).toBe(1);
        });
    });

    describe('eject', () => {
        it('should set handler to null for valid id', () => {
            manager.use(simpleInterceptor);

            manager.eject(0);

            // After ejecting, applyInterceptors should ignore it
            manager.use(modifyInterceptor);

            const result = manager.applyInterceptors({ url: '/test', });

            return expect(result).resolves.toEqual({ url: '/test', modified: true, });
        });

        it('should ignore invalid id', () => {
            manager.use(simpleInterceptor);

            manager.eject(5); // Invalid id
            manager.eject(-1); // Invalid id

            // Should still apply
            const result = manager.applyInterceptors({ url: '/test', });

            return expect(result).resolves.toEqual({ url: '/test', });
        });
    });

    describe('applyInterceptors', () => {
        it('should apply multiple interceptors in order', async () => {
            manager.use(step1Interceptor);
            manager.use(step2Interceptor);

            const result = await manager.applyInterceptors({ url: '/test', });

            expect(result).toEqual({ url: '/test', step: 2, });
        });

        it('should ignore ejected interceptors', async () => {
            const id1 = manager.use(step1Interceptor);

            manager.use(step2Interceptor);
            manager.eject(id1);

            const result = await manager.applyInterceptors({ url: '/test', });

            expect(result).toEqual({ url: '/test', step: 2, });
        });

        it('should handle empty interceptors', async () => {
            const result = await manager.applyInterceptors({ url: '/test', });

            expect(result).toEqual({ url: '/test', });
        });

        it('should resolve with async interceptors', async () => {
            manager.use(asyncInterceptor);

            const result = await manager.applyInterceptors({ url: '/test', });

            expect(result).toEqual({ url: '/test', async: true, });
        });
    });
});
