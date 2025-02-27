"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const utils_1 = require("./utils");
function normalizeTypeDefs(typeDefs) {
    return defaultRootOperationTypes(replaceExtendedDefinitionsWithExtensions(typeDefs));
}
exports.normalizeTypeDefs = normalizeTypeDefs;
function defaultRootOperationTypes(typeDefs) {
    const defaultRootOperationNameLookup = {
        query: 'Query',
        mutation: 'Mutation',
        subscription: 'Subscription',
    };
    const defaultRootOperationNames = Object.values(defaultRootOperationNameLookup);
    let rootOperationTypeMap = Object.create(null);
    let hasSchemaDefinitionOrExtension = false;
    graphql_1.visit(typeDefs, {
        OperationTypeDefinition(node) {
            hasSchemaDefinitionOrExtension = true;
            rootOperationTypeMap[node.type.name.value] =
                defaultRootOperationNameLookup[node.operation];
        },
    });
    if (!hasSchemaDefinitionOrExtension) {
        rootOperationTypeMap = {
            Query: 'Query',
            Mutation: 'Mutation',
            Subscription: 'Subscription',
        };
    }
    let schemaWithoutConflictingDefaultDefinitions;
    if (!hasSchemaDefinitionOrExtension) {
        schemaWithoutConflictingDefaultDefinitions = typeDefs;
    }
    else {
        schemaWithoutConflictingDefaultDefinitions = graphql_1.visit(typeDefs, {
            ObjectTypeDefinition(node) {
                if (defaultRootOperationNames.includes(node.name.value) &&
                    !rootOperationTypeMap[node.name.value]) {
                    return null;
                }
                return;
            },
            ObjectTypeExtension(node) {
                if (defaultRootOperationNames.includes(node.name.value) &&
                    !rootOperationTypeMap[node.name.value]) {
                    return null;
                }
                return;
            },
            FieldDefinition(node) {
                if (node.type.kind === graphql_1.Kind.NAMED_TYPE &&
                    defaultRootOperationNames.includes(node.type.name.value)) {
                    return null;
                }
                if (node.type.kind === graphql_1.Kind.NON_NULL_TYPE &&
                    node.type.type.kind === graphql_1.Kind.NAMED_TYPE &&
                    defaultRootOperationNames.includes(node.type.type.name.value)) {
                    return null;
                }
                return;
            },
        });
    }
    const schemaWithDefaultRootTypes = graphql_1.visit(schemaWithoutConflictingDefaultDefinitions, {
        SchemaDefinition() {
            return null;
        },
        SchemaExtension() {
            return null;
        },
        ObjectTypeDefinition(node) {
            if (node.name.value in rootOperationTypeMap ||
                defaultRootOperationNames.includes(node.name.value)) {
                return Object.assign(Object.assign({}, node), { name: Object.assign(Object.assign({}, node.name), { value: rootOperationTypeMap[node.name.value] || node.name.value }), kind: graphql_1.Kind.OBJECT_TYPE_EXTENSION });
            }
            return;
        },
        ObjectTypeExtension(node) {
            if (node.name.value in rootOperationTypeMap ||
                defaultRootOperationNames.includes(node.name.value)) {
                return Object.assign(Object.assign({}, node), { name: Object.assign(Object.assign({}, node.name), { value: rootOperationTypeMap[node.name.value] || node.name.value }) });
            }
            return;
        },
        NamedType(node) {
            if (node.name.value in rootOperationTypeMap) {
                return Object.assign(Object.assign({}, node), { name: Object.assign(Object.assign({}, node.name), { value: rootOperationTypeMap[node.name.value] }) });
            }
            return;
        },
    });
    return schemaWithDefaultRootTypes;
}
exports.defaultRootOperationTypes = defaultRootOperationTypes;
function replaceExtendedDefinitionsWithExtensions(typeDefs) {
    const typeDefsWithExtendedTypesReplaced = graphql_1.visit(typeDefs, {
        ObjectTypeDefinition: visitor,
        InterfaceTypeDefinition: visitor,
    });
    function visitor(node) {
        const isExtensionDefinition = utils_1.findDirectivesOnTypeOrField(node, 'extends').length > 0;
        if (!isExtensionDefinition) {
            return node;
        }
        const filteredDirectives = node.directives &&
            node.directives.filter(directive => directive.name.value !== 'extends');
        return Object.assign(Object.assign(Object.assign({}, node), (filteredDirectives && { directives: filteredDirectives })), { kind: utils_1.defKindToExtKind[node.kind] });
    }
    return typeDefsWithExtendedTypesReplaced;
}
exports.replaceExtendedDefinitionsWithExtensions = replaceExtendedDefinitionsWithExtensions;
//# sourceMappingURL=normalize.js.map