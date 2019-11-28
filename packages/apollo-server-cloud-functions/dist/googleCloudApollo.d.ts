import { GraphQLOptions } from 'apollo-server-core';
import { Request, Response } from 'express';
import { ValueOrPromise } from 'apollo-server-types';
export interface CloudFunctionGraphQLOptionsFunction {
    (req?: Request, res?: Response): ValueOrPromise<GraphQLOptions>;
}
export declare function graphqlCloudFunction(options: GraphQLOptions | CloudFunctionGraphQLOptionsFunction): any;
//# sourceMappingURL=googleCloudApollo.d.ts.map