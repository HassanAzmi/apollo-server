import 'apollo-server-env';
import { GraphQLSchema, GraphQLError, TypeDefinitionNode, DirectiveDefinitionNode, TypeExtensionNode } from 'graphql';
import { ServiceDefinition, ExternalFieldDefinition, ServiceNameToKeyDirectivesMap } from './types';
interface TypeDefinitionsMap {
    [name: string]: TypeDefinitionNode[];
}
interface TypeExtensionsMap {
    [name: string]: TypeExtensionNode[];
}
interface DirectiveDefinitionsMap {
    [name: string]: {
        [serviceName: string]: DirectiveDefinitionNode;
    };
}
interface TypeToServiceMap {
    [typeName: string]: {
        owningService?: string;
        extensionFieldsToOwningServiceMap: {
            [fieldName: string]: string;
        };
    };
}
export interface KeyDirectivesMap {
    [typeName: string]: ServiceNameToKeyDirectivesMap;
}
declare type ValueTypes = Set<string>;
export declare function buildMapsFromServiceList(serviceList: ServiceDefinition[]): {
    typeToServiceMap: TypeToServiceMap;
    typeDefinitionsMap: TypeDefinitionsMap;
    typeExtensionsMap: TypeExtensionsMap;
    directiveDefinitionsMap: DirectiveDefinitionsMap;
    externalFields: ExternalFieldDefinition[];
    keyDirectivesMap: KeyDirectivesMap;
    valueTypes: Set<string>;
};
export declare function buildSchemaFromDefinitionsAndExtensions({ typeDefinitionsMap, typeExtensionsMap, directiveDefinitionsMap, }: {
    typeDefinitionsMap: TypeDefinitionsMap;
    typeExtensionsMap: TypeExtensionsMap;
    directiveDefinitionsMap: DirectiveDefinitionsMap;
}): {
    schema: GraphQLSchema;
    errors: GraphQLError[];
};
export declare function addFederationMetadataToSchemaNodes({ schema, typeToServiceMap, externalFields, keyDirectivesMap, valueTypes, directiveDefinitionsMap, }: {
    schema: GraphQLSchema;
    typeToServiceMap: TypeToServiceMap;
    externalFields: ExternalFieldDefinition[];
    keyDirectivesMap: KeyDirectivesMap;
    valueTypes: ValueTypes;
    directiveDefinitionsMap: DirectiveDefinitionsMap;
}): void;
export declare function composeServices(services: ServiceDefinition[]): {
    schema: GraphQLSchema;
    errors: GraphQLError[];
};
export {};
//# sourceMappingURL=compose.d.ts.map