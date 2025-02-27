"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("apollo-server-env");
const graphql_1 = require("graphql");
const directives_1 = __importDefault(require("../directives"));
function isStringValueNode(node) {
    return node.kind === graphql_1.Kind.STRING;
}
exports.isStringValueNode = isStringValueNode;
function mapFieldNamesToServiceName(fields, serviceName) {
    return fields.reduce((prev, next) => {
        prev[next.name.value] = serviceName;
        return prev;
    }, Object.create(null));
}
exports.mapFieldNamesToServiceName = mapFieldNamesToServiceName;
function findDirectivesOnTypeOrField(node, directiveName) {
    return node && node.directives
        ? node.directives.filter(directive => directive.name.value === directiveName)
        : [];
}
exports.findDirectivesOnTypeOrField = findDirectivesOnTypeOrField;
function stripExternalFieldsFromTypeDefs(typeDefs, serviceName) {
    const strippedFields = [];
    const typeDefsWithoutExternalFields = graphql_1.visit(typeDefs, {
        ObjectTypeExtension: removeExternalFieldsFromExtensionVisitor(strippedFields, serviceName),
        InterfaceTypeExtension: removeExternalFieldsFromExtensionVisitor(strippedFields, serviceName),
    });
    return { typeDefsWithoutExternalFields, strippedFields };
}
exports.stripExternalFieldsFromTypeDefs = stripExternalFieldsFromTypeDefs;
function removeExternalFieldsFromExtensionVisitor(collector, serviceName) {
    return (node) => {
        let fields = node.fields;
        if (fields) {
            fields = fields.filter(field => {
                const externalDirectives = findDirectivesOnTypeOrField(field, 'external');
                if (externalDirectives.length > 0) {
                    collector.push({
                        field,
                        parentTypeName: node.name.value,
                        serviceName,
                    });
                    return false;
                }
                return true;
            });
        }
        return Object.assign(Object.assign({}, node), { fields });
    };
}
function parseSelections(source) {
    return graphql_1.parse(`query { ${source} }`)
        .definitions[0].selectionSet.selections;
}
exports.parseSelections = parseSelections;
function hasMatchingFieldInDirectives({ directives, fieldNameToMatch, namedType, }) {
    return Boolean(namedType.astNode &&
        directives
            .map(keyDirective => keyDirective.arguments &&
            isStringValueNode(keyDirective.arguments[0].value)
            ? {
                typeName: namedType.astNode.name.value,
                keyArgument: keyDirective.arguments[0].value.value,
            }
            : null)
            .filter(isNotNullOrUndefined)
            .flatMap(selection => parseSelections(selection.keyArgument))
            .some(field => field.kind === graphql_1.Kind.FIELD && field.name.value === fieldNameToMatch));
}
exports.hasMatchingFieldInDirectives = hasMatchingFieldInDirectives;
exports.logServiceAndType = (serviceName, typeName, fieldName) => `[${serviceName}] ${typeName}${fieldName ? `.${fieldName} -> ` : ' -> '}`;
function logDirective(directiveName) {
    return `[@${directiveName}] -> `;
}
exports.logDirective = logDirective;
function errorWithCode(code, message, nodes) {
    return new graphql_1.GraphQLError(message, nodes, undefined, undefined, undefined, undefined, {
        code,
    });
}
exports.errorWithCode = errorWithCode;
function findTypesContainingFieldWithReturnType(schema, node) {
    const returnType = graphql_1.getNamedType(node.type);
    if (!graphql_1.isObjectType(returnType))
        return [];
    const containingTypes = [];
    const types = schema.getTypeMap();
    for (const selectionSetType of Object.values(types)) {
        if (!graphql_1.isObjectType(selectionSetType))
            continue;
        const allFields = selectionSetType.getFields();
        Object.values(allFields).forEach(field => {
            const fieldReturnType = graphql_1.getNamedType(field.type);
            if (fieldReturnType === returnType) {
                containingTypes.push(fieldReturnType);
            }
        });
    }
    return containingTypes;
}
exports.findTypesContainingFieldWithReturnType = findTypesContainingFieldWithReturnType;
function findFieldsThatReturnType({ schema, typeToFind, }) {
    if (!graphql_1.isObjectType(typeToFind))
        return [];
    const fieldsThatReturnType = [];
    const types = schema.getTypeMap();
    for (const selectionSetType of Object.values(types)) {
        if (!graphql_1.isObjectType(selectionSetType))
            continue;
        const fieldsOnNamedType = selectionSetType.getFields();
        Object.values(fieldsOnNamedType).forEach(field => {
            const fieldReturnType = graphql_1.getNamedType(field.type);
            if (fieldReturnType === typeToFind) {
                fieldsThatReturnType.push(field);
            }
        });
    }
    return fieldsThatReturnType;
}
exports.findFieldsThatReturnType = findFieldsThatReturnType;
function selectionIncludesField({ selections, selectionSetType, typeToFind, fieldToFind, }) {
    for (const selection of selections) {
        const selectionName = selection.name.value;
        if (selectionName === fieldToFind &&
            graphql_1.isEqualType(selectionSetType, typeToFind))
            return true;
        const typeIncludesField = selectionName &&
            Object.keys(selectionSetType.getFields()).includes(selectionName);
        if (!selectionName || !typeIncludesField)
            continue;
        const returnType = graphql_1.getNamedType(selectionSetType.getFields()[selectionName].type);
        if (!returnType || !graphql_1.isObjectType(returnType))
            continue;
        const subselections = selection.selectionSet && selection.selectionSet.selections;
        if (subselections) {
            const selectionDoesIncludeField = selectionIncludesField({
                selectionSetType: returnType,
                selections: subselections,
                typeToFind,
                fieldToFind,
            });
            if (selectionDoesIncludeField)
                return true;
        }
    }
    return false;
}
exports.selectionIncludesField = selectionIncludesField;
function isTypeNodeAnEntity(node) {
    let isEntity = false;
    graphql_1.visit(node, {
        Directive(directive) {
            if (directive.name.value === 'key') {
                isEntity = true;
                return graphql_1.BREAK;
            }
        },
    });
    return isEntity;
}
exports.isTypeNodeAnEntity = isTypeNodeAnEntity;
function diffTypeNodes(firstNode, secondNode) {
    const fieldsDiff = Object.create(null);
    const unionTypesDiff = Object.create(null);
    const locationsDiff = new Set();
    const argumentsDiff = Object.create(null);
    const document = {
        kind: graphql_1.Kind.DOCUMENT,
        definitions: [firstNode, secondNode],
    };
    function fieldVisitor(node) {
        const fieldName = node.name.value;
        const type = graphql_1.print(node.type);
        if (!fieldsDiff[fieldName]) {
            fieldsDiff[fieldName] = [type];
            return;
        }
        const fieldTypes = fieldsDiff[fieldName];
        if (fieldTypes[0] === type) {
            delete fieldsDiff[fieldName];
        }
        else {
            fieldTypes.push(type);
        }
    }
    graphql_1.visit(document, {
        FieldDefinition: fieldVisitor,
        InputValueDefinition: fieldVisitor,
        UnionTypeDefinition(node) {
            if (!node.types)
                return graphql_1.BREAK;
            for (const namedTypeNode of node.types) {
                const name = namedTypeNode.name.value;
                if (unionTypesDiff[name]) {
                    delete unionTypesDiff[name];
                }
                else {
                    unionTypesDiff[name] = true;
                }
            }
        },
        DirectiveDefinition(node) {
            node.locations.forEach(location => {
                const locationName = location.value;
                if (locationsDiff.has(locationName)) {
                    locationsDiff.delete(locationName);
                }
                else {
                    locationsDiff.add(locationName);
                }
            });
            if (!node.arguments)
                return;
            node.arguments.forEach(argument => {
                const argumentName = argument.name.value;
                const printedType = graphql_1.print(argument.type);
                if (argumentsDiff[argumentName]) {
                    if (printedType === argumentsDiff[argumentName][0]) {
                        delete argumentsDiff[argumentName];
                    }
                    else {
                        argumentsDiff[argumentName].push(printedType);
                    }
                }
                else {
                    argumentsDiff[argumentName] = [printedType];
                }
            });
        },
    });
    const typeNameDiff = firstNode.name.value === secondNode.name.value
        ? []
        : [firstNode.name.value, secondNode.name.value];
    const kindDiff = firstNode.kind === secondNode.kind ? [] : [firstNode.kind, secondNode.kind];
    return {
        name: typeNameDiff,
        kind: kindDiff,
        fields: fieldsDiff,
        unionTypes: unionTypesDiff,
        locations: Array.from(locationsDiff),
        args: argumentsDiff,
    };
}
exports.diffTypeNodes = diffTypeNodes;
function typeNodesAreEquivalent(firstNode, secondNode) {
    const { name, kind, fields, unionTypes, locations, args } = diffTypeNodes(firstNode, secondNode);
    return (name.length === 0 &&
        kind.length === 0 &&
        Object.keys(fields).length === 0 &&
        Object.keys(unionTypes).length === 0 &&
        locations.length === 0 &&
        Object.keys(args).length === 0);
}
exports.typeNodesAreEquivalent = typeNodesAreEquivalent;
exports.defKindToExtKind = {
    [graphql_1.Kind.SCALAR_TYPE_DEFINITION]: graphql_1.Kind.SCALAR_TYPE_EXTENSION,
    [graphql_1.Kind.OBJECT_TYPE_DEFINITION]: graphql_1.Kind.OBJECT_TYPE_EXTENSION,
    [graphql_1.Kind.INTERFACE_TYPE_DEFINITION]: graphql_1.Kind.INTERFACE_TYPE_EXTENSION,
    [graphql_1.Kind.UNION_TYPE_DEFINITION]: graphql_1.Kind.UNION_TYPE_EXTENSION,
    [graphql_1.Kind.ENUM_TYPE_DEFINITION]: graphql_1.Kind.ENUM_TYPE_EXTENSION,
    [graphql_1.Kind.INPUT_OBJECT_TYPE_DEFINITION]: graphql_1.Kind.INPUT_OBJECT_TYPE_EXTENSION,
};
function mapValues(object, callback) {
    const result = Object.create(null);
    for (const [key, value] of Object.entries(object)) {
        result[key] = callback(value);
    }
    return result;
}
exports.mapValues = mapValues;
function isNotNullOrUndefined(value) {
    return value !== null && typeof value !== 'undefined';
}
exports.isNotNullOrUndefined = isNotNullOrUndefined;
exports.executableDirectiveLocations = [
    'QUERY',
    'MUTATION',
    'SUBSCRIPTION',
    'FIELD',
    'FRAGMENT_DEFINITION',
    'FRAGMENT_SPREAD',
    'INLINE_FRAGMENT',
    'VARIABLE_DEFINITION',
];
function isFederationDirective(directive) {
    return directives_1.default.some(({ name }) => name === directive.name);
}
exports.isFederationDirective = isFederationDirective;
//# sourceMappingURL=utils.js.map