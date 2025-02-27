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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const graphql = __importStar(require("graphql"));
const graphql_extensions_1 = require("graphql-extensions");
const apollo_cache_control_1 = require("apollo-cache-control");
const apollo_tracing_1 = require("apollo-tracing");
const apollo_server_errors_1 = require("apollo-server-errors");
const apollo_server_types_1 = require("apollo-server-types");
exports.InvalidGraphQLRequestError = apollo_server_types_1.InvalidGraphQLRequestError;
const dispatcher_1 = require("./utils/dispatcher");
const apollo_server_caching_1 = require("apollo-server-caching");
const createSHA_1 = __importDefault(require("./utils/createSHA"));
const runHttpQuery_1 = require("./runHttpQuery");
exports.APQ_CACHE_PREFIX = 'apq:';
function computeQueryHash(query) {
    return createSHA_1.default('sha256')
        .update(query)
        .digest('hex');
}
function processGraphQLRequest(config, requestContext) {
    return __awaiter(this, void 0, void 0, function* () {
        let cacheControlExtension;
        const extensionStack = initializeExtensionStack();
        requestContext.context._extensionStack = extensionStack;
        const dispatcher = initializeRequestListenerDispatcher();
        initializeDataSources();
        const metrics = requestContext.metrics || Object.create(null);
        if (!requestContext.metrics) {
            requestContext.metrics = metrics;
        }
        const request = requestContext.request;
        let { query, extensions } = request;
        let queryHash;
        let persistedQueryCache;
        metrics.persistedQueryHit = false;
        metrics.persistedQueryRegister = false;
        if (extensions && extensions.persistedQuery) {
            if (!config.persistedQueries || !config.persistedQueries.cache) {
                throw new apollo_server_errors_1.PersistedQueryNotSupportedError();
            }
            else if (extensions.persistedQuery.version !== 1) {
                throw new apollo_server_types_1.InvalidGraphQLRequestError('Unsupported persisted query version');
            }
            persistedQueryCache = config.persistedQueries.cache;
            if (!(persistedQueryCache instanceof apollo_server_caching_1.PrefixingKeyValueCache)) {
                persistedQueryCache = new apollo_server_caching_1.PrefixingKeyValueCache(persistedQueryCache, exports.APQ_CACHE_PREFIX);
            }
            queryHash = extensions.persistedQuery.sha256Hash;
            if (query === undefined) {
                query = yield persistedQueryCache.get(queryHash);
                if (query) {
                    metrics.persistedQueryHit = true;
                }
                else {
                    throw new apollo_server_errors_1.PersistedQueryNotFoundError();
                }
            }
            else {
                const computedQueryHash = computeQueryHash(query);
                if (queryHash !== computedQueryHash) {
                    throw new apollo_server_types_1.InvalidGraphQLRequestError('provided sha does not match query');
                }
                metrics.persistedQueryRegister = true;
            }
        }
        else if (query) {
            queryHash = computeQueryHash(query);
        }
        else {
            throw new apollo_server_types_1.InvalidGraphQLRequestError('Must provide query string.');
        }
        requestContext.queryHash = queryHash;
        requestContext.source = query;
        const requestDidEnd = extensionStack.requestDidStart({
            request: request.http,
            queryString: request.query,
            operationName: request.operationName,
            variables: request.variables,
            extensions: request.extensions,
            context: requestContext.context,
            persistedQueryHit: metrics.persistedQueryHit,
            persistedQueryRegister: metrics.persistedQueryRegister,
            requestContext: requestContext,
        });
        try {
            if (config.documentStore) {
                try {
                    requestContext.document = yield config.documentStore.get(queryHash);
                }
                catch (err) {
                    console.warn('An error occurred while attempting to read from the documentStore.', err);
                }
            }
            if (!requestContext.document) {
                const parsingDidEnd = yield dispatcher.invokeDidStartHook('parsingDidStart', requestContext);
                try {
                    requestContext.document = parse(query, config.parseOptions);
                    parsingDidEnd();
                }
                catch (syntaxError) {
                    parsingDidEnd(syntaxError);
                    return yield sendErrorResponse(syntaxError, apollo_server_errors_1.SyntaxError);
                }
                const validationDidEnd = yield dispatcher.invokeDidStartHook('validationDidStart', requestContext);
                const validationErrors = validate(requestContext.document);
                if (validationErrors.length === 0) {
                    validationDidEnd();
                }
                else {
                    validationDidEnd(validationErrors);
                    return yield sendErrorResponse(validationErrors, apollo_server_errors_1.ValidationError);
                }
                if (config.documentStore) {
                    Promise.resolve(config.documentStore.set(queryHash, requestContext.document)).catch(err => console.warn('Could not store validated document.', err));
                }
            }
            const operation = graphql_1.getOperationAST(requestContext.document, request.operationName);
            requestContext.operation = operation || undefined;
            requestContext.operationName =
                (operation && operation.name && operation.name.value) || null;
            try {
                yield dispatcher.invokeHookAsync('didResolveOperation', requestContext);
            }
            catch (err) {
                if (err instanceof runHttpQuery_1.HttpQueryError) {
                    throw err;
                }
                return yield sendErrorResponse(err);
            }
            if (metrics.persistedQueryRegister && persistedQueryCache) {
                Promise.resolve(persistedQueryCache.set(queryHash, query)).catch(console.warn);
            }
            let response = yield dispatcher.invokeHooksUntilNonNull('responseForOperation', requestContext);
            if (response == null) {
                const executionDidEnd = yield dispatcher.invokeDidStartHook('executionDidStart', requestContext);
                try {
                    const result = yield execute(requestContext);
                    if (result.errors) {
                        yield didEncounterErrors(result.errors);
                    }
                    response = Object.assign(Object.assign({}, result), { errors: result.errors ? formatErrors(result.errors) : undefined });
                    executionDidEnd();
                }
                catch (executionError) {
                    executionDidEnd(executionError);
                    return yield sendErrorResponse(executionError);
                }
            }
            if (cacheControlExtension) {
                if (requestContext.overallCachePolicy) {
                    cacheControlExtension.overrideOverallCachePolicy(requestContext.overallCachePolicy);
                }
                else {
                    requestContext.overallCachePolicy = cacheControlExtension.computeOverallCachePolicy();
                }
            }
            const formattedExtensions = extensionStack.format();
            if (Object.keys(formattedExtensions).length > 0) {
                response.extensions = formattedExtensions;
            }
            if (config.formatResponse) {
                const formattedResponse = config.formatResponse(response, requestContext);
                if (formattedResponse != null) {
                    response = formattedResponse;
                }
            }
            return sendResponse(response);
        }
        finally {
            requestDidEnd();
        }
        function parse(query, parseOptions) {
            const parsingDidEnd = extensionStack.parsingDidStart({
                queryString: query,
            });
            try {
                return graphql.parse(query, parseOptions);
            }
            finally {
                parsingDidEnd();
            }
        }
        function validate(document) {
            let rules = graphql_1.specifiedRules;
            if (config.validationRules) {
                rules = rules.concat(config.validationRules);
            }
            const validationDidEnd = extensionStack.validationDidStart();
            try {
                return graphql.validate(config.schema, document, rules);
            }
            finally {
                validationDidEnd();
            }
        }
        function execute(requestContext) {
            return __awaiter(this, void 0, void 0, function* () {
                const { request, document } = requestContext;
                const executionArgs = {
                    schema: config.schema,
                    document,
                    rootValue: typeof config.rootValue === 'function'
                        ? config.rootValue(document)
                        : config.rootValue,
                    contextValue: requestContext.context,
                    variableValues: request.variables,
                    operationName: request.operationName,
                    fieldResolver: config.fieldResolver,
                };
                const executionDidEnd = extensionStack.executionDidStart({
                    executionArgs,
                });
                try {
                    if (config.executor) {
                        return yield config.executor(requestContext);
                    }
                    else {
                        return yield graphql.execute(executionArgs);
                    }
                }
                finally {
                    executionDidEnd();
                }
            });
        }
        function sendResponse(response) {
            return __awaiter(this, void 0, void 0, function* () {
                requestContext.response = extensionStack.willSendResponse({
                    graphqlResponse: Object.assign(Object.assign({}, requestContext.response), { errors: response.errors, data: response.data, extensions: response.extensions }),
                    context: requestContext.context,
                }).graphqlResponse;
                yield dispatcher.invokeHookAsync('willSendResponse', requestContext);
                return requestContext.response;
            });
        }
        function didEncounterErrors(errors) {
            return __awaiter(this, void 0, void 0, function* () {
                requestContext.errors = errors;
                extensionStack.didEncounterErrors(errors);
                return yield dispatcher.invokeHookAsync('didEncounterErrors', requestContext);
            });
        }
        function sendErrorResponse(errorOrErrors, errorClass) {
            return __awaiter(this, void 0, void 0, function* () {
                const errors = Array.isArray(errorOrErrors)
                    ? errorOrErrors
                    : [errorOrErrors];
                yield didEncounterErrors(errors);
                return sendResponse({
                    errors: formatErrors(errors.map(err => apollo_server_errors_1.fromGraphQLError(err, errorClass && {
                        errorClass,
                    }))),
                });
            });
        }
        function formatErrors(errors) {
            return apollo_server_errors_1.formatApolloErrors(errors, {
                formatter: config.formatError,
                debug: requestContext.debug,
            });
        }
        function initializeRequestListenerDispatcher() {
            const requestListeners = [];
            if (config.plugins) {
                for (const plugin of config.plugins) {
                    if (!plugin.requestDidStart)
                        continue;
                    const listener = plugin.requestDidStart(requestContext);
                    if (listener) {
                        requestListeners.push(listener);
                    }
                }
            }
            return new dispatcher_1.Dispatcher(requestListeners);
        }
        function initializeExtensionStack() {
            graphql_extensions_1.enableGraphQLExtensions(config.schema);
            const extensions = config.extensions ? config.extensions.map(f => f()) : [];
            if (config.tracing) {
                extensions.push(new apollo_tracing_1.TracingExtension());
            }
            if (config.cacheControl) {
                cacheControlExtension = new apollo_cache_control_1.CacheControlExtension(config.cacheControl);
                extensions.push(cacheControlExtension);
            }
            return new graphql_extensions_1.GraphQLExtensionStack(extensions);
        }
        function initializeDataSources() {
            if (config.dataSources) {
                const context = requestContext.context;
                const dataSources = config.dataSources();
                for (const dataSource of Object.values(dataSources)) {
                    if (dataSource.initialize) {
                        dataSource.initialize({
                            context,
                            cache: requestContext.cache,
                        });
                    }
                }
                if ('dataSources' in context) {
                    throw new Error('Please use the dataSources config option instead of putting dataSources on the context yourself.');
                }
                context.dataSources = dataSources;
            }
        }
    });
}
exports.processGraphQLRequest = processGraphQLRequest;
//# sourceMappingURL=requestPipeline.js.map