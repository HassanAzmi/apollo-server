import { Request, RequestInit, Response, BodyInit, Headers, URL, URLSearchParams, URLSearchParamsInit, fetch } from 'apollo-server-env';
import { ValueOrPromise } from 'apollo-server-types';
import { DataSource, DataSourceConfig } from 'apollo-datasource';
import { HTTPCache } from './HTTPCache';
import { ApolloError } from 'apollo-server-errors';
declare module 'apollo-server-env/dist/fetch' {
    interface RequestInit {
        cacheOptions?: CacheOptions | ((response: Response, request: Request) => CacheOptions | undefined);
    }
}
export declare type RequestOptions = RequestInit & {
    path: string;
    params: URLSearchParams;
    headers: Headers;
    body?: Body;
};
export interface CacheOptions {
    ttl?: number;
}
export declare type Body = BodyInit | object;
export { Request };
export declare abstract class RESTDataSource<TContext = any> extends DataSource {
    private httpFetch?;
    httpCache: HTTPCache;
    context: TContext;
    memoizedResults: Map<string, Promise<any>>;
    constructor(httpFetch?: typeof fetch | undefined);
    initialize(config: DataSourceConfig<TContext>): void;
    baseURL?: string;
    protected cacheKeyFor(request: Request): string;
    protected willSendRequest?(request: RequestOptions): ValueOrPromise<void>;
    protected resolveURL(request: RequestOptions): ValueOrPromise<URL>;
    protected cacheOptionsFor?(response: Response, request: Request): CacheOptions | undefined;
    protected didReceiveResponse<TResult = any>(response: Response, _request: Request): Promise<TResult>;
    protected didEncounterError(error: Error, _request: Request): void;
    protected parseBody(response: Response): Promise<object | string>;
    protected errorFromResponse(response: Response): Promise<ApolloError>;
    protected get<TResult = any>(path: string, params?: URLSearchParamsInit, init?: RequestInit): Promise<TResult>;
    protected post<TResult = any>(path: string, body?: Body, init?: RequestInit): Promise<TResult>;
    protected patch<TResult = any>(path: string, body?: Body, init?: RequestInit): Promise<TResult>;
    protected put<TResult = any>(path: string, body?: Body, init?: RequestInit): Promise<TResult>;
    protected delete<TResult = any>(path: string, params?: URLSearchParamsInit, init?: RequestInit): Promise<TResult>;
    private fetch;
    private trace;
}
//# sourceMappingURL=RESTDataSource.d.ts.map