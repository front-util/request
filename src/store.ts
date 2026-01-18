import { Compile, Validator } from "typebox/compile";
import { TSchema } from "typebox/type";

import { ValidationError } from "./errors";
import { CacheEntry, RequestConfig, ValidationType } from './types';
import { isGetMethod } from './utils';

const MAX_ERRORS_LENGTH = 3;

class ValidatorsStore {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private validatorsMap = new WeakMap<TSchema, Validator<any, TSchema>>();

    public validationErrors: ValidationError[] = [];

    public pushError(validationError: ValidationError) {
        if(this.validationErrors.length >= MAX_ERRORS_LENGTH) {
            this.validationErrors.shift();
        }
        this.validationErrors.push(validationError);
    }

    public getErrors() {
        return this.validationErrors;
    }

    public get(schema: TSchema) {
        let validator = this.validatorsMap.get(schema);
    
        if(!validator) {
            try {
                validator = Compile(schema);
                this.set(schema, validator);
            } catch(error) {
                console.error(error);
            }
        }
        return validator;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public set(key: TSchema, value: Validator<any, TSchema>) {
        this.validatorsMap.set(key, value);
    }
    
    public delete(value: TSchema) {
        if(this.validatorsMap.has(value)) {
            return this.validatorsMap.delete(value);
        }
    }

    public validate(
        validationType: ValidationType = 'disabled',
        schema?: TSchema,
        data?: unknown
    ): ValidationError | undefined {
        if(validationType === 'disabled' || !schema || !data) {
            return;
        }
        const validator = this.get(schema);
    
        if(!validator) return;
    
        try {
            const errors = validator.Errors(data);
    
            if(!errors?.length) return;
    
            const validationError = new ValidationError(`Invalid data`, schema, data, errors);

            this.pushError(validationError);
            return validationError;
        } catch(error) {
            return new ValidationError(
                `Validation failed for current data by schema`,
                schema,
                data,
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    public clear() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.validatorsMap = new WeakMap<TSchema, Validator<any, TSchema>>();
        this.validationErrors = [];
    }

}

function generateCacheKey(config: RequestConfig): string {
    return config.cacheKey || `${config.method || 'GET'}:${config.url}`;
}

export class CacheStore {

    private cache = new Map<string, CacheEntry>();

    public get<TData = unknown>(config: RequestConfig): CacheEntry<TData> | null {
        if(!isGetMethod(config)) return null;

        const key = generateCacheKey(config);
        const entry = this.cache.get(key);

        if(!entry) return null;

        if(entry.ttlTimestamp < Date.now()) {
            this.cache.delete(key);
            return null;
        }

        return entry as CacheEntry<TData>;
    }

    public set(config: RequestConfig, data: unknown, status: number, ttl: number): void {
        if(!isGetMethod(config) || ttl <= 0) return;

        const key = generateCacheKey(config);

        this.cache.set(key, {
            data,
            status,
            ttlTimestamp: Date.now() + ttl,
        });
    }

    public invalidate(configOrKey: RequestConfig | string): void {
        const key = typeof configOrKey === 'string' 
            ? configOrKey 
            : generateCacheKey(configOrKey);

        this.cache.delete(key);
    }

    public invalidateByPattern(pattern: RegExp): void {
        for(const key of this.cache.keys()) {
            if(pattern.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    public clear(): void {
        this.cache.clear();
    }

}

export const cacheStore = new CacheStore();
export const validatorsStore = new ValidatorsStore();

export function clearCachedData() {
    cacheStore.clear();
    validatorsStore.clear();
}
