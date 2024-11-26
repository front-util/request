import { NativeHttpRequestParamsWithAdapapter } from "#src/types";

export const blobAdapter = async <T = Blob>({response, signal, onLoadProcess,}: {
    response: Response;
    signal: AbortSignal | null | undefined;
    onLoadProcess?: NativeHttpRequestParamsWithAdapapter<T>['onLoadProcess'];
}) => {
    const chunks: Uint8Array[] = [];

    if(!response.body) {
        return new Blob(chunks) as T;
    }
    const reader = response.body.getReader();
    const contentLength = response.headers.get('Content-Length');
    let chunkLength = 0;
     
    while(true) {
        const { done, value, } = await reader.read();

        if(done) {
            return new Blob(chunks) as T;
        }
        if(signal?.aborted) {
            throw signal?.reason;
        }
        chunkLength = chunkLength + value.length;
        onLoadProcess?.(chunkLength, contentLength ? Number(contentLength): undefined);
        chunks.push(value);
    }
};