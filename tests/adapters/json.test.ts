import {describe, it, expect} from 'bun:test';

import {jsonAdapter} from '#src/adapters/json';

describe('[adapters/json]', () => {
    // Successfully parse valid JSON response and return typed data
    it('should parse valid JSON response and return typed data', async () => {
        const mockData = { id: 1, name: 'test', };
        const mockResponse = new Response(JSON.stringify(mockData));
  
        const result = await jsonAdapter<typeof mockData>(mockResponse);
  
        expect(result).toEqual(mockData);
    });

    // Return undefined when response body is empty but valid
    it('should return undefined for empty but valid response body', async () => {
        const mockResponse = new Response('');
  
        const result = await jsonAdapter<unknown>(mockResponse);
  
        expect(result).toBeUndefined();
    });

    // Handle malformed JSON in response body
    it('should return undefined for malformed JSON response', async () => {
        const mockResponse = new Response('{"key": "value"');
  
        const result = await jsonAdapter<unknown>(mockResponse);
  
        expect(result).toBeUndefined();
    });

    // Handle response with invalid JSON syntax
    it('should return undefined when JSON syntax is invalid', async () => {
        const mockResponse = new Response('not a json');
  
        const result = await jsonAdapter<unknown>(mockResponse);
  
        expect(result).toBeUndefined();
    });

    // Process response with unexpected data types
    it('should handle response with unexpected data types', async () => {
        const mockResponse = new Response('[1, "string", null, true]');
  
        const result = await jsonAdapter<unknown[]>(mockResponse);
  
        expect(result).toEqual([1, "string", null, true]);
    });
});
