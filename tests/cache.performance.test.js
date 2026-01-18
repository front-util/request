import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { CacheStore } from '../src/store.js';

describe('Cache Performance', () => {
  let store;

  beforeEach(() => {
    store = new CacheStore();
  });

  it('should handle large cache efficiently', async () => {
    const startTime = performance.now();
    
    // Add many items to cache
    for (let i = 0; i < 10000; i++) {
      const config = { url: `/api/data/${i}`, method: 'GET' };
      store.set(config, { id: i, data: `data-${i}` }, 200, 60000);
    }
    
    // Retrieve many items
    let hitCount = 0;
    for (let i = 0; i < 10000; i++) {
      const config = { url: `/api/data/${i}`, method: 'GET' };
      const entry = store.get(config);
      if (entry) hitCount++;
    }
    
    const endTime = performance.now();
    
    console.log(`Cache operations took ${endTime - startTime}ms`);
    expect(hitCount).toBe(10000);
    expect(endTime - startTime).toBeLessThan(1000); // Should be fast
  });

  it('should handle cache invalidation efficiently', async () => {
    // Populate cache with many items
    for (let i = 0; i < 5000; i++) {
      const config = { url: `/api/data/${i}`, method: 'GET' };
      store.set(config, { id: i, data: `data-${i}` }, 200, 60000);
    }
    
    // Add items that match the pattern we'll invalidate
    for (let i = 0; i < 2000; i++) {
      const config = { url: `/api/test${i}`, method: 'GET' };
      store.set(config, { id: i, data: `test-${i}` }, 200, 60000);
    }
    
    const startTime = performance.now();
    
    // Invalidate items matching a pattern
    store.invalidateByPattern(/^GET:\/api\/test/); // Invalidate test items
    
    const endTime = performance.now();
    
    console.log(`Cache invalidation took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 50ms)
    expect(endTime - startTime).toBeLessThan(50);
    
    // Check that correct items were invalidated
    const remainingEntry = store.get({ url: '/api/data/4000', method: 'GET' });
    const invalidatedEntry = store.get({ url: '/api/test1000', method: 'GET' });
    
    expect(remainingEntry).not.toBeNull();
    expect(invalidatedEntry).toBeNull();
  });

  it('should handle cache expiration efficiently', async () => {
    const mockNow = spyOn(Date, 'now');
    
    // Set initial time
    mockNow.mockReturnValue(1000000);
    
    // Add items with different expiration times
    for (let i = 0; i < 1000; i++) {
      const config = { url: `/api/data/${i}`, method: 'GET' };
      // Half expire soon, half expire later
      const ttl = i < 500 ? 1000 : 10000;
      store.set(config, { id: i, data: `data-${i}` }, 200, ttl);
    }
    
    // Move time forward to expire first half
    mockNow.mockReturnValue(1005000);
    
    const startTime = performance.now();
    
    // Try to get all items (should trigger cleanup of expired items)
    let validCount = 0;
    let expiredCount = 0;
    
    for (let i = 0; i < 1000; i++) {
      const config = { url: `/api/data/${i}`, method: 'GET' };
      const entry = store.get(config);
      if (entry) {
        validCount++;
      } else {
        expiredCount++;
      }
    }
    
    const endTime = performance.now();
    
    console.log(`Cache expiration check took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 50ms)
    expect(endTime - startTime).toBeLessThan(50);
    
    // Should have correct counts
    expect(validCount).toBe(500); // Second half still valid
    expect(expiredCount).toBe(500); // First half expired
    
    mockNow.mockRestore();
  });

  it('should handle concurrent cache operations', async () => {
    const startTime = performance.now();
    
    // Concurrently add and retrieve items
    const promises = [];
    
    for (let i = 0; i < 1000; i++) {
      const config = { url: `/api/data/${i}`, method: 'GET' };
      
      // Add set operation
      promises.push(Promise.resolve().then(() => {
        store.set(config, { id: i, data: `data-${i}` }, 200, 60000);
      }));
      
      // Add get operation (will be null initially)
      promises.push(Promise.resolve().then(() => {
        return store.get(config);
      }));
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    
    console.log(`Concurrent cache operations took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 200ms)
    expect(endTime - startTime).toBeLessThan(200);
    
    // Verify all items were added
    const entry = store.get({ url: '/api/data/999', method: 'GET' });
    expect(entry).not.toBeNull();
  });
});