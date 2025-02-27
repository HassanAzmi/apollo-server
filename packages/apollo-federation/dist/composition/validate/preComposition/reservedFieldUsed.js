"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const utils_1 = require("../../utils");
const reservedRootFields = ['_service', '_entities'];
exports.reservedFieldUsed = ({ name: serviceName, typeDefs, }) => {
    const errors = [];
    let rootQueryName = 'Query';
    graphql_1.visit(typeDefs, {
        OperationTypeDefinition(node) {
            if (node.operation === 'query') {
                rootQueryName = node.type.name.value;
            }
        },
    });
    graphql_1.visit(typeDefs, {
        ObjectTypeDefinition(node) {
            if (node.name.value === rootQueryName && node.fields) {
                for (const field of node.fields) {
                    const { value: fieldName } = field.name;
                    if (reservedRootFields.includes(fieldName)) {
                        errors.push(utils_1.errorWithCode('RESERVED_FIELD_USED', utils_1.logServiceAndType(serviceName, rootQueryName, fieldName) +
                            `${fieldName} is a field reserved for federation and can\'t be used at the Query root.`));
                    }
                }
            }
        },
    });
    return errors;
};
//# sourceMappingURL=reservedFieldUsed.js.map