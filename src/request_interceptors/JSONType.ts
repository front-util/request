import { RequestConfig } from '../types';

const jsonTypeRequestNames = ['POST', 'PUT', 'PATCH', 'DELETE'];
const jsonTypeRequestMap = [...jsonTypeRequestNames, ...jsonTypeRequestNames.map((r) => r.toLowerCase())];

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
