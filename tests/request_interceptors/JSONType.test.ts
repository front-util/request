import {describe, it, expect} from 'bun:test';

import {JSONTypeInterceptor} from '#src/request_interceptors/JSONType';

describe('[request_interceptors/JSONType]', () => {
    // Adds Content-Type header for POST request when not provided
    it('should add Content-Type header when POST request has no headers', () => {
        const config = {
            method: 'POST',
            url   : '/test',
        };
  
        const result = JSONTypeInterceptor(config);
  
        expect(result.headers?.['Content-Type']).toBe('application/json;charset=utf-8');
    });

    // Adds Content-Type header for PUT request when not provided
    it('should add Content-Type header when PUT request has no headers', () => {
        const config = {
            method: 'PUT',
            url   : '/test',
        };
  
        const result = JSONTypeInterceptor(config);
  
        expect(result.headers?.['Content-Type']).toBe('application/json;charset=utf-8');
    });

    // Handle undefined headers in request config
    it('should handle undefined headers in request config', () => {
        const config = {
            method : 'POST',
            url    : '/test',
            headers: undefined,
        };
  
        const result = JSONTypeInterceptor(config);
  
        expect(result.headers?.['Content-Type']).toBe('application/json;charset=utf-8');
    });

    // Handle empty method string in request config
    it('should not add Content-Type header when method is empty string', () => {
        const config = {
            method: '',
            url   : '/test',
        };
  
        const result = JSONTypeInterceptor(config);
  
        expect(result.headers?.['Content-Type']).toBeUndefined();
    });

    // Handle method in different letter cases
    it('should add Content-Type header for lowercase post method', () => {
        const config = {
            method: 'post',
            url   : '/test',
        };
  
        const result = JSONTypeInterceptor(config);
  
        expect(result.headers?.['Content-Type']).toBe('application/json;charset=utf-8');
    });
});
