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
const graphql_playground_html_1 = require("@apollographql/graphql-playground-html");
const apollo_server_core_1 = require("apollo-server-core");
const fastifyApollo_1 = require("./fastifyApollo");
const kMultipart = Symbol('multipart');
const fastJson = require('fast-json-stringify');
const stringifyHealthCheck = fastJson({
    type: 'object',
    properties: {
        status: {
            type: 'string',
        },
    },
});
const fileUploadMiddleware = (uploadsConfig, server) => (req, reply, done) => {
    if (req.req[kMultipart] &&
        typeof apollo_server_core_1.processFileUploads === 'function') {
        apollo_server_core_1.processFileUploads(req.req, reply.res, uploadsConfig)
            .then((body) => {
            req.body = body;
            done(null);
        })
            .catch((error) => {
            if (error.status && error.expose)
                reply.status(error.status);
            throw apollo_server_core_1.formatApolloErrors([error], {
                formatter: server.requestOptions.formatError,
                debug: server.requestOptions.debug,
            });
        });
    }
    else {
        done(null);
    }
};
class ApolloServer extends apollo_server_core_1.ApolloServerBase {
    supportsSubscriptions() {
        return true;
    }
    supportsUploads() {
        return true;
    }
    createHandler({ path, cors, disableHealthCheck, onHealthCheck, } = {}) {
        this.graphqlPath = path ? path : '/graphql';
        const promiseWillStart = this.willStart();
        return (app) => __awaiter(this, void 0, void 0, function* () {
            yield promiseWillStart;
            if (!disableHealthCheck) {
                app.get('/.well-known/apollo/server-health', (req, res) => __awaiter(this, void 0, void 0, function* () {
                    res.type('application/health+json');
                    if (onHealthCheck) {
                        try {
                            yield onHealthCheck(req);
                            res.send(stringifyHealthCheck({ status: 'pass' }));
                        }
                        catch (e) {
                            res.status(503).send(stringifyHealthCheck({ status: 'fail' }));
                        }
                    }
                    else {
                        res.send(stringifyHealthCheck({ status: 'pass' }));
                    }
                }));
            }
            app.register((instance) => __awaiter(this, void 0, void 0, function* () {
                instance.register(require('fastify-accepts'));
                if (cors === true) {
                    instance.register(require('fastify-cors'));
                }
                else if (cors !== false) {
                    instance.register(require('fastify-cors'), cors);
                }
                instance.setNotFoundHandler((_request, reply) => {
                    reply.code(405);
                    reply.header('allow', 'GET, POST');
                    reply.send();
                });
                const beforeHandlers = [
                    (req, reply, done) => {
                        if (this.playgroundOptions && req.req.method === 'GET') {
                            const accept = req.accepts();
                            const types = accept.types();
                            const prefersHTML = types.find((x) => x === 'text/html' || x === 'application/json') === 'text/html';
                            if (prefersHTML) {
                                const playgroundRenderPageOptions = Object.assign({ endpoint: this.graphqlPath, subscriptionEndpoint: this.subscriptionsPath }, this.playgroundOptions);
                                reply.type('text/html');
                                const playground = graphql_playground_html_1.renderPlaygroundPage(playgroundRenderPageOptions);
                                reply.send(playground);
                                return;
                            }
                        }
                        done();
                    },
                ];
                if (typeof apollo_server_core_1.processFileUploads === 'function' && this.uploadsConfig) {
                    instance.addContentTypeParser('multipart', (request, done) => {
                        request[kMultipart] = true;
                        done(null);
                    });
                    beforeHandlers.push(fileUploadMiddleware(this.uploadsConfig, this));
                }
                instance.route({
                    method: ['GET', 'POST'],
                    url: '/',
                    beforeHandler: beforeHandlers,
                    handler: yield fastifyApollo_1.graphqlFastify(this.graphQLServerOptions.bind(this)),
                });
            }), {
                prefix: this.graphqlPath,
            });
        });
    }
}
exports.ApolloServer = ApolloServer;
//# sourceMappingURL=ApolloServer.js.map