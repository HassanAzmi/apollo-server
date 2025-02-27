"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const specifiedRules_1 = require("graphql/validation/specifiedRules");
const UniqueDirectivesPerLocation_1 = require("graphql/validation/rules/UniqueDirectivesPerLocation");
const UniqueTypeNames_1 = require("graphql/validation/rules/UniqueTypeNames");
const UniqueEnumValueNames_1 = require("graphql/validation/rules/UniqueEnumValueNames");
const PossibleTypeExtensions_1 = require("graphql/validation/rules/PossibleTypeExtensions");
const UniqueFieldDefinitionNames_1 = require("graphql/validation/rules/UniqueFieldDefinitionNames");
const sdl_1 = require("./validate/sdl");
const omit = [
    UniqueDirectivesPerLocation_1.UniqueDirectivesPerLocation,
    UniqueTypeNames_1.UniqueTypeNames,
    UniqueEnumValueNames_1.UniqueEnumValueNames,
    PossibleTypeExtensions_1.PossibleTypeExtensions,
    UniqueFieldDefinitionNames_1.UniqueFieldDefinitionNames,
];
exports.compositionRules = specifiedRules_1.specifiedSDLRules
    .filter(rule => !omit.includes(rule))
    .concat([
    sdl_1.UniqueFieldDefinitionNames,
    sdl_1.UniqueTypeNamesWithFields,
    sdl_1.MatchingEnums,
    sdl_1.UniqueUnionTypes,
    sdl_1.PossibleTypeExtensions,
]);
//# sourceMappingURL=rules.js.map