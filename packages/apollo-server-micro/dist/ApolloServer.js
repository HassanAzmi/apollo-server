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
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_core_1 = require("apollo-server-core");
const micro_1 = require("micro");
const graphql_playground_html_1 = require("@apollographql/graphql-playground-html");
const accept_1 = require("accept");
const microApollo_1 = require("./microApollo");
class ApolloServer extends apollo_server_core_1.ApolloServerBase {
    createGraphQLServerOptions(req, res) {
        const _super = Object.create(null, {
            graphQLServerOptions: { get: () => super.graphQLServerOptions }
        });
        return __awaiter(this, void 0, void 0, function* () {
            return _super.graphQLServerOptions.call(this, { req, res });
        });
    }
    createHandler({ path, disableHealthCheck, onHealthCheck, } = {}) {
        const promiseWillStart = this.willStart();
        return (req, res) => __awaiter(this, void 0, void 0, function* () {
            this.graphqlPath = path || '/graphql';
            yield promiseWillStart;
            if (typeof apollo_server_core_1.processFileUploads === 'function') {
                yield this.handleFileUploads(req, res);
            }
            (yield this.handleHealthCheck({
                req,
                res,
                disableHealthCheck,
                onHealthCheck,
            })) ||
                this.handleGraphqlRequestsWithPlayground({ req, res }) ||
                (yield this.handleGraphqlRequestsWithServer({ req, res })) ||
                micro_1.send(res, 404, null);
        });
    }
    supportsUploads() {
        return true;
    }
    supportsSubscriptions() {
        return true;
    }
    handleHealthCheck({ req, res, disableHealthCheck, onHealthCheck, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let handled = false;
            if (!disableHealthCheck &&
                req.url === '/.well-known/apollo/server-health') {
                res.setHeader('Content-Type', 'application/health+json');
                if (onHealthCheck) {
                    try {
                        yield onHealthCheck(req);
                    }
                    catch (error) {
                        micro_1.send(res, 503, { status: 'fail' });
                        handled = true;
                    }
                }
                if (!handled) {
                    micro_1.send(res, 200, { status: 'pass' });
                    handled = true;
                }
            }
            return handled;
        });
    }
    handleGraphqlRequestsWithPlayground({ req, res, }) {
        let handled = false;
        if (this.playgroundOptions && req.method === 'GET') {
            const accept = accept_1.parseAll(req.headers);
            const types = accept.mediaTypes;
            const prefersHTML = types.find((x) => x === 'text/html' || x === 'application/json') === 'text/html';
            if (prefersHTML) {
                const middlewareOptions = Object.assign({ endpoint: this.graphqlPath, subscriptionEndpoint: this.subscriptionsPath }, this.playgroundOptions);
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                micro_1.send(res, 200, graphql_playground_html_1.renderPlaygroundPage(middlewareOptions));
                handled = true;
            }
        }
        return handled;
    }
    handleGraphqlRequestsWithServer({ req, res, }) {
        return __awaiter(this, void 0, void 0, function* () {
            let handled = false;
            const url = req.url.split('?')[0];
            if (url === this.graphqlPath) {
                const graphqlHandler = microApollo_1.graphqlMicro(() => {
                    return this.createGraphQLServerOptions(req, res);
                });
                const responseData = yield graphqlHandler(req, res);
                micro_1.send(res, 200, responseData);
                handled = true;
            }
            return handled;
        });
    }
    handleFileUploads(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof apollo_server_core_1.processFileUploads !== 'function') {
                return;
            }
            const contentType = req.headers['content-type'];
            if (this.uploadsConfig &&
                contentType &&
                contentType.startsWith('multipart/form-data')) {
                req.filePayload = yield apollo_server_core_1.processFileUploads(req, res, this.uploadsConfig);
            }
        });
    }
}
exports.ApolloServer = ApolloServer;
//# sourceMappingURL=ApolloServer.js.map