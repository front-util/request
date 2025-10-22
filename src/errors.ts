import { TSchema } from '@sinclair/typebox';

export class NetworkError extends Error {

    public url?: string;
    public method?: string;
    public originalError?: unknown;

    constructor(message: string, url?: string, method?: string, originalError?: unknown) {
        super(`Network Error: ${message}`);
        this.name = 'NetworkError';
        this.url = url;
        this.method = method;
        this.originalError = originalError;
    }

}

export class HttpError<TError = unknown> extends Error {

    public url?: string;
    public method?: string;

    constructor(
        message: string,
    public status: number,
    public responseBody?: TError,
    url?: string,
    method?: string
    ) {
        super(`HTTP Error ${status}: ${message}`);
        this.name = 'HttpError';
        this.url = url;
        this.method = method;
    }

}

export class ParsingError extends Error {

    constructor(message: string, public originalError?: unknown) {
        super(`Parsing Error: ${message}`);
        this.name = 'ParsingError';
    }

}

export class CancellationError extends Error {

    constructor() {
        super('Request was cancelled.');
        this.name = 'CancellationError';
    }

}

export class TimeoutError extends Error {

    constructor() {
        super('Request timed out.');
        this.name = 'TimeoutError';
    }

}

export class ValidationError extends Error {

    constructor(
        message: string,
    public schema: TSchema,
    public data?: unknown,
    public details?: unknown
    ) {
        super(`Validation Error: ${message}`);
        this.name = 'ValidationError';
    }

}
