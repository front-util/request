import { describe, it, expect, beforeEach } from 'bun:test';
import { Type } from 'typebox';
import { validatorsStore } from '../src/store.js';

describe('Validation Performance', () => {
  beforeEach(() => {
    // Clear validators store before each test to ensure clean state
    validatorsStore.clear();
  });

  // Large schema test
  it('should validate large schemas efficiently', async () => {
    // Create a large, complex schema
    const largeSchema = Type.Object({
      id: Type.Number(),
      name: Type.String({ minLength: 1, maxLength: 100 }),
      email: Type.String({ format: 'email' }),
      // Add many nested properties
      profile: Type.Object({
        bio: Type.String({ maxLength: 1000 }),
        avatar: Type.String({ format: 'uri' }),
        preferences: Type.Object({
          theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
          notifications: Type.Boolean(),
          language: Type.String({ minLength: 2, maxLength: 5 })
        }),
        // Add array with many items
        tags: Type.Array(Type.String({ minLength: 1 }), { maxItems: 100 })
      }),
      // Add array of complex objects
      posts: Type.Array(Type.Object({
        id: Type.Number(),
        title: Type.String({ minLength: 1, maxLength: 200 }),
        content: Type.String({ minLength: 1, maxLength: 5000 }),
        createdAt: Type.String({ format: 'date-time' }),
        tags: Type.Array(Type.String(), { maxItems: 20 })
      }), { maxItems: 1000 })
    });

    // Create large data set
    const largeData = {
      id: 12345,
      name: 'John Doe',
      email: 'john.doe@example.com',
      profile: {
        bio: 'A very long bio...'.repeat(50),
        avatar: 'https://example.com/avatar.jpg',
        preferences: {
          theme: 'dark',
          notifications: true,
          language: 'en'
        },
        tags: Array.from({ length: 100 }, (_, i) => `tag-${i}`)
      },
      posts: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        title: `Post ${i}`,
        content: 'Content '.repeat(100),
        createdAt: new Date().toISOString(),
        tags: Array.from({ length: 10 }, (_, j) => `tag-${j}`)
      }))
    };

    const startTime = performance.now();
    const validator = validatorsStore.get(largeSchema);
    const errors = validator.Errors(largeData);
    const endTime = performance.now();

    console.log(`Validation took ${endTime - startTime}ms`);
    
    // Should validate within reasonable time (e.g., 100ms)
    expect(endTime - startTime).toBeLessThan(100);
    expect([...errors]).toHaveLength(0);
  });

  // Stress test with many validations
  it('should handle multiple validations efficiently', async () => {
    const schema = Type.Object({
      id: Type.Number(),
      name: Type.String(),
      email: Type.String()
    });

    const data = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com'
    };

    const startTime = performance.now();
    
    // Perform many validations
    for (let i = 0; i < 1000; i++) {
      const validator = validatorsStore.get(schema);
      const errors = validator.Errors(data);
      // Consume the errors to ensure validation actually happens
      [...errors];
    }
    
    const endTime = performance.now();
    console.log(`1000 validations took ${endTime - startTime}ms`);
    
    // Should complete within reasonable time (e.g., 500ms)
    expect(endTime - startTime).toBeLessThan(500);
  });

  // Test validation with invalid data
  it('should handle validation errors efficiently', async () => {
    const schema = Type.Object({
      id: Type.Number(),
      name: Type.String({ minLength: 1 }),
      email: Type.String({ format: 'email' })
    });

    const invalidData = {
      id: 'not-a-number',
      name: '',
      email: 'invalid-email'
    };

    const startTime = performance.now();
    const validator = validatorsStore.get(schema);
    const errors = [...validator.Errors(invalidData)];
    const endTime = performance.now();

    console.log(`Error validation took ${endTime - startTime}ms`);
    
    // Should validate within reasonable time (e.g., 10ms)
    expect(endTime - startTime).toBeLessThan(10);
    // Should have validation errors
    expect(errors.length).toBeGreaterThan(0);
  });

  // Test memory usage with many schemas
  it('should not cause memory leaks with many schemas', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create many different schemas and validate data
    for (let i = 0; i < 1000; i++) {
      const schema = Type.Object({
        id: Type.Number(),
        data: Type.Array(Type.String(), { maxItems: 100 })
      });
      
      const validator = validatorsStore.get(schema);
      const data = { id: i, data: Array(50).fill(`item-${i}`) };
      const errors = validator.Errors(data);
      // Consume errors to ensure validation happens
      [...errors];
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    console.log(`Memory growth: ${memoryGrowth.toFixed(2)} MB`);
    
    // Should not grow too much (e.g., less than 30MB)
    expect(memoryGrowth).toBeLessThan(30);
  });
});