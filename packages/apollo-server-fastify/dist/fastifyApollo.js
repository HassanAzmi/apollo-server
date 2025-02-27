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
function graphqlFastify(options) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!options) {
            throw new Error('Apollo Server requires options.');
        }
        return (request, reply) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { graphqlResponse, responseInit } = yield apollo_server_core_1.runHttpQuery([request, reply], {
                    method: request.req.method,
                    options,
                    query: request.req.method === 'POST' ? request.body : request.query,
                    request: apollo_server_core_1.convertNodeHttpToRequest(request.raw),
                });
                if (responseInit.headers) {
                    for (const [name, value] of Object.entries(responseInit.headers)) {
                        reply.header(name, value);
                    }
                }
                reply.serializer((payload) => payload);
                reply.send(graphqlResponse);
            }
            catch (error) {
                if ('HttpQueryError' !== error.name) {
                    throw error;
                }
                if (error.headers) {
                    Object.keys(error.headers).forEach(header => {
                        reply.header(header, error.headers[header]);
                    });
                }
                reply.code(error.statusCode);
                reply.serializer((payload) => payload);
                reply.send(error.message);
            }
        });
    });
}
exports.graphqlFastify = graphqlFastify;
//# sourceMappingURL=fastifyApollo.js.map