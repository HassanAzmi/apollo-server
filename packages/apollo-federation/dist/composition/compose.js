"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("apollo-server-env");
const graphql_1 = require("graphql");
const apollo_graphql_1 = require("apollo-graphql");
const directives_1 = __importDefault(require("../directives"));
const utils_1 = require("./utils");
const validate_1 = require("graphql/validation/validate");
const rules_1 = require("./rules");
const EmptyQueryDefinition = {
    kind: graphql_1.Kind.OBJECT_TYPE_DEFINITION,
    name: { kind: graphql_1.Kind.NAME, value: 'Query' },
    fields: [],
    serviceName: null,
};
const EmptyMutationDefinition = {
    kind: graphql_1.Kind.OBJECT_TYPE_DEFINITION,
    name: { kind: graphql_1.Kind.NAME, value: 'Mutation' },
    fields: [],
    serviceName: null,
};
const EmptySubscriptionDefinition = {
    kind: graphql_1.Kind.OBJECT_TYPE_DEFINITION,
    name: { kind: graphql_1.Kind.NAME, value: 'Subscription' },
    fields: [],
    serviceName: null,
};
function buildMapsFromServiceList(serviceList) {
    const typeDefinitionsMap = Object.create(null);
    const typeExtensionsMap = Object.create(null);
    const directiveDefinitionsMap = Object.create(null);
    const typeToServiceMap = Object.create(null);
    const externalFields = [];
    const keyDirectivesMap = Object.create(null);
    const valueTypes = new Set();
    for (const { typeDefs, name: serviceName } of serviceList) {
        const { typeDefsWithoutExternalFields, strippedFields, } = utils_1.stripExternalFieldsFromTypeDefs(typeDefs, serviceName);
        externalFields.push(...strippedFields);
        for (let definition of typeDefsWithoutExternalFields.definitions) {
            if (definition.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION ||
                definition.kind === graphql_1.Kind.OBJECT_TYPE_EXTENSION) {
                const typeName = definition.name.value;
                for (const keyDirective of utils_1.findDirectivesOnTypeOrField(definition, 'key')) {
                    if (keyDirective.arguments &&
                        utils_1.isStringValueNode(keyDirective.arguments[0].value)) {
                        keyDirectivesMap[typeName] = keyDirectivesMap[typeName] || {};
                        keyDirectivesMap[typeName][serviceName] =
                            keyDirectivesMap[typeName][serviceName] || [];
                        keyDirectivesMap[typeName][serviceName].push(utils_1.parseSelections(keyDirective.arguments[0].value.value));
                    }
                }
            }
            if (graphql_1.isTypeDefinitionNode(definition)) {
                const typeName = definition.name.value;
                if (!typeToServiceMap[typeName]) {
                    typeToServiceMap[typeName] = {
                        extensionFieldsToOwningServiceMap: Object.create(null),
                    };
                }
                typeToServiceMap[typeName].owningService = serviceName;
                if (typeDefinitionsMap[typeName]) {
                    const isValueType = utils_1.typeNodesAreEquivalent(typeDefinitionsMap[typeName][typeDefinitionsMap[typeName].length - 1], definition);
                    if (isValueType) {
                        valueTypes.add(typeName);
                    }
                    typeDefinitionsMap[typeName].push(Object.assign(Object.assign({}, definition), { serviceName }));
                }
                else {
                    typeDefinitionsMap[typeName] = [Object.assign(Object.assign({}, definition), { serviceName })];
                }
            }
            else if (graphql_1.isTypeExtensionNode(definition)) {
                const typeName = definition.name.value;
                if (definition.kind === graphql_1.Kind.OBJECT_TYPE_EXTENSION ||
                    definition.kind === graphql_1.Kind.INPUT_OBJECT_TYPE_EXTENSION) {
                    if (!definition.fields)
                        break;
                    const fields = utils_1.mapFieldNamesToServiceName(definition.fields, serviceName);
                    if (typeToServiceMap[typeName]) {
                        typeToServiceMap[typeName].extensionFieldsToOwningServiceMap = Object.assign(Object.assign({}, typeToServiceMap[typeName].extensionFieldsToOwningServiceMap), fields);
                    }
                    else {
                        typeToServiceMap[typeName] = {
                            extensionFieldsToOwningServiceMap: fields,
                        };
                    }
                }
                if (definition.kind === graphql_1.Kind.ENUM_TYPE_EXTENSION) {
                    if (!definition.values)
                        break;
                    const values = utils_1.mapFieldNamesToServiceName(definition.values, serviceName);
                    if (typeToServiceMap[typeName]) {
                        typeToServiceMap[typeName].extensionFieldsToOwningServiceMap = Object.assign(Object.assign({}, typeToServiceMap[typeName].extensionFieldsToOwningServiceMap), values);
                    }
                    else {
                        typeToServiceMap[typeName] = {
                            extensionFieldsToOwningServiceMap: values,
                        };
                    }
                }
                if (typeExtensionsMap[typeName]) {
                    typeExtensionsMap[typeName].push(Object.assign(Object.assign({}, definition), { serviceName }));
                }
                else {
                    typeExtensionsMap[typeName] = [Object.assign(Object.assign({}, definition), { serviceName })];
                }
            }
            else if (definition.kind === graphql_1.Kind.DIRECTIVE_DEFINITION) {
                const directiveName = definition.name.value;
                const executableLocations = definition.locations.filter(location => utils_1.executableDirectiveLocations.includes(location.value));
                if (executableLocations.length === 0)
                    continue;
                const definitionWithExecutableLocations = Object.assign(Object.assign({}, definition), { locations: executableLocations });
                if (directiveDefinitionsMap[directiveName]) {
                    directiveDefinitionsMap[directiveName][serviceName] = definitionWithExecutableLocations;
                }
                else {
                    directiveDefinitionsMap[directiveName] = {
                        [serviceName]: definitionWithExecutableLocations,
                    };
                }
            }
        }
    }
    if (!typeDefinitionsMap.Query)
        typeDefinitionsMap.Query = [EmptyQueryDefinition];
    if (typeExtensionsMap.Mutation && !typeDefinitionsMap.Mutation)
        typeDefinitionsMap.Mutation = [EmptyMutationDefinition];
    if (typeExtensionsMap.Subscription && !typeDefinitionsMap.Subscription)
        typeDefinitionsMap.Subscription = [EmptySubscriptionDefinition];
    return {
        typeToServiceMap,
        typeDefinitionsMap,
        typeExtensionsMap,
        directiveDefinitionsMap,
        externalFields,
        keyDirectivesMap,
        valueTypes,
    };
}
exports.buildMapsFromServiceList = buildMapsFromServiceList;
function buildSchemaFromDefinitionsAndExtensions({ typeDefinitionsMap, typeExtensionsMap, directiveDefinitionsMap, }) {
    let errors = undefined;
    let schema = new graphql_1.GraphQLSchema({
        query: undefined,
        directives: [...graphql_1.specifiedDirectives, ...directives_1.default],
    });
    const definitionsDocument = {
        kind: graphql_1.Kind.DOCUMENT,
        definitions: [
            ...Object.values(typeDefinitionsMap).flat(),
            ...Object.values(directiveDefinitionsMap).map(definitions => Object.values(definitions)[0]),
        ],
    };
    errors = validate_1.validateSDL(definitionsDocument, schema, rules_1.compositionRules);
    schema = graphql_1.extendSchema(schema, definitionsDocument, { assumeValidSDL: true });
    const extensionsDocument = {
        kind: graphql_1.Kind.DOCUMENT,
        definitions: Object.values(typeExtensionsMap).flat(),
    };
    errors.push(...validate_1.validateSDL(extensionsDocument, schema, rules_1.compositionRules));
    schema = graphql_1.extendSchema(schema, extensionsDocument, { assumeValidSDL: true });
    schema = new graphql_1.GraphQLSchema(Object.assign(Object.assign({}, schema.toConfig()), { directives: [
            ...schema.getDirectives().filter(x => !utils_1.isFederationDirective(x)),
        ] }));
    return { schema, errors };
}
exports.buildSchemaFromDefinitionsAndExtensions = buildSchemaFromDefinitionsAndExtensions;
function addFederationMetadataToSchemaNodes({ schema, typeToServiceMap, externalFields, keyDirectivesMap, valueTypes, directiveDefinitionsMap, }) {
    for (const [typeName, { owningService, extensionFieldsToOwningServiceMap },] of Object.entries(typeToServiceMap)) {
        const namedType = schema.getType(typeName);
        if (!namedType)
            continue;
        const isValueType = valueTypes.has(typeName);
        const serviceName = isValueType ? null : owningService;
        namedType.federation = Object.assign(Object.assign(Object.assign({}, namedType.federation), { serviceName,
            isValueType }), (keyDirectivesMap[typeName] && {
            keys: keyDirectivesMap[typeName],
        }));
        if (graphql_1.isObjectType(namedType)) {
            for (const field of Object.values(namedType.getFields())) {
                const [providesDirective] = utils_1.findDirectivesOnTypeOrField(field.astNode, 'provides');
                if (providesDirective &&
                    providesDirective.arguments &&
                    utils_1.isStringValueNode(providesDirective.arguments[0].value)) {
                    field.federation = Object.assign(Object.assign({}, field.federation), { serviceName, provides: utils_1.parseSelections(providesDirective.arguments[0].value.value), belongsToValueType: isValueType });
                }
            }
        }
        for (const [fieldName, extendingServiceName] of Object.entries(extensionFieldsToOwningServiceMap)) {
            if (graphql_1.isObjectType(namedType)) {
                const field = namedType.getFields()[fieldName];
                field.federation = Object.assign(Object.assign({}, field.federation), { serviceName: extendingServiceName });
                const [requiresDirective] = utils_1.findDirectivesOnTypeOrField(field.astNode, 'requires');
                if (requiresDirective &&
                    requiresDirective.arguments &&
                    utils_1.isStringValueNode(requiresDirective.arguments[0].value)) {
                    field.federation = Object.assign(Object.assign({}, field.federation), { requires: utils_1.parseSelections(requiresDirective.arguments[0].value.value) });
                }
            }
        }
    }
    for (const field of externalFields) {
        const namedType = schema.getType(field.parentTypeName);
        if (!namedType)
            continue;
        namedType.federation = Object.assign(Object.assign({}, namedType.federation), { externals: Object.assign(Object.assign({}, (namedType.federation && namedType.federation.externals)), { [field.serviceName]: [
                    ...(namedType.federation &&
                        namedType.federation.externals &&
                        namedType.federation.externals[field.serviceName]
                        ? namedType.federation.externals[field.serviceName]
                        : []),
                    field,
                ] }) });
    }
    for (const directiveName of Object.keys(directiveDefinitionsMap)) {
        const directive = schema.getDirective(directiveName);
        if (!directive)
            continue;
        directive.federation = Object.assign(Object.assign({}, directive.federation), { directiveDefinitions: directiveDefinitionsMap[directiveName] });
    }
}
exports.addFederationMetadataToSchemaNodes = addFederationMetadataToSchemaNodes;
function composeServices(services) {
    const { typeToServiceMap, typeDefinitionsMap, typeExtensionsMap, directiveDefinitionsMap, externalFields, keyDirectivesMap, valueTypes, } = buildMapsFromServiceList(services);
    let { schema, errors } = buildSchemaFromDefinitionsAndExtensions({
        typeDefinitionsMap,
        typeExtensionsMap,
        directiveDefinitionsMap,
    });
    const operationTypeMap = {
        query: 'Query',
        mutation: 'Mutation',
        subscription: 'Subscription',
    };
    schema = new graphql_1.GraphQLSchema(Object.assign(Object.assign({}, schema.toConfig()), utils_1.mapValues(operationTypeMap, typeName => typeName
        ? schema.getType(typeName)
        : undefined)));
    schema = apollo_graphql_1.transformSchema(schema, type => {
        if (graphql_1.isObjectType(type)) {
            const config = type.toConfig();
            return new graphql_1.GraphQLObjectType(Object.assign(Object.assign({}, config), { interfaces: Array.from(new Set(config.interfaces)) }));
        }
        return undefined;
    });
    addFederationMetadataToSchemaNodes({
        schema,
        typeToServiceMap,
        externalFields,
        keyDirectivesMap,
        valueTypes,
        directiveDefinitionsMap,
    });
    return { schema, errors };
}
exports.composeServices = composeServices;
//# sourceMappingURL=compose.js.map