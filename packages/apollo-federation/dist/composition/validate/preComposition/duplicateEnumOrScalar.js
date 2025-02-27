"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const utils_1 = require("../../utils");
exports.duplicateEnumOrScalar = ({ name: serviceName, typeDefs, }) => {
    const errors = [];
    const enums = [];
    const scalars = [];
    graphql_1.visit(typeDefs, {
        EnumTypeDefinition(definition) {
            const name = definition.name.value;
            if (enums.includes(name)) {
                errors.push(utils_1.errorWithCode('DUPLICATE_ENUM_DEFINITION', utils_1.logServiceAndType(serviceName, name) +
                    `The enum, \`${name}\` was defined multiple times in this service. Remove one of the definitions for \`${name}\``));
                return definition;
            }
            enums.push(name);
            return definition;
        },
        ScalarTypeDefinition(definition) {
            const name = definition.name.value;
            if (scalars.includes(name)) {
                errors.push(utils_1.errorWithCode('DUPLICATE_SCALAR_DEFINITION', utils_1.logServiceAndType(serviceName, name) +
                    `The scalar, \`${name}\` was defined multiple times in this service. Remove one of the definitions for \`${name}\``));
                return definition;
            }
            scalars.push(name);
            return definition;
        },
    });
    return errors;
};
//# sourceMappingURL=duplicateEnumOrScalar.js.map