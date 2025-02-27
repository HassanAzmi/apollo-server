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
const cors_1 = __importDefault(require("@koa/cors"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const koa_compose_1 = __importDefault(require("koa-compose"));
const graphql_playground_html_1 = require("@apollographql/graphql-playground-html");
const apollo_server_core_1 = require("apollo-server-core");
const accepts_1 = __importDefault(require("accepts"));
const type_is_1 = __importDefault(require("type-is"));
const koaApollo_1 = require("./koaApollo");
var apollo_server_core_2 = require("apollo-server-core");
exports.GraphQLExtension = apollo_server_core_2.GraphQLExtension;
const fileUploadMiddleware = (uploadsConfig, server) => (ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (type_is_1.default(ctx.req, ['multipart/form-data'])) {
        try {
            ctx.request.body = yield apollo_server_core_1.processFileUploads(ctx.req, ctx.res, uploadsConfig);
            return next();
        }
        catch (error) {
            if (error.status && error.expose)
                ctx.status = error.status;
            throw apollo_server_core_1.formatApolloErrors([error], {
                formatter: server.requestOptions.formatError,
                debug: server.requestOptions.debug,
            });
        }
    }
    else {
        return next();
    }
});
const middlewareFromPath = (path, middleware) => (ctx, next) => {
    if (ctx.path === path) {
        return middleware(ctx, next);
    }
    else {
        return next();
    }
};
class ApolloServer extends apollo_server_core_1.ApolloServerBase {
    createGraphQLServerOptions(ctx) {
        const _super = Object.create(null, {
            graphQLServerOptions: { get: () => super.graphQLServerOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            return _super.graphQLServerOptions.call(this, { ctx });
        });
    }
    supportsSubscriptions() {
        return true;
    }
    supportsUploads() {
        return true;
    }
    applyMiddleware(_a) {
        var { app } = _a, rest = __rest(_a, ["app"]);
        app.use(this.getMiddleware(rest));
    }
    getMiddleware({ path, cors, bodyParserConfig, disableHealthCheck, onHealthCheck, } = {}) {
        if (!path)
            path = '/graphql';
        const promiseWillStart = this.willStart();
        const middlewares = [];
        middlewares.push(middlewareFromPath(path, (_ctx, next) => __awaiter(this, void 0, void 0, function* () {
            yield promiseWillStart;
            return next();
        })));
        if (!disableHealthCheck) {
            middlewares.push(middlewareFromPath('/.well-known/apollo/server-health', (ctx) => {
                ctx.set('Content-Type', 'application/health+json');
                if (onHealthCheck) {
                    return onHealthCheck(ctx)
                        .then(() => {
                        ctx.body = { status: 'pass' };
                    })
                        .catch(() => {
                        ctx.status = 503;
                        ctx.body = { status: 'fail' };
                    });
                }
                else {
                    ctx.body = { status: 'pass' };
                }
            }));
        }
        let uploadsMiddleware;
        if (this.uploadsConfig && typeof apollo_server_core_1.processFileUploads === 'function') {
            uploadsMiddleware = fileUploadMiddleware(this.uploadsConfig, this);
        }
        this.graphqlPath = path;
        if (cors === true) {
            middlewares.push(middlewareFromPath(path, cors_1.default()));
        }
        else if (cors !== false) {
            middlewares.push(middlewareFromPath(path, cors_1.default(cors)));
        }
        if (bodyParserConfig === true) {
            middlewares.push(middlewareFromPath(path, koa_bodyparser_1.default()));
        }
        else if (bodyParserConfig !== false) {
            middlewares.push(middlewareFromPath(path, koa_bodyparser_1.default(bodyParserConfig)));
        }
        if (uploadsMiddleware) {
            middlewares.push(middlewareFromPath(path, uploadsMiddleware));
        }
        middlewares.push(middlewareFromPath(path, (ctx, next) => {
            if (ctx.request.method === 'OPTIONS') {
                ctx.status = 204;
                ctx.body = '';
                return;
            }
            if (this.playgroundOptions && ctx.request.method === 'GET') {
                const accept = accepts_1.default(ctx.req);
                const types = accept.types();
                const prefersHTML = types.find((x) => x === 'text/html' || x === 'application/json') === 'text/html';
                if (prefersHTML) {
                    const playgroundRenderPageOptions = Object.assign({ endpoint: path, subscriptionEndpoint: this.subscriptionsPath }, this.playgroundOptions);
                    ctx.set('Content-Type', 'text/html');
                    const playground = graphql_playground_html_1.renderPlaygroundPage(playgroundRenderPageOptions);
                    ctx.body = playground;
                    return;
                }
            }
            return koaApollo_1.graphqlKoa(() => {
                return this.createGraphQLServerOptions(ctx);
            })(ctx, next);
        }));
        return koa_compose_1.default(middlewares);
    }
}
exports.ApolloServer = ApolloServer;
//# sourceMappingURL=ApolloServer.js.map