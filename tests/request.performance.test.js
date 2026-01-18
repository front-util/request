import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { createRequestStore } from '../src/request.js';
import { InterceptorManager } from '../src/interceptors.js';

describe('Request Performance', () => {
  let globalFetchSpy;
  let serviceContext;

  beforeEach(() => {
    globalFetchSpy = spyOn(global, 'fetch');
    
    serviceContext = {
      baseURL: 'https://api.example.com',
      requestInterceptorsManager: new InterceptorManager(),
      validationType: 'disabled',
      defaultHeaders: {},
    };
  });

  it('should handle rapid requests efficiently', async () => {
    // Mock successful response
    const headersObj = new Headers();
    spyOn(headersObj, 'get').mockReturnValue('application/json');
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: headersObj,
      clone: () => mockResponse,
      json: () => Promise.resolve({ id: 1, name: 'test' })
    };
    
    globalFetchSpy.mockResolvedValue(mockResponse);
    
    const store = createRequestStore(
      { url: '/test', method: 'GET' },
      serviceContext,
      { validationType: 'disabled' }
    );
    
    const startTime = performance.now();
    
    // Perform many rapid requests
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(store.request({}));
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    
    console.log(`Rapid requests took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 200ms)
    expect(endTime - startTime).toBeLessThan(200);
  });

  it('should handle requests with large response data', async () => {
    // Mock large response
    const headersObj = new Headers();
    spyOn(headersObj, 'get').mockReturnValue('application/json');
    
    // Create large response data
    const largeData = {
      id: 1,
      name: 'Test User',
      posts: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        title: `Post ${i}`,
        content: `Content for post ${i}`.repeat(20),
        tags: Array.from({ length: 10 }, (_, j) => `tag-${j}`)
      })),
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }
    };
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: headersObj,
      clone: () => mockResponse,
      json: () => Promise.resolve(largeData)
    };
    
    globalFetchSpy.mockResolvedValue(mockResponse);
    
    const store = createRequestStore(
      { url: '/large-data', method: 'GET' },
      serviceContext,
      { validationType: 'disabled' }
    );
    
    const startTime = performance.now();
    
    await store.request({});
    
    const endTime = performance.now();
    
    console.log(`Large data request took ${endTime - startTime}ms`);
    
    // Should be reasonable (e.g., less than 100ms)
    expect(endTime - startTime).toBeLessThan(100);
    
    // Verify data is correctly set
    expect(store.$state.value.type).toBe('success');
    expect(store.$state.value.data.id).toBe(1);
    expect(store.$state.value.data.posts.length).toBe(1000);
  });

  it('should handle concurrent requests efficiently', async () => {
    // Mock response
    const headersObj = new Headers();
    spyOn(headersObj, 'get').mockReturnValue('application/json');
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: headersObj,
      clone: () => mockResponse,
      json: () => Promise.resolve({ id: 1, name: 'test' })
    };
    
    globalFetchSpy.mockResolvedValue(mockResponse);
    
    const startTime = performance.now();
    
    // Create multiple stores and make concurrent requests
    const stores = [];
    const promises = [];
    
    for (let i = 0; i < 50; i++) {
      const store = createRequestStore(
        { url: `/test-${i}`, method: 'GET' },
        serviceContext,
        { validationType: 'disabled' }
      );
      stores.push(store);
      promises.push(store.request({}));
    }
    
    await Promise.all(promises);
    
    const endTime = performance.now();
    
    console.log(`Concurrent requests took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 300ms)
    expect(endTime - startTime).toBeLessThan(300);
    
    // Verify all requests succeeded
    for (const store of stores) {
      expect(store.$state.value.type).toBe('success');
    }
  });

  it('should handle request cancellation efficiently', async () => {
    // Mock delayed response
    const headersObj = new Headers();
    spyOn(headersObj, 'get').mockReturnValue('application/json');
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: headersObj,
      clone: () => mockResponse,
      json: () => new Promise(resolve => setTimeout(() => resolve({ id: 1 }), 100))
    };
    
    globalFetchSpy.mockResolvedValue(mockResponse);
    
    const store = createRequestStore(
      { url: '/slow', method: 'GET' },
      serviceContext,
      { validationType: 'disabled' }
    );
    
    const startTime = performance.now();
    
    // Start request and immediately cancel
    const requestPromise = store.request({});
    store.cancel();
    
    try {
      await requestPromise;
    } catch (error) {
      // Expected to be cancelled
    }
    
    const endTime = performance.now();
    
    console.log(`Cancellation took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 50ms)
    expect(endTime - startTime).toBeLessThan(50);
    
    // Verify state is correct
    expect(store.$state.value.type).toBe('error');
    expect(store.$state.value.error.name).toBe('CancellationError');
  });
});