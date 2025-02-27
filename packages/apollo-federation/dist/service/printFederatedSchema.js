"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const graphql_1 = require("graphql");
const directives_1 = __importStar(require("../directives"));
const types_1 = require("../types");
function isSpecifiedDirective(directive) {
    return [...graphql_1.specifiedDirectives, ...directives_1.default].some(specifiedDirective => specifiedDirective.name === directive.name);
}
function isDefinedType(type) {
    return (!graphql_1.isSpecifiedScalarType(type) &&
        !graphql_1.isIntrospectionType(type) &&
        !types_1.isFederationType(type));
}
function printSchema(schema) {
    const directives = schema
        .getDirectives()
        .filter(n => !isSpecifiedDirective(n));
    const typeMap = schema.getTypeMap();
    const types = Object.values(typeMap)
        .sort((type1, type2) => type1.name.localeCompare(type2.name))
        .filter(isDefinedType);
    return ([printSchemaDefinition(schema)]
        .concat(directives.map(directive => printDirective(directive)), types.map(type => printType(type)))
        .filter(Boolean)
        .join('\n\n') + '\n');
}
exports.printSchema = printSchema;
function printSchemaDefinition(schema) {
    if (isSchemaOfCommonNames(schema)) {
        return;
    }
    const operationTypes = [];
    const queryType = schema.getQueryType();
    if (queryType) {
        operationTypes.push(`  query: ${queryType.name}`);
    }
    const mutationType = schema.getMutationType();
    if (mutationType) {
        operationTypes.push(`  mutation: ${mutationType.name}`);
    }
    const subscriptionType = schema.getSubscriptionType();
    if (subscriptionType) {
        operationTypes.push(`  subscription: ${subscriptionType.name}`);
    }
    return `schema {\n${operationTypes.join('\n')}\n}`;
}
function isSchemaOfCommonNames(schema) {
    const queryType = schema.getQueryType();
    if (queryType && queryType.name !== 'Query') {
        return false;
    }
    const mutationType = schema.getMutationType();
    if (mutationType && mutationType.name !== 'Mutation') {
        return false;
    }
    const subscriptionType = schema.getSubscriptionType();
    if (subscriptionType && subscriptionType.name !== 'Subscription') {
        return false;
    }
    return true;
}
function printType(type) {
    if (graphql_1.isScalarType(type)) {
        return printScalar(type);
    }
    else if (graphql_1.isObjectType(type)) {
        return printObject(type);
    }
    else if (graphql_1.isInterfaceType(type)) {
        return printInterface(type);
    }
    else if (graphql_1.isUnionType(type)) {
        return printUnion(type);
    }
    else if (graphql_1.isEnumType(type)) {
        return printEnum(type);
    }
    else if (graphql_1.isInputObjectType(type)) {
        return printInputObject(type);
    }
    throw new Error(`Unexpected type: "${type}".`);
}
function printScalar(type) {
    return printDescription(type) + `scalar ${type.name}`;
}
function printFederationDirectives(type) {
    if (!type.astNode)
        return '';
    if (graphql_1.isInputObjectType(type))
        return '';
    const directives = directives_1.gatherDirectives(type)
        .filter(n => directives_1.default.some(fedDir => fedDir.name === n.name.value))
        .map(graphql_1.print)
        .join(' ');
    return directives.length > 0 ? ' ' + directives : '';
}
function printObject(type) {
    const interfaces = type.getInterfaces();
    const isExtension = type.extensionASTNodes && type.astNode && !type.astNode.fields;
    const implementedInterfaces = interfaces.length
        ? ' implements ' + interfaces.map(i => i.name).join(' & ')
        : '';
    return (printDescription(type) +
        `${isExtension ? 'extend ' : ''}type ${type.name}${implementedInterfaces}${printFederationDirectives(type)}` +
        printFields(type));
}
function printInterface(type) {
    const isExtension = type.extensionASTNodes && type.astNode && !type.astNode.fields;
    return (printDescription(type) +
        `${isExtension ? 'extend ' : ''}interface ${type.name}${printFederationDirectives(type)}` +
        printFields(type));
}
function printUnion(type) {
    const types = type.getTypes();
    const possibleTypes = types.length ? ' = ' + types.join(' | ') : '';
    return printDescription(type) + 'union ' + type.name + possibleTypes;
}
function printEnum(type) {
    const values = type
        .getValues()
        .map(value => printDescription(value, '  ') +
        '  ' +
        value.name +
        printDeprecated(value));
    return printDescription(type) + `enum ${type.name}` + printBlock(values);
}
function printInputObject(type) {
    const fields = Object.values(type.getFields()).map(f => printDescription(f, '  ') + '  ' + printInputValue(f));
    return printDescription(type) + `input ${type.name}` + printBlock(fields);
}
function printFields(type) {
    const fields = Object.values(type.getFields()).map(f => printDescription(f, '  ') +
        '  ' +
        f.name +
        printArgs(f.args, '  ') +
        ': ' +
        String(f.type) +
        printDeprecated(f) +
        printFederationDirectives(f));
    return printBlock(fields);
}
function printBlock(items) {
    return items.length !== 0 ? ' {\n' + items.join('\n') + '\n}' : '';
}
function printArgs(args, indentation = '') {
    if (args.length === 0) {
        return '';
    }
    if (args.every(arg => !arg.description)) {
        return '(' + args.map(printInputValue).join(', ') + ')';
    }
    return ('(\n' +
        args
            .map(arg => printDescription(arg, '  ' + indentation) +
            '  ' +
            indentation +
            printInputValue(arg))
            .join('\n') +
        '\n' +
        indentation +
        ')');
}
function printInputValue(arg) {
    const defaultAST = graphql_1.astFromValue(arg.defaultValue, arg.type);
    let argDecl = arg.name + ': ' + String(arg.type);
    if (defaultAST) {
        argDecl += ` = ${graphql_1.print(defaultAST)}`;
    }
    return argDecl;
}
function printDirective(directive) {
    return (printDescription(directive) +
        'directive @' +
        directive.name +
        printArgs(directive.args) +
        ' on ' +
        directive.locations.join(' | '));
}
function printDeprecated(fieldOrEnumVal) {
    if (!fieldOrEnumVal.isDeprecated) {
        return '';
    }
    const reason = fieldOrEnumVal.deprecationReason;
    const reasonAST = graphql_1.astFromValue(reason, graphql_1.GraphQLString);
    if (reasonAST && reason !== '' && reason !== graphql_1.DEFAULT_DEPRECATION_REASON) {
        return ' @deprecated(reason: ' + graphql_1.print(reasonAST) + ')';
    }
    return ' @deprecated';
}
function printDescription(def, indentation = '') {
    if (!def.description) {
        return '';
    }
    const lines = descriptionLines(def.description, 120 - indentation.length);
    if (lines.length === 1) {
        return indentation + `"${lines[0]}"\n`;
    }
    else {
        return (indentation + ['"""', ...lines, '"""'].join('\n' + indentation) + '\n');
    }
}
function descriptionLines(description, maxLen) {
    const rawLines = description.split('\n');
    return rawLines.flatMap(line => {
        if (line.length < maxLen + 5) {
            return line;
        }
        return breakLine(line, maxLen);
    });
}
function breakLine(line, maxLen) {
    const parts = line.split(new RegExp(`((?: |^).{15,${maxLen - 40}}(?= |$))`));
    if (parts.length < 4) {
        return [line];
    }
    const sublines = [parts[0] + parts[1] + parts[2]];
    for (let i = 3; i < parts.length; i += 2) {
        sublines.push(parts[i].slice(1) + parts[i + 1]);
    }
    return sublines;
}
//# sourceMappingURL=printFederatedSchema.js.map