import { CacheEntry, RequestConfig } from './types';
import { isGetMethod } from './utils';

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

export const apiCache = new CacheStore();
