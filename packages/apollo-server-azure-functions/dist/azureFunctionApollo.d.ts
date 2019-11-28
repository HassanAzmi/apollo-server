import { Context, HttpRequest, AzureFunction } from '@azure/functions';
import { GraphQLOptions } from 'apollo-server-core';
import { ValueOrPromise } from 'apollo-server-types';
export interface AzureFunctionGraphQLOptionsFunction {
    (request: HttpRequest, context: Context): ValueOrPromise<GraphQLOptions>;
}
export declare function graphqlAzureFunction(options: GraphQLOptions | AzureFunctionGraphQLOptionsFunction): AzureFunction;
//# sourceMappingURL=azureFunctionApollo.d.ts.map