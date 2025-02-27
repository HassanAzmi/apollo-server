"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const utils_1 = require("../../utils");
const util_1 = require("util");
function isEnumDefinition(node) {
    return node.kind === graphql_1.Kind.ENUM_TYPE_DEFINITION;
}
function MatchingEnums(context) {
    const { definitions } = context.getDocument();
    let definitionsByName = definitions.reduce((typeToDefinitionsMap, node) => {
        const name = node.name.value;
        if (typeToDefinitionsMap[name]) {
            typeToDefinitionsMap[name].push(node);
        }
        else {
            typeToDefinitionsMap[name] = [node];
        }
        return typeToDefinitionsMap;
    }, {});
    for (const [name, definitions] of Object.entries(definitionsByName)) {
        if (definitions.every(isEnumDefinition)) {
            let simpleEnumDefs = [];
            for (const { values, serviceName, } of definitions) {
                if (serviceName && values)
                    simpleEnumDefs.push({
                        serviceName,
                        values: values.map((enumValue) => enumValue.name.value),
                    });
            }
            for (const definition of simpleEnumDefs) {
                definition.values = definition.values.sort();
            }
            let matchingEnumGroups = {};
            for (const definition of simpleEnumDefs) {
                const key = definition.values.join();
                if (matchingEnumGroups[key]) {
                    matchingEnumGroups[key].push(definition.serviceName);
                }
                else {
                    matchingEnumGroups[key] = [definition.serviceName];
                }
            }
            if (Object.keys(matchingEnumGroups).length > 1) {
                context.reportError(utils_1.errorWithCode('ENUM_MISMATCH', `The \`${name}\` enum does not have identical values in all services. Groups of services with identical values are: ${Object.values(matchingEnumGroups)
                    .map(serviceNames => `[${serviceNames.join(', ')}]`)
                    .join(', ')}`));
            }
        }
        else if (definitions.some(isEnumDefinition)) {
            const servicesWithEnum = definitions
                .filter(isEnumDefinition)
                .map(definition => definition.serviceName)
                .filter(util_1.isString);
            const servicesWithoutEnum = definitions
                .filter(d => !isEnumDefinition(d))
                .map(d => d.serviceName)
                .filter(util_1.isString);
            context.reportError(utils_1.errorWithCode('ENUM_MISMATCH_TYPE', utils_1.logServiceAndType(servicesWithEnum[0], name) +
                `${name} is an enum in [${servicesWithEnum.join(', ')}], but not in [${servicesWithoutEnum.join(', ')}]`));
        }
    }
    return {};
}
exports.MatchingEnums = MatchingEnums;
//# sourceMappingURL=matchingEnums.js.map