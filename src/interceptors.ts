import { RequestConfig, RequestInterceptor } from './types';

export class InterceptorManager {

    private handlers: (RequestInterceptor | null)[] = [];

    public use(interceptor: RequestInterceptor): number {
        this.handlers.push(interceptor);
        return this.handlers.length - 1;
    }

    public eject(id: number): void {
        if(id >= 0 && id < this.handlers.length) {
            this.handlers[id] = null;
        }
    }

    public async applyInterceptors(config: RequestConfig): Promise<RequestConfig> {
        let currentConfig = config;

        for(const handler of this.handlers) {
            if(!handler) continue;
            currentConfig = await handler(currentConfig);
        }
        return currentConfig;
    }

}
