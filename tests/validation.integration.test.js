import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { createRequestStore } from '../src/request.js';
import { InterceptorManager } from '../src/interceptors.js';
import { Type } from 'typebox';

describe('Validation Integration', () => {
  let globalFetchSpy;
  let serviceContext;

  beforeEach(() => {
    globalFetchSpy = spyOn(global, 'fetch');
    
    serviceContext = {
      baseURL: 'https://api.example.com',
      requestInterceptorsManager: new InterceptorManager(),
      validationType: 'bodySoft',
      defaultHeaders: {},
    };
  });

  it('should validate response data after parsing, not before', async () => {
    // Mock successful response with valid data
    const headersObj = new Headers();
    spyOn(headersObj, 'get').mockReturnValue('application/json');
    
    const validResponseData = { 
      id: 123, 
      name: 'John Doe', 
      email: 'john@example.com' 
    };
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: headersObj,
      clone: () => mockResponse,
      json: () => Promise.resolve(validResponseData)
    };
    
    globalFetchSpy.mockResolvedValue(mockResponse);
    
    // Create schema for validation
    const responseModel = Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String({ format: 'email' })
    });
    
    const store = createRequestStore(
      { url: '/users/123', method: 'GET' },
      serviceContext,
      { 
        validationType: 'bodySoft',
        bodyModel: responseModel
      }
    );
    
    await store.request({});
    
    // Verify that validation happened with actual parsed data, not null
    expect(store.$state.value.type).toBe('success');
    expect(store.$state.value.data).toEqual(validResponseData);
    // No validation error because data is valid
    expect(store.$state.value.error).toBeUndefined();
  });

  it('should properly handle validation errors with actual data', async () => {
    // Mock successful response with invalid data (missing required field)
    const headersObj = new Headers();
    spyOn(headersObj, 'get').mockReturnValue('application/json');
    
    // Invalid data - missing required 'name' field
    const invalidResponseData = { 
      id: 123 
      // Missing 'name' and 'email' fields
    };
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: headersObj,
      clone: () => mockResponse,
      json: () => Promise.resolve(invalidResponseData)
    };
    
    globalFetchSpy.mockResolvedValue(mockResponse);
    
    // Create schema for validation
    const responseModel = Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String({ format: 'email' })
    });
    
    const store = createRequestStore(
      { url: '/users/123', method: 'GET' },
      serviceContext,
      { 
        validationType: 'bodySoft',
        bodyModel: responseModel
      }
    );
    
    await store.request({});
    
    // Verify that validation happened with actual parsed data
    expect(store.$state.value.type).toBe('success'); // Still success because data was received
    expect(store.$state.value.data).toEqual(invalidResponseData);
    // But there should be a validation error
    expect(store.$state.value.error).toBeDefined();
    expect(store.$state.value.error.name).toBe('ValidationError');
  });

  it('should handle validation with complex nested data', async () => {
    // Mock successful response with complex nested data
    const headersObj = new Headers();
    spyOn(headersObj, 'get').mockReturnValue('application/json');
    
    const complexResponseData = {
      id: 123,
      profile: {
        name: 'John Doe',
        contacts: {
          email: 'john@example.com',
          phones: [
            { type: 'home', number: '123-456-7890' },
            { type: 'work', number: '098-765-4321' }
          ]
        }
      },
      preferences: {
        theme: 'dark',
        notifications: true
      }
    };
    
    const mockResponse = {
      ok: true,
      status: 200,
      headers: headersObj,
      clone: () => mockResponse,
      json: () => Promise.resolve(complexResponseData)
    };
    
    globalFetchSpy.mockResolvedValue(mockResponse);
    
    // Create complex schema for validation
    const phoneSchema = Type.Object({
      type: Type.Union([Type.Literal('home'), Type.Literal('work'), Type.Literal('mobile')]),
      number: Type.String({ pattern: '^\\d{3}-\\d{3}-\\d{4}$' })
    });
    
    const responseModel = Type.Object({
      id: Type.Number(),
      profile: Type.Object({
        name: Type.String({ minLength: 1 }),
        contacts: Type.Object({
          email: Type.String({ format: 'email' }),
          phones: Type.Array(phoneSchema)
        })
      }),
      preferences: Type.Object({
        theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
        notifications: Type.Boolean()
      })
    });
    
    const store = createRequestStore(
      { url: '/users/123', method: 'GET' },
      serviceContext,
      { 
        validationType: 'bodySoft',
        bodyModel: responseModel
      }
    );
    
    await store.request({});
    
    // Verify that validation happened with actual parsed data
    expect(store.$state.value.type).toBe('success');
    expect(store.$state.value.data).toEqual(complexResponseData);
    // No validation error because data is valid
    expect(store.$state.value.error).toBeUndefined();
  });
});