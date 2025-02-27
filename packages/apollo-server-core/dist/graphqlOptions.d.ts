import { GraphQLSchema, ValidationContext, GraphQLFieldResolver, DocumentNode, GraphQLError, GraphQLFormattedError } from 'graphql';
import { GraphQLExtension } from 'graphql-extensions';
import { CacheControlExtensionOptions } from 'apollo-cache-control';
import { KeyValueCache, InMemoryLRUCache } from 'apollo-server-caching';
import { DataSource } from 'apollo-datasource';
import { ApolloServerPlugin } from 'apollo-server-plugin-base';
import { GraphQLParseOptions } from 'graphql-tools';
import { GraphQLExecutor, ValueOrPromise, GraphQLResponse, GraphQLRequestContext } from 'apollo-server-types';
export interface GraphQLServerOptions<TContext = Record<string, any>, TRootValue = any> {
    schema: GraphQLSchema;
    formatError?: (error: GraphQLError) => GraphQLFormattedError;
    rootValue?: ((parsedQuery: DocumentNode) => TRootValue) | TRootValue;
    context?: TContext | (() => never);
    validationRules?: Array<(context: ValidationContext) => any>;
    executor?: GraphQLExecutor;
    formatResponse?: (response: GraphQLResponse | null, requestContext: GraphQLRequestContext<TContext>) => GraphQLResponse;
    fieldResolver?: GraphQLFieldResolver<any, TContext>;
    debug?: boolean;
    tracing?: boolean;
    cacheControl?: CacheControlExtensionOptions;
    extensions?: Array<() => GraphQLExtension>;
    dataSources?: () => DataSources<TContext>;
    cache?: KeyValueCache;
    persistedQueries?: PersistedQueryOptions;
    plugins?: ApolloServerPlugin[];
    documentStore?: InMemoryLRUCache<DocumentNode>;
    parseOptions?: GraphQLParseOptions;
    reporting?: boolean;
}
export declare type DataSources<TContext> = {
    [name: string]: DataSource<TContext>;
};
export interface PersistedQueryOptions {
    cache: KeyValueCache;
}
export default GraphQLServerOptions;
export declare function resolveGraphqlOptions(options: GraphQLServerOptions | ((...args: Array<any>) => ValueOrPromise<GraphQLServerOptions>), ...args: Array<any>): Promise<GraphQLServerOptions>;
//# sourceMappingURL=graphqlOptions.d.ts.map