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
const apollo_server_env_1 = require("apollo-server-env");
exports.Request = apollo_server_env_1.Request;
const apollo_datasource_1 = require("apollo-datasource");
const HTTPCache_1 = require("./HTTPCache");
const apollo_server_errors_1 = require("apollo-server-errors");
class RESTDataSource extends apollo_datasource_1.DataSource {
    constructor(httpFetch) {
        super();
        this.httpFetch = httpFetch;
        this.memoizedResults = new Map();
    }
    initialize(config) {
        this.context = config.context;
        this.httpCache = new HTTPCache_1.HTTPCache(config.cache, this.httpFetch);
    }
    cacheKeyFor(request) {
        return request.url;
    }
    resolveURL(request) {
        let path = request.path;
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        const baseURL = this.baseURL;
        if (baseURL) {
            const normalizedBaseURL = baseURL.endsWith('/')
                ? baseURL
                : baseURL.concat('/');
            return new apollo_server_env_1.URL(path, normalizedBaseURL);
        }
        else {
            return new apollo_server_env_1.URL(path);
        }
    }
    didReceiveResponse(response, _request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (response.ok) {
                return this.parseBody(response);
            }
            else {
                throw yield this.errorFromResponse(response);
            }
        });
    }
    didEncounterError(error, _request) {
        throw error;
    }
    parseBody(response) {
        const contentType = response.headers.get('Content-Type');
        const contentLength = response.headers.get('Content-Length');
        if (response.status !== 204 &&
            contentLength !== '0' &&
            contentType &&
            (contentType.startsWith('application/json') ||
                contentType.startsWith('application/hal+json'))) {
            return response.json();
        }
        else {
            return response.text();
        }
    }
    errorFromResponse(response) {
        return __awaiter(this, void 0, void 0, function* () {
            const message = `${response.status}: ${response.statusText}`;
            let error;
            if (response.status === 401) {
                error = new apollo_server_errors_1.AuthenticationError(message);
            }
            else if (response.status === 403) {
                error = new apollo_server_errors_1.ForbiddenError(message);
            }
            else {
                error = new apollo_server_errors_1.ApolloError(message);
            }
            const body = yield this.parseBody(response);
            Object.assign(error.extensions, {
                response: {
                    url: response.url,
                    status: response.status,
                    statusText: response.statusText,
                    body,
                },
            });
            return error;
        });
    }
    get(path, params, init) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fetch(Object.assign({ method: 'GET', path, params }, init));
        });
    }
    post(path, body, init) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fetch(Object.assign({ method: 'POST', path, body }, init));
        });
    }
    patch(path, body, init) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fetch(Object.assign({ method: 'PATCH', path, body }, init));
        });
    }
    put(path, body, init) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fetch(Object.assign({ method: 'PUT', path, body }, init));
        });
    }
    delete(path, params, init) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fetch(Object.assign({ method: 'DELETE', path, params }, init));
        });
    }
    fetch(init) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(init.params instanceof apollo_server_env_1.URLSearchParams)) {
                init.params = new apollo_server_env_1.URLSearchParams(init.params);
            }
            if (!(init.headers && init.headers instanceof apollo_server_env_1.Headers)) {
                init.headers = new apollo_server_env_1.Headers(init.headers || Object.create(null));
            }
            const options = init;
            if (this.willSendRequest) {
                yield this.willSendRequest(options);
            }
            const url = yield this.resolveURL(options);
            for (const [name, value] of options.params) {
                url.searchParams.append(name, value);
            }
            if (options.body !== undefined &&
                options.body !== null &&
                (options.body.constructor === Object ||
                    Array.isArray(options.body) ||
                    (options.body.toJSON &&
                        typeof options.body.toJSON === 'function'))) {
                options.body = JSON.stringify(options.body);
                if (!options.headers.get('Content-Type')) {
                    options.headers.set('Content-Type', 'application/json');
                }
            }
            const request = new apollo_server_env_1.Request(String(url), options);
            const cacheKey = this.cacheKeyFor(request);
            const performRequest = () => __awaiter(this, void 0, void 0, function* () {
                return this.trace(`${options.method || 'GET'} ${url}`, () => __awaiter(this, void 0, void 0, function* () {
                    const cacheOptions = options.cacheOptions
                        ? options.cacheOptions
                        : this.cacheOptionsFor && this.cacheOptionsFor.bind(this);
                    try {
                        const response = yield this.httpCache.fetch(request, {
                            cacheKey,
                            cacheOptions,
                        });
                        return yield this.didReceiveResponse(response, request);
                    }
                    catch (error) {
                        this.didEncounterError(error, request);
                    }
                }));
            });
            if (request.method === 'GET') {
                let promise = this.memoizedResults.get(cacheKey);
                if (promise)
                    return promise;
                promise = performRequest();
                this.memoizedResults.set(cacheKey, promise);
                return promise;
            }
            else {
                this.memoizedResults.delete(cacheKey);
                return performRequest();
            }
        });
    }
    trace(label, fn) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process && process.env && process.env.NODE_ENV === 'development') {
                const startTime = Date.now();
                try {
                    return yield fn();
                }
                finally {
                    const duration = Date.now() - startTime;
                    console.log(`${label} (${duration}ms)`);
                }
            }
            else {
                return fn();
            }
        });
    }
}
exports.RESTDataSource = RESTDataSource;
//# sourceMappingURL=RESTDataSource.js.map