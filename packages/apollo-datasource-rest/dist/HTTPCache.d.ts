import { fetch, Request, Response } from 'apollo-server-env';
import { KeyValueCache } from 'apollo-server-caching';
import { CacheOptions } from './RESTDataSource';
export declare class HTTPCache {
    private keyValueCache;
    private httpFetch;
    constructor(keyValueCache?: KeyValueCache, httpFetch?: typeof fetch);
    fetch(request: Request, options?: {
        cacheKey?: string;
        cacheOptions?: CacheOptions | ((response: Response, request: Request) => CacheOptions | undefined);
    }): Promise<Response>;
    private storeResponseAndReturnClone;
}
//# sourceMappingURL=HTTPCache.d.ts.map