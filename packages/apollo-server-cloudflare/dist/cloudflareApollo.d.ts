import { GraphQLOptions } from 'apollo-server-core';
import { Request, Response } from 'apollo-server-env';
import { ValueOrPromise } from 'apollo-server-types';
export interface CloudflareOptionsFunction {
    (req?: Request): ValueOrPromise<GraphQLOptions>;
}
export declare function graphqlCloudflare(options: GraphQLOptions | CloudflareOptionsFunction): (req: Request) => Promise<Response>;
//# sourceMappingURL=cloudflareApollo.d.ts.map