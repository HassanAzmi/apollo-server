import { GraphQLSchema, GraphQLError } from 'graphql';
import { ServiceDefinition } from '../../types';
export { externalUnused } from './externalUnused';
export { externalMissingOnBase } from './externalMissingOnBase';
export { externalTypeMismatch } from './externalTypeMismatch';
export { requiresFieldsMissingExternal } from './requiresFieldsMissingExternal';
export { requiresFieldsMissingOnBase } from './requiresFieldsMissingOnBase';
export { keyFieldsMissingOnBase } from './keyFieldsMissingOnBase';
export { keyFieldsSelectInvalidType } from './keyFieldsSelectInvalidType';
export { providesFieldsMissingExternal } from './providesFieldsMissingExternal';
export { providesFieldsSelectInvalidType, } from './providesFieldsSelectInvalidType';
export { providesNotOnEntity } from './providesNotOnEntity';
export { executableDirectivesInAllServices, } from './executableDirectivesInAllServices';
export { executableDirectivesIdentical } from './executableDirectivesIdentical';
export declare type PostCompositionValidator = ({ schema, serviceList, }: {
    schema: GraphQLSchema;
    serviceList: ServiceDefinition[];
}) => GraphQLError[];
//# sourceMappingURL=index.d.ts.map