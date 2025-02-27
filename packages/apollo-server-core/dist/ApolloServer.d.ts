/// <reference types="node" />
import { Server as HttpServer } from 'http';
import { GraphQLSchema } from 'graphql';
import { ApolloServerPlugin } from 'apollo-server-plugin-base';
import { GraphQLServerOptions } from './graphqlOptions';
import { Config, SubscriptionServerOptions, FileUploadOptions } from './types';
import { PlaygroundRenderPageOptions } from './playground';
import { GraphQLRequest } from './requestPipeline';
export declare class ApolloServerBase {
    subscriptionsPath?: string;
    graphqlPath: string;
    requestOptions: Partial<GraphQLServerOptions<any>>;
    private context?;
    private engineReportingAgent?;
    private engineServiceId?;
    private engineApiKeyHash?;
    protected plugins: ApolloServerPlugin[];
    protected subscriptionServerOptions?: SubscriptionServerOptions;
    protected uploadsConfig?: FileUploadOptions;
    private subscriptionServer?;
    protected playgroundOptions?: PlaygroundRenderPageOptions;
    private parseOptions;
    private schemaDerivedData;
    private config;
    protected schema?: GraphQLSchema;
    private toDispose;
    constructor(config: Config);
    setGraphQLPath(path: string): void;
    private initSchema;
    private generateSchemaDerivedData;
    protected willStart(): Promise<void>;
    stop(): Promise<void>;
    installSubscriptionHandlers(server: HttpServer): void;
    protected supportsSubscriptions(): boolean;
    protected supportsUploads(): boolean;
    private schemaIsFederated;
    private ensurePluginInstantiation;
    private initializeDocumentStore;
    protected graphQLServerOptions(integrationContextArgument?: Record<string, any>): Promise<GraphQLServerOptions>;
    executeOperation(request: GraphQLRequest): Promise<import("apollo-server-types").GraphQLResponse>;
}
//# sourceMappingURL=ApolloServer.d.ts.map