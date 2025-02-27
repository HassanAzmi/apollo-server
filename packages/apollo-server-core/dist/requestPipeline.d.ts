import { GraphQLSchema, GraphQLFieldResolver, DocumentNode, GraphQLError, GraphQLFormattedError } from 'graphql';
import { GraphQLExtension } from 'graphql-extensions';
import { DataSource } from 'apollo-datasource';
import { PersistedQueryOptions } from '.';
import { CacheControlExtensionOptions } from 'apollo-cache-control';
import { GraphQLRequest, GraphQLResponse, GraphQLRequestContext, GraphQLExecutor, InvalidGraphQLRequestError, ValidationRule } from 'apollo-server-types';
import { ApolloServerPlugin } from 'apollo-server-plugin-base';
import { InMemoryLRUCache } from 'apollo-server-caching';
import { GraphQLParseOptions } from 'graphql-tools';
export { GraphQLRequest, GraphQLResponse, GraphQLRequestContext, InvalidGraphQLRequestError, };
export declare const APQ_CACHE_PREFIX = "apq:";
export interface GraphQLRequestPipelineConfig<TContext> {
    schema: GraphQLSchema;
    rootValue?: ((document: DocumentNode) => any) | any;
    validationRules?: ValidationRule[];
    executor?: GraphQLExecutor;
    fieldResolver?: GraphQLFieldResolver<any, TContext>;
    dataSources?: () => DataSources<TContext>;
    extensions?: Array<() => GraphQLExtension>;
    tracing?: boolean;
    persistedQueries?: PersistedQueryOptions;
    cacheControl?: CacheControlExtensionOptions;
    formatError?: (error: GraphQLError) => GraphQLFormattedError;
    formatResponse?: (response: GraphQLResponse | null, requestContext: GraphQLRequestContext<TContext>) => GraphQLResponse;
    plugins?: ApolloServerPlugin[];
    documentStore?: InMemoryLRUCache<DocumentNode>;
    parseOptions?: GraphQLParseOptions;
}
export declare type DataSources<TContext> = {
    [name: string]: DataSource<TContext>;
};
declare type Mutable<T> = {
    -readonly [P in keyof T]: T[P];
};
export declare function processGraphQLRequest<TContext>(config: GraphQLRequestPipelineConfig<TContext>, requestContext: Mutable<GraphQLRequestContext<TContext>>): Promise<GraphQLResponse>;
//# sourceMappingURL=requestPipeline.d.ts.map