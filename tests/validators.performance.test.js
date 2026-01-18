import { describe, it, expect, beforeEach } from 'bun:test';
import { Type } from 'typebox';
import { validatorsStore } from '../src/store.js';

describe('ValidatorsStore Performance', () => {
  beforeEach(() => {
    validatorsStore.clear();
  });

  it('should cache validators efficiently', () => {
    const schema = Type.Object({
      id: Type.Number(),
      name: Type.String()
    });

    const startTime = performance.now();
    
    // Get the same schema multiple times
    for (let i = 0; i < 1000; i++) {
      validatorsStore.get(schema);
    }
    
    const endTime = performance.now();
    
    console.log(`Validator caching took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 50ms)
    expect(endTime - startTime).toBeLessThan(50);
  });

  it('should handle many different schemas', () => {
    const startTime = performance.now();
    
    // Create and use many different schemas
    for (let i = 0; i < 1000; i++) {
      const schema = Type.Object({
        id: Type.Number(),
        name: Type.String({ minLength: i % 10 }),
        active: Type.Boolean()
      });
      
      const validator = validatorsStore.get(schema);
      const data = { id: i, name: `name-${i}`, active: i % 2 === 0 };
      const errors = validator.Errors(data);
      [...errors]; // Consume errors
    }
    
    const endTime = performance.now();
    
    console.log(`Many schemas validation took ${endTime - startTime}ms`);
    
    // Should be reasonable (e.g., less than 500ms)
    expect(endTime - startTime).toBeLessThan(500);
  });

  it('should handle validation with large data sets', () => {
    const schema = Type.Object({
      id: Type.Number(),
      items: Type.Array(Type.Object({
        id: Type.Number(),
        name: Type.String(),
        details: Type.Object({
          description: Type.String(),
          tags: Type.Array(Type.String())
        })
      }))
    });

    // Create large data set
    const largeData = {
      id: 1,
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        details: {
          description: `Description for item ${i}`.repeat(10),
          tags: Array.from({ length: 50 }, (_, j) => `tag-${j}`)
        }
      }))
    };

    const startTime = performance.now();
    
    const validator = validatorsStore.get(schema);
    const errors = validator.Errors(largeData);
    const errorCount = [...errors].length;
    
    const endTime = performance.now();
    
    console.log(`Large data validation took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 200ms)
    expect(endTime - startTime).toBeLessThan(200);
    expect(errorCount).toBe(0); // Should be valid
  });

  it('should handle memory usage with many validators', () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Create many schemas and validators
    for (let i = 0; i < 5000; i++) {
      const schema = Type.Object({
        id: Type.Number(),
        data: Type.Array(Type.String({ minLength: 1, maxLength: 100 }), { maxItems: 100 })
      });
      
      const validator = validatorsStore.get(schema);
      const data = { 
        id: i, 
        data: Array.from({ length: 50 }, (_, j) => `item-${i}-${j}`) 
      };
      const errors = validator.Errors(data);
      [...errors]; // Consume errors
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    console.log(`Validators memory growth: ${memoryGrowth.toFixed(2)} MB`);
    
    // Should not grow too much (e.g., less than 50MB)
    expect(memoryGrowth).toBeLessThan(50);
  });

  it('should handle validation errors efficiently', () => {
    const schema = Type.Object({
      id: Type.Number(),
      name: Type.String({ minLength: 5 }),
      email: Type.String({ format: 'email' }),
      age: Type.Number({ minimum: 0, maximum: 150 })
    });

    const invalidData = {
      id: 'not-a-number',
      name: 'sh',
      email: 'invalid-email',
      age: -5
    };

    const startTime = performance.now();
    
    const validator = validatorsStore.get(schema);
    const errors = [...validator.Errors(invalidData)];
    
    const endTime = performance.now();
    
    console.log(`Error validation took ${endTime - startTime}ms`);
    
    // Should be fast (e.g., less than 10ms)
    expect(endTime - startTime).toBeLessThan(10);
    // Should have multiple validation errors
    expect(errors.length).toBeGreaterThan(3);
  });
});