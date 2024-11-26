import { RequestConfig } from '../types';

const jsonTypeRequestMap = ['POST', 'PUT', 'PATCH', 'DELETE'];

export const JSONTypeInterceptor = (requestConfig: RequestConfig & {url: string}) => {
    const {headers, method = '',} = requestConfig;

    if((!headers?.['Content-Type']) && jsonTypeRequestMap.includes(method)) {
        requestConfig.headers = {
            ...headers,
            ['Content-Type']: 'application/json;charset=utf-8',
        };
    }

    return requestConfig;
};
