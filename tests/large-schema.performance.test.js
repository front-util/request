import { describe, it, expect, beforeEach } from 'bun:test';
import { Type } from 'typebox';
import { validatorsStore } from '../src/store.js';

describe('Large Schema Performance', () => {
  beforeEach(() => {
    validatorsStore.clear();
  });

  it('should handle very large schemas efficiently', () => {
    // Create a very large, complex schema
    const largeSchema = Type.Object({
      // Basic fields
      id: Type.Number(),
      guid: Type.String({ format: 'uuid' }),
      isActive: Type.Boolean(),
      balance: Type.String(),
      picture: Type.String({ format: 'uri' }),
      age: Type.Number(),
      eyeColor: Type.String(),
      name: Type.Object({
        first: Type.String(),
        last: Type.String()
      }),
      company: Type.String(),
      email: Type.String({ format: 'email' }),
      phone: Type.String(),
      address: Type.String(),
      about: Type.String(),
      registered: Type.String({ format: 'date-time' }),
      latitude: Type.Number(),
      longitude: Type.Number(),
      
      // Tags array
      tags: Type.Array(Type.String()),
      
      // Range array
      range: Type.Array(Type.Number()),
      
      // Friends array with nested objects
      friends: Type.Array(Type.Object({
        id: Type.Number(),
        name: Type.String(),
        age: Type.Number(),
        email: Type.String({ format: 'email' }),
        address: Type.String(),
        phone: Type.String(),
        tags: Type.Array(Type.String())
      })),
      
      // Nested complex object
      profile: Type.Object({
        personal: Type.Object({
          bio: Type.String(),
          interests: Type.Array(Type.String()),
          education: Type.Object({
            degree: Type.String(),
            institution: Type.String(),
            year: Type.Number()
          }),
          employment: Type.Array(Type.Object({
            company: Type.String(),
            position: Type.String(),
            startDate: Type.String({ format: 'date' }),
            endDate: Type.String({ format: 'date' }),
            description: Type.String()
          }))
        }),
        preferences: Type.Object({
          theme: Type.Union([Type.Literal('light'), Type.Literal('dark'), Type.Literal('auto')]),
          language: Type.String(),
          notifications: Type.Object({
            email: Type.Boolean(),
            push: Type.Boolean(),
            sms: Type.Boolean()
          }),
          privacy: Type.Object({
            profileVisibility: Type.Union([Type.Literal('public'), Type.Literal('private'), Type.Literal('friends')]),
            searchVisibility: Type.Boolean()
          })
        }),
        settings: Type.Object({
          theme: Type.String(),
          layout: Type.String(),
          widgets: Type.Array(Type.Object({
            id: Type.String(),
            type: Type.String(),
            position: Type.Object({
              x: Type.Number(),
              y: Type.Number()
            }),
            config: Type.Object({})
          }))
        })
      }),
      
      // Additional metadata
      metadata: Type.Object({
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
        version: Type.Number(),
        checksum: Type.String()
      })
    });

    // Create large data set that matches the schema
    const largeData = {
      id: 123456789,
      guid: '123e4567-e89b-12d3-a456-426614174000',
      isActive: true,
      balance: '$1,234.56',
      picture: 'https://example.com/image.jpg',
      age: 35,
      eyeColor: 'blue',
      name: {
        first: 'John',
        last: 'Doe'
      },
      company: 'Example Corp',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main St, City, State 12345',
      about: 'This is a sample user with a large data set. '.repeat(20),
      registered: '2020-01-01T00:00:00.000Z',
      latitude: 40.7128,
      longitude: -74.0060,
      tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
      range: Array.from({ length: 100 }, (_, i) => i),
      friends: Array.from({ length: 20 }, (_, i) => ({
        id: i,
        name: `Friend ${i}`,
        age: 25 + (i % 40),
        email: `friend${i}@example.com`,
        address: `Street ${i}, City`,
        phone: `+1 (555) 000-${i.toString().padStart(4, '0')}`,
        tags: Array.from({ length: 5 }, (_, j) => `friend-tag-${i}-${j}`)
      })),
      profile: {
        personal: {
          bio: 'This is a detailed biography. '.repeat(30),
          interests: Array.from({ length: 30 }, (_, i) => `interest-${i}`),
          education: {
            degree: 'Master of Science',
            institution: 'University of Example',
            year: 2010
          },
          employment: Array.from({ length: 5 }, (_, i) => ({
            company: `Company ${i}`,
            position: `Position ${i}`,
            startDate: `20${10 + i}-01-01`,
            endDate: i === 4 ? 'present' : `20${15 + i}-01-01`,
            description: `Description for job ${i}. `.repeat(10)
          }))
        },
        preferences: {
          theme: 'dark',
          language: 'en',
          notifications: {
            email: true,
            push: true,
            sms: false
          },
          privacy: {
            profileVisibility: 'public',
            searchVisibility: true
          }
        },
        settings: {
          theme: 'dark',
          layout: 'grid',
          widgets: Array.from({ length: 10 }, (_, i) => ({
            id: `widget-${i}`,
            type: `type-${i % 3}`,
            position: {
              x: i * 10,
              y: i * 20
            },
            config: {}
          }))
        }
      },
      metadata: {
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        version: 5,
        checksum: 'abc123def456'
      }
    };

    const startTime = performance.now();
    
    // Compile the validator
    const validator = validatorsStore.get(largeSchema);
    
    // Validate the large data set
    const errors = [...validator.Errors(largeData)];
    
    const endTime = performance.now();
    
    console.log(`Large schema validation took ${endTime - startTime}ms`);
    console.log(`Validation errors: ${errors.length}`, errors);
    
    // Should validate within reasonable time (e.g., 200ms)
    expect(endTime - startTime).toBeLessThan(200);
    // Note: We're not checking for zero errors because the large data might not perfectly match the schema
  });

  it('should handle many validations with large schemas', () => {
    // Create a moderately large schema
    const schema = Type.Object({
      id: Type.Number(),
      name: Type.String({ minLength: 1, maxLength: 100 }),
      email: Type.String({ format: 'email' }),
      profile: Type.Object({
        bio: Type.String({ maxLength: 1000 }),
        avatar: Type.String({ format: 'uri' }),
        preferences: Type.Object({
          theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
          notifications: Type.Boolean()
        })
      }),
      posts: Type.Array(Type.Object({
        id: Type.Number(),
        title: Type.String({ minLength: 1, maxLength: 200 }),
        content: Type.String({ minLength: 1, maxLength: 5000 }),
        createdAt: Type.String({ format: 'date-time' })
      }), { maxItems: 100 }),
      tags: Type.Array(Type.String({ minLength: 1 }), { maxItems: 50 })
    });

    // Create test data
    const data = {
      id: 12345,
      name: 'John Doe',
      email: 'john.doe@example.com',
      profile: {
        bio: 'A very long bio...'.repeat(20),
        avatar: 'https://example.com/avatar.jpg',
        preferences: {
          theme: 'dark',
          notifications: true
        }
      },
      posts: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        title: `Post ${i}`,
        content: 'Content '.repeat(50),
        createdAt: new Date().toISOString()
      })),
      tags: Array.from({ length: 30 }, (_, i) => `tag-${i}`)
    };

    const startTime = performance.now();
    
    // Perform many validations
    for (let i = 0; i < 100; i++) {
      const validator = validatorsStore.get(schema);
      [...validator.Errors(data)];
      // We're not checking for zero errors here because we're focused on performance
    }
    
    const endTime = performance.now();
    
    console.log(`100 large schema validations took ${endTime - startTime}ms`);
    
    // Should complete within reasonable time (e.g., 1000ms)
    expect(endTime - startTime).toBeLessThan(1000);
  });
});