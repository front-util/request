import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { Type } from 'typebox';

import { cacheStore, CacheStore, validatorsStore } from '../src/store.js';

describe('CacheStore', () => {
    let store;

    beforeEach(() => {
        store = new CacheStore();
    });

    describe('get', () => {
        it('should return null for non-GET method', () => {
            const config = { method: 'POST', url: '/test', };

            store.set(config, {test: 'test',}, 200, 10_000);
            const result = store.get(config);

            expect(result).toBeNull();
        });

        it('should return null if no cached entry', () => {
            const config = { url: '/test', };
            const result = store.get(config);

            expect(result).toBeNull();
        });

        it('should return cached entry if valid', () => {
            const mockNow = spyOn(Date, 'now').mockReturnValue(100_000);
            const config = { url: '/test', };

            store.set(config, { data: 'test', }, 200, 10_000); // TTL 10 seconds from now (100000 + 10000)

            mockNow.mockReturnValue(105_000); // Within TTL

            const result = store.get(config);

            expect(result).toEqual({
                data        : { data: 'test', },
                status      : 200,
                ttlTimestamp: 110_000,
            });
            mockNow.mockRestore();
        });

        it('should return null and delete if expired', () => {
            const mockNow = spyOn(Date, 'now');

            mockNow.mockReturnValue(100_000);
            const config = { url: '/test', };

            store.set(config, { data: 'test', }, 200, 5000); // Expiry at 105000

            mockNow.mockReturnValue(106_000); // Past expiry

            const result = store.get(config);

            expect(result).toBeNull();
            // Should be deleted
            expect(store.cache.size).toBe(0);

            mockNow.mockRestore();
        });
    });

    describe('set', () => {
        it('should not cache for non-GET method', () => {
            const config = { method: 'POST', url: '/test', };

            store.set(config, 'data', 200, 1000);
            expect(store.cache.size).toBe(0);
        });

        it('should not cache if TTL <= 0', () => {
            const config = { url: '/test', };

            store.set(config, 'data', 200, 0);
            expect(store.cache.size).toBe(0);
        });

        it('should cache GET method with positive TTL', () => {
            const mockNow = spyOn(Date, 'now').mockReturnValue(100_000);
            const config = { url: '/test', };

            store.set(config, 'data', 200, 1000);
            expect(store.cache.size).toBe(1);
            expect(store.cache.get('GET:/test')).toEqual({
                data        : 'data',
                status      : 200,
                ttlTimestamp: 101_000,
            });
            mockNow.mockRestore();
        });

        it('should use custom cacheKey', () => {
            const config = { url: '/test', cacheKey: 'custom:key', };

            store.set(config, 'data', 200, 1000);
            expect(store.cache.get('custom:key')).toBeDefined();
        });
    });

    describe('invalidate', () => {
        it('should delete entry by config', () => {
            const config = { url: '/test', };

            store.set(config, 'data', 200, 1000);
            store.invalidate(config);
            expect(store.cache.size).toBe(0);
        });

        it('should delete entry by key', () => {
            const config = { url: '/test', };

            store.set(config, 'data', 200, 1000);
            store.invalidate('GET:/test');
            expect(store.cache.size).toBe(0);
        });
    });
    
    describe('invalidateByPattern', () => {
        it('should delete entries matching pattern', () => {
            store.set({ url: '/test1', }, 'data1', 200, 1000);
            store.set({ url: '/test2', }, 'data2', 200, 1000);
            store.set({ url: '/other', }, 'data3', 200, 1000);
            expect(store.cache.size).toBe(3);

            store.invalidateByPattern(/^GET:\/test/);
            expect(store.cache.size).toBe(1);
            expect(store.cache.has('GET:/other')).toBe(true);
        });
    });

    describe('clear', () => {
        it('should clear all cache entries', () => {
            store.set({ url: '/test1', }, 'data1', 200, 1000);
            store.set({ url: '/test2', }, 'data2', 200, 1000);

            store.clear();
            expect(store.cache.size).toBe(0);
        });
    });
});

describe('cacheStore', () => {
    it('should be instance of CacheStore', () => {
        expect(cacheStore).toBeInstanceOf(CacheStore);
    });
});

describe('CacheStore Performance', () => {
    let store;

    beforeEach(() => {
        store = new CacheStore();
    });

    it('should handle rapid set/get operations', () => {
        const startTime = performance.now();
        
        // Perform many rapid operations
        for (let i = 0; i < 1000; i++) {
            const config = { url: `/test${i}`, };
            store.set(config, { data: i }, 200, 10000);
            const result = store.get(config);
            expect(result.data.data).toBe(i);
        }
        
        const endTime = performance.now();
        console.log(`Rapid cache operations took ${endTime - startTime}ms`);
        
        // Should complete quickly (e.g., less than 100ms)
        expect(endTime - startTime).toBeLessThan(100);
    });

    it('should maintain performance with large cache', () => {
        // Pre-populate with many items
        for (let i = 0; i < 5000; i++) {
            store.set({ url: `/item${i}` }, { id: i }, 200, 60000);
        }
        
        const startTime = performance.now();
        
        // Test operations on large cache
        for (let i = 4500; i < 5000; i++) {
            const result = store.get({ url: `/item${i}` });
            expect(result).not.toBeNull();
            expect(result.data.id).toBe(i);
        }
        
        const endTime = performance.now();
        console.log(`Large cache operations took ${endTime - startTime}ms`);
        
        // Should still be fast (e.g., less than 50ms)
        expect(endTime - startTime).toBeLessThan(50);
    });
});

describe('ValidatorsStore Performance', () => {
    it('should handle validation performance', () => {
        const schema = Type.Object({
            id: Type.Number(),
            name: Type.String()
        });

        const data = { id: 1, name: 'test' };

        const startTime = performance.now();
        
        // Perform many validations
        for (let i = 0; i < 100; i++) {
            const validator = validatorsStore.get(schema);
            const errors = validator.Errors(data);
            [...errors]; // Consume errors
        }
        
        const endTime = performance.now();
        console.log(`Validation operations took ${endTime - startTime}ms`);
        
        // Should be fast (e.g., less than 50ms)
        expect(endTime - startTime).toBeLessThan(50);
    });
});
