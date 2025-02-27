"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_server_core_1 = require("apollo-server-core");
function graphqlKoa(options) {
    if (!options) {
        throw new Error('Apollo Server requires options.');
    }
    if (arguments.length > 1) {
        throw new Error(`Apollo Server expects exactly one argument, got ${arguments.length}`);
    }
    const graphqlHandler = (ctx) => {
        return apollo_server_core_1.runHttpQuery([ctx], {
            method: ctx.request.method,
            options: options,
            query: ctx.request.method === 'POST'
                ?
                    ctx.request.body || ctx.req.body
                : ctx.request.query,
            request: apollo_server_core_1.convertNodeHttpToRequest(ctx.req),
        }).then(({ graphqlResponse, responseInit }) => {
            Object.keys(responseInit.headers).forEach(key => ctx.set(key, responseInit.headers[key]));
            ctx.body = graphqlResponse;
        }, (error) => {
            if ('HttpQueryError' !== error.name) {
                throw error;
            }
            if (error.headers) {
                Object.keys(error.headers).forEach(header => {
                    ctx.set(header, error.headers[header]);
                });
            }
            ctx.status = error.statusCode;
            ctx.body = error.message;
        });
    };
    return graphqlHandler;
}
exports.graphqlKoa = graphqlKoa;
//# sourceMappingURL=koaApollo.js.map