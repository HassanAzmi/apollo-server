"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const apollo_env_1 = require("apollo-env");
const graphql_1 = require("graphql");
const FieldSet_1 = require("./FieldSet");
const graphql_2 = require("./utilities/graphql");
const MultiMap_1 = require("./utilities/MultiMap");
const typenameField = {
    kind: graphql_1.Kind.FIELD,
    name: {
        kind: graphql_1.Kind.NAME,
        value: graphql_1.TypeNameMetaFieldDef.name,
    },
};
function buildQueryPlan(operationContext) {
    const context = buildQueryPlanningContext(operationContext);
    if (context.operation.operation === 'subscription') {
        throw new graphql_1.GraphQLError('Query planning does not support subscriptions for now.', [context.operation]);
    }
    const rootType = graphql_1.getOperationRootType(context.schema, context.operation);
    const isMutation = context.operation.operation === 'mutation';
    const fields = collectFields(context, context.newScope(rootType), context.operation.selectionSet);
    const groups = isMutation
        ? splitRootFieldsSerially(context, fields)
        : splitRootFields(context, fields);
    const nodes = groups.map(group => executionNodeForGroup(context, group, rootType));
    return {
        kind: 'QueryPlan',
        node: nodes.length
            ? flatWrap(isMutation ? 'Sequence' : 'Parallel', nodes)
            : undefined,
    };
}
exports.buildQueryPlan = buildQueryPlan;
function executionNodeForGroup(context, group, parentType) {
    const selectionSet = FieldSet_1.selectionSetFromFieldSet(group.fields, parentType);
    const fetchNode = {
        kind: 'Fetch',
        serviceName: group.serviceName,
        selectionSet,
        requires: group.requiredFields && group.requiredFields.length > 0
            ? FieldSet_1.selectionSetFromFieldSet(group.requiredFields)
            : undefined,
        variableUsages: context.getVariableUsages(selectionSet),
    };
    const node = group.mergeAt && group.mergeAt.length > 0
        ? {
            kind: 'Flatten',
            path: group.mergeAt,
            node: fetchNode,
        }
        : fetchNode;
    if (group.dependentGroups.length > 0) {
        const dependentNodes = group.dependentGroups.map(dependentGroup => executionNodeForGroup(context, dependentGroup));
        return flatWrap('Sequence', [node, flatWrap('Parallel', dependentNodes)]);
    }
    else {
        return node;
    }
}
function flatWrap(kind, nodes) {
    if (nodes.length === 0) {
        throw Error('programming error: should always be called with nodes');
    }
    if (nodes.length === 1) {
        return nodes[0];
    }
    return {
        kind,
        nodes: nodes.flatMap(n => (n.kind === kind ? n.nodes : [n])),
    };
}
function splitRootFields(context, fields) {
    const groupsByService = Object.create(null);
    function groupForService(serviceName) {
        let group = groupsByService[serviceName];
        if (!group) {
            group = new FetchGroup(serviceName);
            groupsByService[serviceName] = group;
        }
        return group;
    }
    splitFields(context, [], fields, field => {
        const { scope, fieldNode, fieldDef } = field;
        const { parentType } = scope;
        const owningService = context.getOwningService(parentType, fieldDef);
        if (!owningService) {
            throw new graphql_1.GraphQLError(`Couldn't find owning service for field "${parentType.name}.${fieldDef.name}"`, fieldNode);
        }
        return groupForService(owningService);
    });
    return Object.values(groupsByService);
}
function splitRootFieldsSerially(context, fields) {
    const fetchGroups = [];
    function groupForField(serviceName) {
        let group;
        const previousGroup = fetchGroups[fetchGroups.length - 1];
        if (previousGroup && previousGroup.serviceName === serviceName) {
            return previousGroup;
        }
        group = new FetchGroup(serviceName);
        fetchGroups.push(group);
        return group;
    }
    splitFields(context, [], fields, field => {
        const { scope, fieldNode, fieldDef } = field;
        const { parentType } = scope;
        const owningService = context.getOwningService(parentType, fieldDef);
        if (!owningService) {
            throw new graphql_1.GraphQLError(`Couldn't find owning service for field "${parentType.name}.${fieldDef.name}"`, fieldNode);
        }
        return groupForField(owningService);
    });
    return fetchGroups;
}
function splitSubfields(context, path, fields, parentGroup) {
    splitFields(context, path, fields, field => {
        const { scope, fieldNode, fieldDef } = field;
        const { parentType } = scope;
        let baseService, owningService;
        if (parentType.federation && parentType.federation.isValueType) {
            baseService = parentGroup.serviceName;
            owningService = parentGroup.serviceName;
        }
        else {
            baseService = context.getBaseService(parentType);
            owningService = context.getOwningService(parentType, fieldDef);
        }
        if (!baseService) {
            throw new graphql_1.GraphQLError(`Couldn't find base service for type "${parentType.name}"`, fieldNode);
        }
        if (!owningService) {
            throw new graphql_1.GraphQLError(`Couldn't find owning service for field "${parentType.name}.${fieldDef.name}"`, fieldNode);
        }
        if (owningService === baseService) {
            if (owningService === parentGroup.serviceName ||
                parentGroup.providedFields.some(FieldSet_1.matchesField(field))) {
                return parentGroup;
            }
            else {
                let keyFields = context.getKeyFields({
                    parentType,
                    serviceName: parentGroup.serviceName,
                });
                if (keyFields.length === 0 ||
                    (keyFields.length === 1 &&
                        keyFields[0].fieldDef.name === '__typename')) {
                    keyFields = context.getKeyFields({
                        parentType,
                        serviceName: owningService,
                    });
                }
                return parentGroup.dependentGroupForService(owningService, keyFields);
            }
        }
        else {
            const requiredFields = context.getRequiredFields(parentType, fieldDef, owningService);
            if (requiredFields.every(requiredField => parentGroup.providedFields.some(FieldSet_1.matchesField(requiredField)))) {
                if (owningService === parentGroup.serviceName) {
                    return parentGroup;
                }
                else {
                    return parentGroup.dependentGroupForService(owningService, requiredFields);
                }
            }
            else {
                const keyFields = context.getKeyFields({
                    parentType,
                    serviceName: parentGroup.serviceName,
                });
                if (!keyFields) {
                    throw new graphql_1.GraphQLError(`Couldn't find keys for type "${parentType.name}}" in service "${baseService}"`, fieldNode);
                }
                if (baseService === parentGroup.serviceName) {
                    return parentGroup.dependentGroupForService(owningService, requiredFields);
                }
                const baseGroup = parentGroup.dependentGroupForService(baseService, keyFields);
                return baseGroup.dependentGroupForService(owningService, requiredFields);
            }
        }
    });
}
function splitFields(context, path, fields, groupForField) {
    for (const fieldsForResponseName of FieldSet_1.groupByResponseName(fields).values()) {
        for (const [parentType, fieldsForParentType] of FieldSet_1.groupByParentType(fieldsForResponseName)) {
            const field = fieldsForParentType[0];
            const { scope, fieldDef } = field;
            if (fieldDef.name === graphql_1.TypeNameMetaFieldDef.name) {
                const { schema } = context;
                const roots = [
                    schema.getQueryType(),
                    schema.getMutationType(),
                    schema.getSubscriptionType(),
                ]
                    .filter(apollo_env_1.isNotNullOrUndefined)
                    .map(type => type.name);
                if (roots.indexOf(parentType.name) > -1)
                    continue;
            }
            if (graphql_1.isIntrospectionType(graphql_1.getNamedType(fieldDef.type))) {
                continue;
            }
            if (graphql_1.isObjectType(parentType) && scope.possibleTypes.includes(parentType)) {
                const group = groupForField(field);
                group.fields.push(completeField(context, scope, group, path, fieldsForResponseName));
            }
            else {
                const groupsByRuntimeParentTypes = new MultiMap_1.MultiMap();
                for (const runtimeParentType of scope.possibleTypes) {
                    const fieldDef = context.getFieldDef(runtimeParentType, field.fieldNode);
                    groupsByRuntimeParentTypes.add(groupForField({
                        scope: context.newScope(runtimeParentType, scope),
                        fieldNode: field.fieldNode,
                        fieldDef,
                    }), runtimeParentType);
                }
                for (const [group, runtimeParentTypes] of groupsByRuntimeParentTypes) {
                    for (const runtimeParentType of runtimeParentTypes) {
                        const fieldDef = context.getFieldDef(runtimeParentType, field.fieldNode);
                        const fieldsWithRuntimeParentType = fieldsForResponseName.map(field => (Object.assign(Object.assign({}, field), { fieldDef })));
                        group.fields.push(completeField(context, context.newScope(runtimeParentType, scope), group, path, fieldsWithRuntimeParentType));
                    }
                }
            }
        }
    }
}
function completeField(context, scope, parentGroup, path, fields) {
    const { fieldNode, fieldDef } = fields[0];
    const returnType = graphql_1.getNamedType(fieldDef.type);
    if (!graphql_1.isCompositeType(returnType)) {
        return { scope, fieldNode, fieldDef };
    }
    else {
        const fieldPath = addPath(path, graphql_2.getResponseName(fieldNode), fieldDef.type);
        const subGroup = new FetchGroup(parentGroup.serviceName);
        subGroup.mergeAt = fieldPath;
        subGroup.providedFields = context.getProvidedFields(fieldDef, parentGroup.serviceName);
        if (graphql_1.isAbstractType(returnType)) {
            subGroup.fields.push({
                scope: context.newScope(returnType, scope),
                fieldNode: typenameField,
                fieldDef: graphql_1.TypeNameMetaFieldDef,
            });
        }
        const subfields = collectSubfields(context, returnType, fields);
        splitSubfields(context, fieldPath, subfields, subGroup);
        parentGroup.otherDependentGroups.push(...subGroup.dependentGroups);
        return {
            scope,
            fieldNode: Object.assign(Object.assign({}, fieldNode), { selectionSet: FieldSet_1.selectionSetFromFieldSet(subGroup.fields, returnType) }),
            fieldDef,
        };
    }
}
function collectFields(context, scope, selectionSet, fields = [], visitedFragmentNames = Object.create(null)) {
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case graphql_1.Kind.FIELD:
                const fieldDef = context.getFieldDef(scope.parentType, selection);
                fields.push({ scope, fieldNode: selection, fieldDef });
                break;
            case graphql_1.Kind.INLINE_FRAGMENT:
                collectFields(context, context.newScope(getFragmentCondition(selection), scope), selection.selectionSet, fields, visitedFragmentNames);
                break;
            case graphql_1.Kind.FRAGMENT_SPREAD:
                const fragmentName = selection.name.value;
                if (visitedFragmentNames[fragmentName]) {
                    continue;
                }
                visitedFragmentNames[fragmentName] = true;
                const fragment = context.fragments[fragmentName];
                if (!fragment) {
                    continue;
                }
                collectFields(context, context.newScope(getFragmentCondition(fragment), scope), fragment.selectionSet, fields, visitedFragmentNames);
                break;
        }
    }
    return fields;
    function getFragmentCondition(fragment) {
        const typeConditionNode = fragment.typeCondition;
        if (!typeConditionNode)
            return scope.parentType;
        return graphql_1.typeFromAST(context.schema, typeConditionNode);
    }
}
function collectSubfields(context, returnType, fields) {
    let subfields = [];
    const visitedFragmentNames = Object.create(null);
    for (const field of fields) {
        const selectionSet = field.fieldNode.selectionSet;
        if (selectionSet) {
            subfields = collectFields(context, context.newScope(returnType), selectionSet, subfields, visitedFragmentNames);
        }
    }
    return subfields;
}
exports.collectSubfields = collectSubfields;
class FetchGroup {
    constructor(serviceName, fields = []) {
        this.serviceName = serviceName;
        this.fields = fields;
        this.requiredFields = [];
        this.providedFields = [];
        this.dependentGroupsByService = Object.create(null);
        this.otherDependentGroups = [];
    }
    dependentGroupForService(serviceName, requiredFields) {
        let group = this.dependentGroupsByService[serviceName];
        if (!group) {
            group = new FetchGroup(serviceName);
            group.mergeAt = this.mergeAt;
            this.dependentGroupsByService[serviceName] = group;
        }
        if (requiredFields) {
            if (group.requiredFields) {
                group.requiredFields.push(...requiredFields);
            }
            else {
                group.requiredFields = requiredFields;
            }
            this.fields.push(...requiredFields);
        }
        return group;
    }
    get dependentGroups() {
        return [
            ...Object.values(this.dependentGroupsByService),
            ...this.otherDependentGroups,
        ];
    }
}
function buildOperationContext(schema, document, operationName) {
    let operation;
    const fragments = Object.create(null);
    document.definitions.forEach(definition => {
        switch (definition.kind) {
            case graphql_1.Kind.OPERATION_DEFINITION:
                if (!operationName && operation) {
                    throw new graphql_1.GraphQLError('Must provide operation name if query contains ' +
                        'multiple operations.');
                }
                if (!operationName ||
                    (definition.name && definition.name.value === operationName)) {
                    operation = definition;
                }
                break;
            case graphql_1.Kind.FRAGMENT_DEFINITION:
                fragments[definition.name.value] = definition;
                break;
        }
    });
    if (!operation) {
        if (operationName) {
            throw new graphql_1.GraphQLError(`Unknown operation named "${operationName}".`);
        }
        else {
            throw new graphql_1.GraphQLError('Must provide an operation.');
        }
    }
    return { schema, operation, fragments };
}
exports.buildOperationContext = buildOperationContext;
function buildQueryPlanningContext({ operation, schema, fragments, }) {
    return new QueryPlanningContext(schema, operation, fragments);
}
exports.buildQueryPlanningContext = buildQueryPlanningContext;
class QueryPlanningContext {
    constructor(schema, operation, fragments) {
        this.schema = schema;
        this.operation = operation;
        this.fragments = fragments;
        this.variableDefinitions = Object.create(null);
        graphql_1.visit(operation, {
            VariableDefinition: definition => {
                this.variableDefinitions[definition.variable.name.value] = definition;
            },
        });
    }
    getFieldDef(parentType, fieldNode) {
        const fieldName = fieldNode.name.value;
        const fieldDef = graphql_2.getFieldDef(this.schema, parentType, fieldName);
        if (!fieldDef) {
            throw new graphql_1.GraphQLError(`Cannot query field "${fieldNode.name.value}" on type "${String(parentType)}"`, fieldNode);
        }
        return fieldDef;
    }
    getPossibleTypes(type) {
        return graphql_1.isAbstractType(type) ? this.schema.getPossibleTypes(type) : [type];
    }
    getVariableUsages(selectionSet) {
        const usages = Object.create(null);
        graphql_1.visit(selectionSet, {
            Variable: node => {
                usages[node.name.value] = this.variableDefinitions[node.name.value];
            },
        });
        return usages;
    }
    newScope(parentType, enclosingScope) {
        return {
            parentType,
            possibleTypes: enclosingScope
                ? this.getPossibleTypes(parentType).filter(type => enclosingScope.possibleTypes.includes(type))
                : this.getPossibleTypes(parentType),
            enclosingScope,
        };
    }
    getBaseService(parentType) {
        return (parentType.federation && parentType.federation.serviceName) || null;
    }
    getOwningService(parentType, fieldDef) {
        if (fieldDef.federation &&
            fieldDef.federation.serviceName &&
            !fieldDef.federation.belongsToValueType) {
            return fieldDef.federation.serviceName;
        }
        else {
            return this.getBaseService(parentType);
        }
    }
    getKeyFields({ parentType, serviceName, fetchAll = false, }) {
        const keyFields = [];
        keyFields.push({
            scope: {
                parentType,
                possibleTypes: this.getPossibleTypes(parentType),
            },
            fieldNode: typenameField,
            fieldDef: graphql_1.TypeNameMetaFieldDef,
        });
        for (const possibleType of this.getPossibleTypes(parentType)) {
            const keys = possibleType.federation &&
                possibleType.federation.keys &&
                possibleType.federation.keys[serviceName] &&
                possibleType.federation.keys[serviceName];
            if (!(keys && keys.length > 0))
                continue;
            if (fetchAll) {
                keyFields.push(...keys.flatMap(key => collectFields(this, this.newScope(possibleType), {
                    kind: graphql_1.Kind.SELECTION_SET,
                    selections: key,
                })));
            }
            else {
                keyFields.push(...collectFields(this, this.newScope(possibleType), {
                    kind: graphql_1.Kind.SELECTION_SET,
                    selections: keys[0],
                }));
            }
        }
        return keyFields;
    }
    getRequiredFields(parentType, fieldDef, serviceName) {
        const requiredFields = [];
        requiredFields.push(...this.getKeyFields({ parentType, serviceName }));
        if (fieldDef.federation && fieldDef.federation.requires) {
            requiredFields.push(...collectFields(this, this.newScope(parentType), {
                kind: graphql_1.Kind.SELECTION_SET,
                selections: fieldDef.federation.requires,
            }));
        }
        return requiredFields;
    }
    getProvidedFields(fieldDef, serviceName) {
        const returnType = graphql_1.getNamedType(fieldDef.type);
        if (!graphql_1.isCompositeType(returnType))
            return [];
        const providedFields = [];
        providedFields.push(...this.getKeyFields({
            parentType: returnType,
            serviceName,
            fetchAll: true,
        }));
        if (fieldDef.federation && fieldDef.federation.provides) {
            providedFields.push(...collectFields(this, this.newScope(returnType), {
                kind: graphql_1.Kind.SELECTION_SET,
                selections: fieldDef.federation.provides,
            }));
        }
        return providedFields;
    }
}
exports.QueryPlanningContext = QueryPlanningContext;
function addPath(path, responseName, type) {
    path = [...path, responseName];
    while (!graphql_1.isNamedType(type)) {
        if (graphql_1.isListType(type)) {
            path.push('@');
        }
        type = type.ofType;
    }
    return path;
}
//# sourceMappingURL=buildQueryPlan.js.map