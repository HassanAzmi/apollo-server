"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_tools_1 = require("graphql-tools");
const graphql_1 = require("graphql");
const apollo_server_caching_1 = require("apollo-server-caching");
const runtimeSupportsUploads_1 = __importDefault(require("./utils/runtimeSupportsUploads"));
const apollo_server_errors_1 = require("apollo-server-errors");
const index_1 = require("./index");
const playground_1 = require("./playground");
const schemaHash_1 = require("./utils/schemaHash");
const isDirectiveDefined_1 = require("./utils/isDirectiveDefined");
const createSHA_1 = __importDefault(require("./utils/createSHA"));
const requestPipeline_1 = require("./requestPipeline");
const apollo_server_env_1 = require("apollo-server-env");
const apollo_tools_1 = require("@apollographql/apollo-tools");
const NoIntrospection = (context) => ({
    Field(node) {
        if (node.name.value === '__schema' || node.name.value === '__type') {
            context.reportError(new graphql_1.GraphQLError('GraphQL introspection is not allowed by Apollo Server, but the query contained __schema or __type. To enable introspection, pass introspection: true to ApolloServer in production', [node]));
        }
    },
});
function getEngineApiKey(engine) {
    const keyFromEnv = process.env.ENGINE_API_KEY || '';
    if (engine === false) {
        return;
    }
    else if (typeof engine === 'object' && engine.apiKey) {
        return engine.apiKey;
    }
    else if (keyFromEnv) {
        return keyFromEnv;
    }
    return;
}
function getEngineGraphVariant(engine) {
    if (engine === false) {
        return;
    }
    else if (typeof engine === 'object' && engine.schemaTag) {
        return engine.schemaTag;
    }
    else {
        return process.env.ENGINE_SCHEMA_TAG;
    }
}
function getEngineServiceId(engine) {
    const engineApiKey = getEngineApiKey(engine);
    if (engineApiKey) {
        return engineApiKey.split(':', 2)[1];
    }
    return;
}
const forbidUploadsForTesting = process && process.env.NODE_ENV === 'test' && !runtimeSupportsUploads_1.default;
function approximateObjectSize(obj) {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}
class ApolloServerBase {
    constructor(config) {
        this.graphqlPath = '/graphql';
        this.requestOptions = Object.create(null);
        this.plugins = [];
        this.toDispose = new Set();
        if (!config)
            throw new Error('ApolloServer requires options.');
        this.config = config;
        const { context, resolvers, schema, schemaDirectives, modules, typeDefs, parseOptions = {}, introspection, mocks, mockEntireSchema, extensions, engine, subscriptions, uploads, playground, plugins, gateway } = config, requestOptions = __rest(config, ["context", "resolvers", "schema", "schemaDirectives", "modules", "typeDefs", "parseOptions", "introspection", "mocks", "mockEntireSchema", "extensions", "engine", "subscriptions", "uploads", "playground", "plugins", "gateway"]);
        if (gateway && (modules || schema || typeDefs || resolvers)) {
            throw new Error('Cannot define both `gateway` and any of: `modules`, `schema`, `typeDefs`, or `resolvers`');
        }
        this.parseOptions = parseOptions;
        this.context = context;
        this.ensurePluginInstantiation(plugins);
        const isDev = process.env.NODE_ENV !== 'production';
        if ((typeof introspection === 'boolean' && !introspection) ||
            (introspection === undefined && !isDev)) {
            const noIntro = [NoIntrospection];
            requestOptions.validationRules = requestOptions.validationRules
                ? requestOptions.validationRules.concat(noIntro)
                : noIntro;
        }
        if (requestOptions.cacheControl !== false) {
            if (typeof requestOptions.cacheControl === 'boolean' &&
                requestOptions.cacheControl === true) {
                requestOptions.cacheControl = {
                    stripFormattedExtensions: false,
                    calculateHttpHeaders: false,
                    defaultMaxAge: 0,
                };
            }
            else {
                requestOptions.cacheControl = Object.assign({ stripFormattedExtensions: true, calculateHttpHeaders: true, defaultMaxAge: 0 }, requestOptions.cacheControl);
            }
        }
        if (!requestOptions.cache) {
            requestOptions.cache = new apollo_server_caching_1.InMemoryLRUCache();
        }
        if (requestOptions.persistedQueries !== false) {
            requestOptions.persistedQueries = {
                cache: new apollo_server_caching_1.PrefixingKeyValueCache((requestOptions.persistedQueries &&
                    requestOptions.persistedQueries.cache) ||
                    requestOptions.cache, requestPipeline_1.APQ_CACHE_PREFIX),
            };
        }
        else {
            delete requestOptions.persistedQueries;
        }
        this.requestOptions = requestOptions;
        if (uploads !== false && !forbidUploadsForTesting) {
            if (this.supportsUploads()) {
                if (!runtimeSupportsUploads_1.default) {
                    printNodeFileUploadsMessage();
                    throw new Error('`graphql-upload` is no longer supported on Node.js < v8.5.0.  ' +
                        'See https://bit.ly/gql-upload-node-6.');
                }
                if (uploads === true || typeof uploads === 'undefined') {
                    this.uploadsConfig = {};
                }
                else {
                    this.uploadsConfig = uploads;
                }
            }
            else if (uploads) {
                throw new Error('This implementation of ApolloServer does not support file uploads because the environment cannot accept multi-part forms');
            }
        }
        if (engine && typeof engine === 'object') {
            if (engine.maskErrorDetails && engine.rewriteError) {
                throw new Error("Can't set both maskErrorDetails and rewriteError!");
            }
            else if (engine.rewriteError &&
                typeof engine.rewriteError !== 'function') {
                throw new Error('rewriteError must be a function');
            }
            else if (engine.maskErrorDetails) {
                engine.rewriteError = () => new graphql_1.GraphQLError('<masked>');
                delete engine.maskErrorDetails;
            }
        }
        this.engineServiceId = getEngineServiceId(engine);
        const apiKey = getEngineApiKey(engine);
        if (apiKey) {
            this.engineApiKeyHash = createSHA_1.default('sha512')
                .update(apiKey)
                .digest('hex');
        }
        if (this.engineServiceId) {
            const { EngineReportingAgent } = require('apollo-engine-reporting');
            this.engineReportingAgent = new EngineReportingAgent(typeof engine === 'object' ? engine : Object.create(null));
        }
        if (gateway && subscriptions !== false) {
            throw new Error([
                'Subscriptions are not yet compatible with the gateway.',
                "Set `subscriptions: false` in Apollo Server's constructor to",
                'explicitly disable subscriptions (which are on by default)',
                'and allow for gateway functionality.',
            ].join(' '));
        }
        else if (subscriptions !== false) {
            if (this.supportsSubscriptions()) {
                if (subscriptions === true || typeof subscriptions === 'undefined') {
                    this.subscriptionServerOptions = {
                        path: this.graphqlPath,
                    };
                }
                else if (typeof subscriptions === 'string') {
                    this.subscriptionServerOptions = { path: subscriptions };
                }
                else {
                    this.subscriptionServerOptions = Object.assign({ path: this.graphqlPath }, subscriptions);
                }
                this.subscriptionsPath = this.subscriptionServerOptions.path;
            }
            else if (subscriptions) {
                throw new Error('This implementation of ApolloServer does not support GraphQL subscriptions.');
            }
        }
        this.playgroundOptions = playground_1.createPlaygroundOptions(playground);
        const _schema = this.initSchema();
        if (graphql_1.isSchema(_schema)) {
            const derivedData = this.generateSchemaDerivedData(_schema);
            this.schema = derivedData.schema;
            this.schemaDerivedData = Promise.resolve(derivedData);
        }
        else if (typeof _schema.then === 'function') {
            this.schemaDerivedData = _schema.then(schema => this.generateSchemaDerivedData(schema));
        }
        else {
            throw new Error("Unexpected error: Unable to resolve a valid GraphQLSchema.  Please file an issue with a reproduction of this error, if possible.");
        }
    }
    setGraphQLPath(path) {
        this.graphqlPath = path;
    }
    initSchema() {
        const { gateway, engine, schema, modules, typeDefs, resolvers, schemaDirectives, parseOptions, } = this.config;
        if (gateway) {
            this.toDispose.add(gateway.onSchemaChange(schema => (this.schemaDerivedData = Promise.resolve(this.generateSchemaDerivedData(schema)))));
            const graphVariant = getEngineGraphVariant(engine);
            const engineConfig = this.engineApiKeyHash && this.engineServiceId
                ? Object.assign({ apiKeyHash: this.engineApiKeyHash, graphId: this.engineServiceId }, (graphVariant && { graphVariant })) : undefined;
            return gateway.load({ engine: engineConfig }).then(config => {
                this.requestOptions.executor = config.executor;
                return config.schema;
            });
        }
        let constructedSchema;
        if (schema) {
            constructedSchema = schema;
        }
        else if (modules) {
            const { schema, errors } = apollo_tools_1.buildServiceDefinition(modules);
            if (errors && errors.length > 0) {
                throw new Error(errors.map(error => error.message).join('\n\n'));
            }
            constructedSchema = schema;
        }
        else {
            if (!typeDefs) {
                throw Error('Apollo Server requires either an existing schema, modules or typeDefs');
            }
            const augmentedTypeDefs = Array.isArray(typeDefs) ? typeDefs : [typeDefs];
            if (!isDirectiveDefined_1.isDirectiveDefined(augmentedTypeDefs, 'cacheControl')) {
                augmentedTypeDefs.push(index_1.gql `
            enum CacheControlScope {
              PUBLIC
              PRIVATE
            }

            directive @cacheControl(
              maxAge: Int
              scope: CacheControlScope
            ) on FIELD_DEFINITION | OBJECT | INTERFACE
          `);
            }
            if (this.uploadsConfig) {
                const { GraphQLUpload } = require('graphql-upload');
                if (Array.isArray(resolvers)) {
                    if (resolvers.every(resolver => !resolver.Upload)) {
                        resolvers.push({ Upload: GraphQLUpload });
                    }
                }
                else {
                    if (resolvers && !resolvers.Upload) {
                        resolvers.Upload = GraphQLUpload;
                    }
                }
                augmentedTypeDefs.push(index_1.gql `
            scalar Upload
          `);
            }
            constructedSchema = graphql_tools_1.makeExecutableSchema({
                typeDefs: augmentedTypeDefs,
                schemaDirectives,
                resolvers,
                parseOptions,
            });
        }
        return constructedSchema;
    }
    generateSchemaDerivedData(schema) {
        const schemaHash = schemaHash_1.generateSchemaHash(schema);
        const { mocks, mockEntireSchema, extensions: _extensions } = this.config;
        if (mocks || (typeof mockEntireSchema !== 'undefined' && mocks !== false)) {
            graphql_tools_1.addMockFunctionsToSchema({
                schema,
                mocks: typeof mocks === 'boolean' || typeof mocks === 'undefined'
                    ? {}
                    : mocks,
                preserveResolvers: typeof mockEntireSchema === 'undefined' ? false : !mockEntireSchema,
            });
        }
        const extensions = [];
        const schemaIsFederated = this.schemaIsFederated(schema);
        const { engine } = this.config;
        if (this.engineReportingAgent) {
            if (schemaIsFederated) {
                console.warn("It looks like you're running a federated schema and you've configured your service " +
                    'to report metrics to Apollo Graph Manager. You should only configure your Apollo gateway ' +
                    'to report metrics to Apollo Graph Manager.');
            }
            extensions.push(() => this.engineReportingAgent.newExtension(schemaHash));
        }
        else if (engine !== false && schemaIsFederated) {
            const { EngineFederatedTracingExtension, } = require('apollo-engine-reporting');
            const rewriteError = engine && typeof engine === 'object' ? engine.rewriteError : undefined;
            extensions.push(() => new EngineFederatedTracingExtension({ rewriteError }));
        }
        extensions.push(...(_extensions || []));
        const documentStore = this.initializeDocumentStore();
        return {
            schema,
            schemaHash,
            extensions,
            documentStore,
        };
    }
    willStart() {
        return __awaiter(this, void 0, void 0, function* () {
            const { schema, schemaHash } = yield this.schemaDerivedData;
            yield Promise.all(this.plugins.map(plugin => plugin.serverWillStart &&
                plugin.serverWillStart({
                    schema: schema,
                    schemaHash: schemaHash,
                    engine: {
                        serviceID: this.engineServiceId,
                        apiKeyHash: this.engineApiKeyHash,
                    },
                    persistedQueries: this.requestOptions.persistedQueries,
                })));
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            this.toDispose.forEach(dispose => dispose());
            if (this.subscriptionServer)
                yield this.subscriptionServer.close();
            if (this.engineReportingAgent) {
                this.engineReportingAgent.stop();
                yield this.engineReportingAgent.sendAllReports();
            }
        });
    }
    installSubscriptionHandlers(server) {
        if (!this.subscriptionServerOptions) {
            if (this.config.gateway) {
                throw Error('Subscriptions are not supported when operating as a gateway');
            }
            if (this.supportsSubscriptions()) {
                throw Error('Subscriptions are disabled, due to subscriptions set to false in the ApolloServer constructor');
            }
            else {
                throw Error('Subscriptions are not supported, choose an integration, such as apollo-server-express that allows persistent connections');
            }
        }
        const { SubscriptionServer } = require('subscriptions-transport-ws');
        const { onDisconnect, onConnect, keepAlive, path, } = this.subscriptionServerOptions;
        const schema = this.schema;
        if (this.schema === undefined)
            throw new Error('Schema undefined during creation of subscription server.');
        this.subscriptionServer = SubscriptionServer.create({
            schema,
            execute: graphql_1.execute,
            subscribe: graphql_1.subscribe,
            onConnect: onConnect
                ? onConnect
                : (connectionParams) => (Object.assign({}, connectionParams)),
            onDisconnect: onDisconnect,
            onOperation: (message, connection) => __awaiter(this, void 0, void 0, function* () {
                connection.formatResponse = (value) => (Object.assign(Object.assign({}, value), { errors: value.errors &&
                        apollo_server_errors_1.formatApolloErrors([...value.errors], {
                            formatter: this.requestOptions.formatError,
                            debug: this.requestOptions.debug,
                        }) }));
                connection.formatError = this.requestOptions.formatError;
                let context = this.context ? this.context : { connection };
                try {
                    context =
                        typeof this.context === 'function'
                            ? yield this.context({ connection, payload: message.payload })
                            : context;
                }
                catch (e) {
                    throw apollo_server_errors_1.formatApolloErrors([e], {
                        formatter: this.requestOptions.formatError,
                        debug: this.requestOptions.debug,
                    })[0];
                }
                return Object.assign(Object.assign({}, connection), { context });
            }),
            keepAlive,
        }, {
            server,
            path,
        });
    }
    supportsSubscriptions() {
        return false;
    }
    supportsUploads() {
        return false;
    }
    schemaIsFederated(schema) {
        const serviceType = schema.getType('_Service');
        if (!(serviceType && graphql_1.isObjectType(serviceType))) {
            return false;
        }
        const sdlField = serviceType.getFields().sdl;
        if (!sdlField) {
            return false;
        }
        const sdlFieldType = sdlField.type;
        if (!graphql_1.isScalarType(sdlFieldType)) {
            return false;
        }
        return sdlFieldType.name == 'String';
    }
    ensurePluginInstantiation(plugins) {
        if (!plugins || !plugins.length) {
            return;
        }
        this.plugins = plugins.map(plugin => {
            if (typeof plugin === 'function') {
                return plugin();
            }
            return plugin;
        });
    }
    initializeDocumentStore() {
        return new apollo_server_caching_1.InMemoryLRUCache({
            maxSize: Math.pow(2, 20) * 30,
            sizeCalculator: approximateObjectSize,
        });
    }
    graphQLServerOptions(integrationContextArgument) {
        return __awaiter(this, void 0, void 0, function* () {
            const { schema, documentStore, extensions } = yield this.schemaDerivedData;
            let context = this.context ? this.context : {};
            try {
                context =
                    typeof this.context === 'function'
                        ? yield this.context(integrationContextArgument || {})
                        : context;
            }
            catch (error) {
                context = () => {
                    throw error;
                };
            }
            return Object.assign({ schema, plugins: this.plugins, documentStore,
                extensions,
                context, persistedQueries: this.requestOptions
                    .persistedQueries, fieldResolver: this.requestOptions.fieldResolver, parseOptions: this.parseOptions, reporting: !!this.engineReportingAgent }, this.requestOptions);
        });
    }
    executeOperation(request) {
        return __awaiter(this, void 0, void 0, function* () {
            let options;
            try {
                options = yield this.graphQLServerOptions();
            }
            catch (e) {
                e.message = `Invalid options provided to ApolloServer: ${e.message}`;
                throw new Error(e);
            }
            if (typeof options.context === 'function') {
                options.context = options.context();
            }
            const requestCtx = {
                request,
                context: options.context || Object.create(null),
                cache: options.cache,
                response: {
                    http: {
                        headers: new apollo_server_env_1.Headers(),
                    },
                },
            };
            return requestPipeline_1.processGraphQLRequest(options, requestCtx);
        });
    }
}
exports.ApolloServerBase = ApolloServerBase;
function printNodeFileUploadsMessage() {
    console.error([
        '*****************************************************************',
        '*                                                               *',
        '* ERROR! Manual intervention is necessary for Node.js < v8.5.0! *',
        '*                                                               *',
        '*****************************************************************',
        '',
        'The third-party `graphql-upload` package, which is used to implement',
        'file uploads in Apollo Server 2.x, no longer supports Node.js LTS',
        'versions prior to Node.js v8.5.0.',
        '',
        'Deployments which NEED file upload capabilities should update to',
        'Node.js >= v8.5.0 to continue using uploads.',
        '',
        'If this server DOES NOT NEED file uploads and wishes to continue',
        'using this version of Node.js, uploads can be disabled by adding:',
        '',
        '  uploads: false,',
        '',
        '...to the options for Apollo Server and re-deploying the server.',
        '',
        'For more information, see https://bit.ly/gql-upload-node-6.',
        '',
    ].join('\n'));
}
//# sourceMappingURL=ApolloServer.js.map