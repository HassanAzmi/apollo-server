"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compose_1 = require("./compose");
const validate_1 = require("./validate");
const normalize_1 = require("./normalize");
function composeAndValidate(serviceList) {
    const errors = validate_1.validateServicesBeforeNormalization(serviceList);
    const normalizedServiceList = serviceList.map(({ name, typeDefs }) => ({
        name,
        typeDefs: normalize_1.normalizeTypeDefs(typeDefs),
    }));
    errors.push(...validate_1.validateServicesBeforeComposition(normalizedServiceList));
    const compositionResult = compose_1.composeServices(normalizedServiceList);
    errors.push(...compositionResult.errors);
    errors.push(...validate_1.validateComposedSchema({
        schema: compositionResult.schema,
        serviceList,
    }));
    return { schema: compositionResult.schema, warnings: [], errors };
}
exports.composeAndValidate = composeAndValidate;
//# sourceMappingURL=composeAndValidate.js.map