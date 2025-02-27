"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const utils_1 = require("../../utils");
function duplicateTypeNameMessage(typeName) {
    return `There can be only one type named "${typeName}".`;
}
exports.duplicateTypeNameMessage = duplicateTypeNameMessage;
function existedTypeNameMessage(typeName) {
    return `Type "${typeName}" already exists in the schema. It cannot also be defined in this type definition.`;
}
exports.existedTypeNameMessage = existedTypeNameMessage;
function UniqueTypeNamesWithFields(context) {
    const knownTypes = Object.create(null);
    const schema = context.getSchema();
    return {
        ObjectTypeDefinition: checkTypeName,
        InterfaceTypeDefinition: checkTypeName,
        InputObjectTypeDefinition: checkTypeName,
    };
    function checkTypeName(node) {
        const typeName = node.name.value;
        const typeFromSchema = schema && schema.getType(typeName);
        const typeNodeFromSchema = typeFromSchema &&
            typeFromSchema.astNode;
        const typeNodeFromDefs = knownTypes[typeName];
        const duplicateTypeNode = typeNodeFromSchema || typeNodeFromDefs;
        if (duplicateTypeNode) {
            const possibleErrors = [];
            const { kind, fields } = utils_1.diffTypeNodes(node, duplicateTypeNode);
            const fieldsDiff = Object.entries(fields);
            const typesHaveSameShape = fieldsDiff.length === 0 ||
                fieldsDiff.every(([fieldName, types]) => {
                    if (types.length === 2) {
                        possibleErrors.push(utils_1.errorWithCode('VALUE_TYPE_FIELD_TYPE_MISMATCH', `${utils_1.logServiceAndType(duplicateTypeNode.serviceName, typeName, fieldName)}A field was defined differently in different services. \`${duplicateTypeNode.serviceName}\` and \`${node.serviceName}\` define \`${typeName}.${fieldName}\` as a ${types[1]} and ${types[0]} respectively. In order to define \`${typeName}\` in multiple places, the fields and their types must be identical.`, [node, duplicateTypeNode]));
                        return true;
                    }
                    return false;
                });
            if (typesHaveSameShape) {
                possibleErrors.forEach(error => context.reportError(error));
                if (kind.length > 0) {
                    context.reportError(utils_1.errorWithCode('VALUE_TYPE_KIND_MISMATCH', `${utils_1.logServiceAndType(duplicateTypeNode.serviceName, typeName)}Found kind mismatch on expected value type belonging to services \`${duplicateTypeNode.serviceName}\` and \`${node.serviceName}\`. \`${typeName}\` is defined as both a \`${kind[0]}\` and a \`${kind[1]}\`. In order to define \`${typeName}\` in multiple places, the kinds must be identical.`, [node, duplicateTypeNode]));
                }
                if (utils_1.isTypeNodeAnEntity(node) || utils_1.isTypeNodeAnEntity(duplicateTypeNode)) {
                    const entityNode = utils_1.isTypeNodeAnEntity(duplicateTypeNode)
                        ? duplicateTypeNode
                        : node;
                    context.reportError(utils_1.errorWithCode('VALUE_TYPE_NO_ENTITY', `${utils_1.logServiceAndType(entityNode.serviceName, typeName)}Value types cannot be entities (using the \`@key\` directive). Please ensure that the \`${typeName}\` type is extended properly or remove the \`@key\` directive if this is not an entity.`, [node, duplicateTypeNode]));
                }
                return false;
            }
        }
        if (typeFromSchema) {
            context.reportError(new graphql_1.GraphQLError(existedTypeNameMessage(typeName), node.name));
            return;
        }
        if (knownTypes[typeName]) {
            context.reportError(new graphql_1.GraphQLError(duplicateTypeNameMessage(typeName), [
                knownTypes[typeName],
                node.name,
            ]));
        }
        else {
            knownTypes[typeName] = node;
        }
        return false;
    }
}
exports.UniqueTypeNamesWithFields = UniqueTypeNamesWithFields;
//# sourceMappingURL=uniqueTypeNamesWithFields.js.map