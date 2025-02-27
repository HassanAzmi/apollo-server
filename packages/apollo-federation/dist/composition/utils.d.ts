import 'apollo-server-env';
import { FieldDefinitionNode, StringValueNode, NameNode, DocumentNode, DirectiveNode, GraphQLNamedType, GraphQLError, GraphQLSchema, GraphQLObjectType, GraphQLField, SelectionNode, TypeDefinitionNode, TypeExtensionNode, ASTNode, DirectiveDefinitionNode, GraphQLDirective } from 'graphql';
import Maybe from 'graphql/tsutils/Maybe';
import { ExternalFieldDefinition } from './types';
export declare function isStringValueNode(node: any): node is StringValueNode;
export declare function mapFieldNamesToServiceName<Node extends {
    name: NameNode;
}>(fields: ReadonlyArray<Node>, serviceName: string): any;
export declare function findDirectivesOnTypeOrField(node: Maybe<TypeDefinitionNode | TypeExtensionNode | FieldDefinitionNode>, directiveName: string): DirectiveNode[];
export declare function stripExternalFieldsFromTypeDefs(typeDefs: DocumentNode, serviceName: string): {
    typeDefsWithoutExternalFields: DocumentNode;
    strippedFields: ExternalFieldDefinition[];
};
export declare function parseSelections(source: string): readonly SelectionNode[];
export declare function hasMatchingFieldInDirectives({ directives, fieldNameToMatch, namedType, }: {
    directives: DirectiveNode[];
    fieldNameToMatch: String;
    namedType: GraphQLNamedType;
}): boolean;
export declare const logServiceAndType: (serviceName: string, typeName: string, fieldName?: string | undefined) => string;
export declare function logDirective(directiveName: string): string;
export declare function errorWithCode(code: string, message: string, nodes?: ReadonlyArray<ASTNode> | ASTNode | undefined): GraphQLError;
export declare function findTypesContainingFieldWithReturnType(schema: GraphQLSchema, node: GraphQLField<any, any>): GraphQLObjectType[];
export declare function findFieldsThatReturnType({ schema, typeToFind, }: {
    schema: GraphQLSchema;
    typeToFind: GraphQLNamedType;
}): GraphQLField<any, any>[];
export declare function selectionIncludesField({ selections, selectionSetType, typeToFind, fieldToFind, }: {
    selections: readonly SelectionNode[];
    selectionSetType: GraphQLObjectType;
    typeToFind: GraphQLObjectType;
    fieldToFind: string;
}): boolean;
export declare function isTypeNodeAnEntity(node: TypeDefinitionNode | TypeExtensionNode): boolean;
export declare function diffTypeNodes(firstNode: TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode, secondNode: TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode): {
    name: string[];
    kind: ("ScalarTypeDefinition" | "ObjectTypeDefinition" | "InterfaceTypeDefinition" | "UnionTypeDefinition" | "EnumTypeDefinition" | "InputObjectTypeDefinition" | "DirectiveDefinition" | "ScalarTypeExtension" | "ObjectTypeExtension" | "InterfaceTypeExtension" | "UnionTypeExtension" | "EnumTypeExtension" | "InputObjectTypeExtension")[];
    fields: {
        [fieldName: string]: string[];
    };
    unionTypes: {
        [typeName: string]: boolean;
    };
    locations: string[];
    args: {
        [argumentName: string]: string[];
    };
};
export declare function typeNodesAreEquivalent(firstNode: TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode, secondNode: TypeDefinitionNode | TypeExtensionNode | DirectiveDefinitionNode): boolean;
export declare const defKindToExtKind: {
    [kind: string]: string;
};
export declare function mapValues<T, U = T>(object: Record<string, T>, callback: (value: T) => U): Record<string, U>;
export declare function isNotNullOrUndefined<T>(value: T | null | undefined): value is T;
export declare const executableDirectiveLocations: string[];
export declare function isFederationDirective(directive: GraphQLDirective): boolean;
//# sourceMappingURL=utils.d.ts.map