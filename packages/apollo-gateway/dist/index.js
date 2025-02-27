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
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_caching_1 = require("apollo-server-caching");
const graphql_1 = require("graphql");
const apollo_graphql_1 = require("apollo-graphql");
const federation_1 = require("@apollo/federation");
const loglevel_1 = __importDefault(require("loglevel"));
const loglevel_debug_1 = __importDefault(require("loglevel-debug"));
const buildQueryPlan_1 = require("./buildQueryPlan");
exports.buildQueryPlan = buildQueryPlan_1.buildQueryPlan;
exports.buildOperationContext = buildQueryPlan_1.buildOperationContext;
const executeQueryPlan_1 = require("./executeQueryPlan");
exports.executeQueryPlan = executeQueryPlan_1.executeQueryPlan;
const loadServicesFromRemoteEndpoint_1 = require("./loadServicesFromRemoteEndpoint");
const loadServicesFromStorage_1 = require("./loadServicesFromStorage");
const QueryPlan_1 = require("./QueryPlan");
exports.serializeQueryPlan = QueryPlan_1.serializeQueryPlan;
const RemoteGraphQLDataSource_1 = require("./datasources/RemoteGraphQLDataSource");
const values_1 = require("graphql/execution/values");
function isLocalConfig(config) {
    return 'localServiceList' in config;
}
function isRemoteConfig(config) {
    return 'serviceList' in config;
}
function isManagedConfig(config) {
    return !isRemoteConfig(config) && !isLocalConfig(config);
}
class ApolloGateway {
    constructor(config) {
        this.serviceMap = Object.create(null);
        this.onSchemaChangeListeners = new Set();
        this.serviceDefinitions = [];
        this.serviceSdlCache = new Map();
        this.executor = (requestContext) => __awaiter(this, void 0, void 0, function* () {
            const { request, document, queryHash } = requestContext;
            const queryPlanStoreKey = queryHash + (request.operationName || '');
            const operationContext = buildQueryPlan_1.buildOperationContext(this.schema, document, request.operationName);
            const validationErrors = this.validateIncomingRequest(requestContext, operationContext);
            if (validationErrors.length > 0) {
                return { errors: validationErrors };
            }
            let queryPlan;
            if (this.queryPlanStore) {
                queryPlan = yield this.queryPlanStore.get(queryPlanStoreKey);
            }
            if (!queryPlan) {
                queryPlan = buildQueryPlan_1.buildQueryPlan(operationContext);
                if (this.queryPlanStore) {
                    Promise.resolve(this.queryPlanStore.set(queryPlanStoreKey, queryPlan)).catch(err => this.logger.warn('Could not store queryPlan', err));
                }
            }
            const serviceMap = Object.entries(this.serviceMap).reduce((serviceDataSources, [serviceName, { dataSource }]) => {
                serviceDataSources[serviceName] = dataSource;
                return serviceDataSources;
            }, Object.create(null));
            if (this.experimental_didResolveQueryPlan) {
                this.experimental_didResolveQueryPlan({
                    queryPlan,
                    serviceMap,
                    operationContext,
                });
            }
            const response = yield executeQueryPlan_1.executeQueryPlan(queryPlan, serviceMap, requestContext, operationContext);
            const shouldShowQueryPlan = this.config.__exposeQueryPlanExperimental &&
                request.http &&
                request.http.headers &&
                request.http.headers.get('Apollo-Query-Plan-Experimental');
            const serializedQueryPlan = queryPlan.node && (this.config.debug || shouldShowQueryPlan)
                ? QueryPlan_1.serializeQueryPlan(queryPlan)
                : null;
            if (this.config.debug && serializedQueryPlan) {
                this.logger.debug(serializedQueryPlan);
            }
            if (shouldShowQueryPlan) {
                response.extensions = {
                    __queryPlanExperimental: serializedQueryPlan || true,
                };
            }
            return response;
        });
        this.config = Object.assign({ __exposeQueryPlanExperimental: process.env.NODE_ENV !== 'production' }, config);
        this.logger = loglevel_1.default.getLogger(`apollo-gateway:`);
        loglevel_debug_1.default(this.logger);
        if (this.config.debug === true) {
            this.logger.enableAll();
        }
        if (isLocalConfig(this.config)) {
            this.schema = this.createSchema(this.config.localServiceList);
        }
        this.initializeQueryPlanStore();
        this.updateServiceDefinitions = this.loadServiceDefinitions;
        if (config) {
            this.updateServiceDefinitions =
                config.experimental_updateServiceDefinitions ||
                    this.updateServiceDefinitions;
            this.experimental_didResolveQueryPlan =
                config.experimental_didResolveQueryPlan;
            this.experimental_didFailComposition =
                config.experimental_didFailComposition;
            this.experimental_didUpdateComposition =
                config.experimental_didUpdateComposition;
            if (isManagedConfig(config) &&
                config.experimental_pollInterval &&
                config.experimental_pollInterval < 10000) {
                this.experimental_pollInterval = 10000;
                this.logger.warn('Polling Apollo services at a frequency of less than once per 10 seconds (10000) is disallowed. Instead, the minimum allowed pollInterval of 10000 will be used. Please reconfigure your experimental_pollInterval accordingly. If this is problematic for your team, please contact support.');
            }
            else {
                this.experimental_pollInterval = config.experimental_pollInterval;
            }
            if (config.experimental_pollInterval && isRemoteConfig(config)) {
                console.warn('Polling running services is dangerous and not recommended in production. ' +
                    'Polling should only be used against a registry. ' +
                    'If you are polling running services, use with caution.');
            }
        }
    }
    load(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateComposition(options);
            const { graphId, graphVariant } = (options && options.engine) || {};
            const mode = isManagedConfig(this.config) ? 'managed' : 'unmanaged';
            this.logger.info(`Gateway successfully loaded schema.\n\t* Mode: ${mode}${graphId ? `\n\t* Service: ${graphId}@${graphVariant || 'current'}` : ''}`);
            if (this.experimental_pollInterval) {
                setInterval(() => this.updateComposition(options), this.experimental_pollInterval);
            }
            return {
                schema: this.schema,
                executor: this.executor,
            };
        });
    }
    updateComposition(options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (options && options.engine) {
                if (!options.engine.graphVariant)
                    console.warn('No graph variant provided. Defaulting to `current`.');
                this.engineConfig = options.engine;
            }
            const previousSchema = this.schema;
            const previousServiceDefinitions = this.serviceDefinitions;
            const previousCompositionMetadata = this.compositionMetadata;
            let result;
            this.logger.debug('Loading configuration for gateway');
            try {
                result = yield this.updateServiceDefinitions(this.config);
            }
            catch (e) {
                this.logger.warn('Error checking for schema updates. Falling back to existing schema.', e);
                return;
            }
            if (!result.serviceDefinitions ||
                JSON.stringify(this.serviceDefinitions) ===
                    JSON.stringify(result.serviceDefinitions)) {
                this.logger.debug('No change in service definitions since last check');
                return;
            }
            if (previousSchema) {
                this.logger.info('Gateway config has changed, updating schema');
            }
            this.compositionMetadata = result.compositionMetadata;
            this.serviceDefinitions = result.serviceDefinitions;
            if (this.queryPlanStore)
                this.queryPlanStore.flush();
            this.schema = this.createSchema(result.serviceDefinitions);
            try {
                this.onSchemaChangeListeners.forEach(listener => listener(this.schema));
            }
            catch (e) {
                this.logger.error('Error notifying schema change listener of update to schema.', e);
            }
            if (this.experimental_didUpdateComposition) {
                this.experimental_didUpdateComposition(Object.assign({ serviceDefinitions: result.serviceDefinitions, schema: this.schema }, (this.compositionMetadata && {
                    compositionMetadata: this.compositionMetadata,
                })), previousServiceDefinitions &&
                    previousSchema && Object.assign({ serviceDefinitions: previousServiceDefinitions, schema: previousSchema }, (previousCompositionMetadata && {
                    compositionMetadata: previousCompositionMetadata,
                })));
            }
        });
    }
    createSchema(serviceList) {
        this.logger.debug(`Composing schema from service list: \n${serviceList
            .map(({ name, url }) => `  ${url || 'local'}: ${name}`)
            .join('\n')}`);
        const { schema, errors } = federation_1.composeAndValidate(serviceList);
        if (errors && errors.length > 0) {
            if (this.experimental_didFailComposition) {
                this.experimental_didFailComposition(Object.assign({ errors,
                    serviceList }, (this.compositionMetadata && {
                    compositionMetadata: this.compositionMetadata,
                })));
            }
            throw new apollo_graphql_1.GraphQLSchemaValidationError(errors);
        }
        this.createServices(serviceList);
        this.logger.debug('Schema loaded and ready for execution');
        return wrapSchemaWithAliasResolver(schema);
    }
    onSchemaChange(callback) {
        if (!isManagedConfig(this.config)) {
            return () => { };
        }
        this.onSchemaChangeListeners.add(callback);
        if (!this.pollingTimer)
            this.startPollingServices();
        return () => {
            this.onSchemaChangeListeners.delete(callback);
            if (this.onSchemaChangeListeners.size === 0 && this.pollingTimer) {
                clearInterval(this.pollingTimer);
                this.pollingTimer = undefined;
            }
        };
    }
    startPollingServices() {
        if (this.pollingTimer)
            clearInterval(this.pollingTimer);
        this.pollingTimer = setInterval(() => {
            this.updateComposition();
        }, this.experimental_pollInterval || 10000);
        this.pollingTimer.unref();
    }
    createAndCacheDataSource(serviceDef) {
        if (this.serviceMap[serviceDef.name] &&
            serviceDef.url === this.serviceMap[serviceDef.name].url)
            return this.serviceMap[serviceDef.name].dataSource;
        if (!serviceDef.url && !isLocalConfig(this.config)) {
            this.logger.error(`Service definition for service ${serviceDef.name} is missing a url`);
        }
        const dataSource = this.config.buildService
            ? this.config.buildService(serviceDef)
            : new RemoteGraphQLDataSource_1.RemoteGraphQLDataSource({
                url: serviceDef.url,
            });
        this.serviceMap[serviceDef.name] = { url: serviceDef.url, dataSource };
        return dataSource;
    }
    createServices(services) {
        for (const serviceDef of services) {
            this.createAndCacheDataSource(serviceDef);
        }
    }
    loadServiceDefinitions(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (isLocalConfig(config)) {
                return { isNewSchema: false };
            }
            if (isRemoteConfig(config)) {
                const serviceList = config.serviceList.map(serviceDefinition => (Object.assign(Object.assign({}, serviceDefinition), { dataSource: this.createAndCacheDataSource(serviceDefinition) })));
                return loadServicesFromRemoteEndpoint_1.getServiceDefinitionsFromRemoteEndpoint(Object.assign(Object.assign({ serviceList }, (config.introspectionHeaders
                    ? { headers: config.introspectionHeaders }
                    : {})), { serviceSdlCache: this.serviceSdlCache }));
            }
            if (!this.engineConfig) {
                throw new Error('When `serviceList` is not set, an Apollo Engine configuration must be provided. See https://www.apollographql.com/docs/apollo-server/federation/managed-federation/ for more information.');
            }
            return loadServicesFromStorage_1.getServiceDefinitionsFromStorage({
                graphId: this.engineConfig.graphId,
                apiKeyHash: this.engineConfig.apiKeyHash,
                graphVariant: this.engineConfig.graphVariant,
                federationVersion: config.federationVersion || 1,
            });
        });
    }
    validateIncomingRequest(requestContext, operationContext) {
        const variableDefinitions = operationContext.operation
            .variableDefinitions;
        if (!variableDefinitions)
            return [];
        const { errors } = values_1.getVariableValues(operationContext.schema, variableDefinitions, requestContext.request.variables);
        return errors || [];
    }
    initializeQueryPlanStore() {
        this.queryPlanStore = new apollo_server_caching_1.InMemoryLRUCache({
            maxSize: Math.pow(2, 20) * 30,
            sizeCalculator: approximateObjectSize,
        });
    }
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pollingTimer) {
                clearInterval(this.pollingTimer);
                this.pollingTimer = undefined;
            }
        });
    }
}
exports.ApolloGateway = ApolloGateway;
function approximateObjectSize(obj) {
    return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}
function wrapSchemaWithAliasResolver(schema) {
    const typeMap = schema.getTypeMap();
    Object.keys(typeMap).forEach(typeName => {
        const type = typeMap[typeName];
        if (graphql_1.isObjectType(type) && !graphql_1.isIntrospectionType(type)) {
            const fields = type.getFields();
            Object.keys(fields).forEach(fieldName => {
                const field = fields[fieldName];
                field.resolve = executeQueryPlan_1.defaultFieldResolverWithAliasSupport;
            });
        }
    });
    return schema;
}
__export(require("./datasources"));
//# sourceMappingURL=index.js.map