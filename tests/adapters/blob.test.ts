/* eslint-disable @typescript-eslint/no-explicit-any */
import {describe, it, expect, mock} from 'bun:test';

import {blobAdapter} from '#src/adapters/blob';

describe('[adapters/blob]', () => {
    // Successfully process response with body and create Blob from chunks
    it('should process response body and create Blob when response has content', async () => {
        const mockChunk = new Uint8Array([1, 2, 3]);
        const mockReader = {
            read: mock()
                .mockResolvedValueOnce({ done: false, value: mockChunk, })
                .mockResolvedValueOnce({ done: true, }),
        };
        const mockBody = { getReader: () => mockReader, };
        const mockResponse = {
            body   : mockBody,
            headers: new Headers({ 'Content-Length': '3', }),
        };
        const mockOnLoadProcess = mock();

        const result = await blobAdapter({
            response     : mockResponse as any,
            signal       : null,
            onLoadProcess: mockOnLoadProcess,
        });

        expect(result).toBeInstanceOf(Blob);
        expect(mockOnLoadProcess).toHaveBeenCalledWith(3, 3);
    });

    // Handle response with empty body
    it('should return empty Blob when response has no body', async () => {
        const mockResponse = {
            body   : null,
            headers: new Headers(),
        };
        const mockOnLoadProcess = mock();

        const result = await blobAdapter({
            response     : mockResponse as Response,
            signal       : null,
            onLoadProcess: mockOnLoadProcess,
        });

        expect(result).toBeInstanceOf(Blob);
        const arrayBuffer = await result.arrayBuffer();

        expect(arrayBuffer.byteLength).toBe(0);
        expect(mockOnLoadProcess).toHaveBeenCalledWith(0, 0);
    });

    // Process small response with single chunk
    it('should process small response with single chunk', async () => {
        const mockResponse = {
            body: {
                getReader: mock().mockReturnValue({
                    read: mock()
                        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1]), })
                        .mockResolvedValueOnce({ done: true, value: undefined, }),
                }),
            },
            headers: {
                get: mock().mockReturnValue(null),
            },
        };
        const mockOnLoadProcess = mock();
        const result = await blobAdapter({
            response     : mockResponse as unknown as Response,
            signal       : null,
            onLoadProcess: mockOnLoadProcess,
        });

        expect(result).toBeInstanceOf(Blob);
        expect(mockOnLoadProcess).toHaveBeenCalledWith(1, undefined);
    });

    it('should cancel on signal.abort', async () => {
        const mockSignal = {
            aborted         : false,
            reason          : 'Aborted',
            addEventListener: mock((type, listener) => {
                if(type === 'abort') {
                    listener();
                }
            }),
            removeEventListener: mock(),
        };
        const mockResponse = {
            body: {
                getReader: mock().mockReturnValue({
                    read: mock()
                        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1,2,3,4]), })
                        .mockResolvedValueOnce({ done: false, value: new Uint8Array([1,2,3,4]), })
                        .mockResolvedValueOnce({ done: true, value: undefined, }),
                }),
            },
            headers: {
                get: mock().mockReturnValue(null),
            },
        };
        const mockOnLoadProcess = mock(() => {
            mockSignal.aborted = true;
        });

        expect(blobAdapter({
            response     : mockResponse as unknown as Response,
            signal       : mockSignal as unknown as AbortSignal,
            onLoadProcess: mockOnLoadProcess,
        })).rejects.toThrow('Aborted');

        expect(mockOnLoadProcess).toHaveBeenCalledTimes(1);
    });
});
