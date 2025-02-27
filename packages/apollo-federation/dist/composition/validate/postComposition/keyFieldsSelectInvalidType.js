"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const utils_1 = require("../../utils");
exports.keyFieldsSelectInvalidType = ({ schema, }) => {
    const errors = [];
    const types = schema.getTypeMap();
    for (const [typeName, namedType] of Object.entries(types)) {
        if (!graphql_1.isObjectType(namedType))
            continue;
        if (namedType.federation && namedType.federation.keys) {
            const allFieldsInType = namedType.getFields();
            for (const [serviceName, selectionSets] of Object.entries(namedType.federation.keys)) {
                for (const selectionSet of selectionSets) {
                    for (const field of selectionSet) {
                        const name = field.name.value;
                        const matchingField = allFieldsInType[name];
                        if (!matchingField) {
                            errors.push(utils_1.errorWithCode('KEY_FIELDS_SELECT_INVALID_TYPE', utils_1.logServiceAndType(serviceName, typeName) +
                                `A @key selects ${name}, but ${typeName}.${name} could not be found`));
                        }
                        if (matchingField) {
                            if (graphql_1.isInterfaceType(matchingField.type) ||
                                (graphql_1.isNonNullType(matchingField.type) &&
                                    graphql_1.isInterfaceType(graphql_1.getNullableType(matchingField.type)))) {
                                errors.push(utils_1.errorWithCode('KEY_FIELDS_SELECT_INVALID_TYPE', utils_1.logServiceAndType(serviceName, typeName) +
                                    `A @key selects ${typeName}.${name}, which is an interface type. Keys cannot select interfaces.`));
                            }
                            if (graphql_1.isUnionType(matchingField.type) ||
                                (graphql_1.isNonNullType(matchingField.type) &&
                                    graphql_1.isUnionType(graphql_1.getNullableType(matchingField.type)))) {
                                errors.push(utils_1.errorWithCode('KEY_FIELDS_SELECT_INVALID_TYPE', utils_1.logServiceAndType(serviceName, typeName) +
                                    `A @key selects ${typeName}.${name}, which is a union type. Keys cannot select union types.`));
                            }
                        }
                    }
                }
            }
        }
    }
    return errors;
};
//# sourceMappingURL=keyFieldsSelectInvalidType.js.map