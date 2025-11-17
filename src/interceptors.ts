import { RequestConfig, RequestInterceptor } from './types';

export class InterceptorManager {

    private handlers: Map<number, RequestInterceptor> = new Map();
    private nextId = 0;

    public use(interceptor: RequestInterceptor): number {
        const id = this.nextId++;

        this.handlers.set(id, interceptor);
        return id;
    }

    public eject(id: number): void {
        this.handlers.delete(id);
    }

    public async applyInterceptors(config: RequestConfig): Promise<RequestConfig> {
        let currentConfig = config;

        for(const [, handler] of this.handlers) {
            if(!handler) continue;
            currentConfig = await handler(currentConfig);
        }
        return currentConfig;
    }

}

const jsonTypeRequestNames = ['POST', 'PUT', 'PATCH', 'DELETE'];
const jsonTypeRequestMap = new Set([...jsonTypeRequestNames, ...jsonTypeRequestNames.map((r) => r.toLowerCase())]);

export const JSONTypeInterceptor = (requestConfig: RequestConfig & {url: string}) => {
    const {headers, method = '',} = requestConfig;

    // @ts-ignore
    if((headers && !headers?.['Content-Type']) && jsonTypeRequestMap.has(method)) {
        requestConfig.headers = {
            ...headers,
            ['Content-Type']: 'application/json;charset=utf-8',
        };
    }

    return requestConfig;
};