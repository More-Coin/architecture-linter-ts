import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  Node,
  Scope,
  SyntaxKind,
  VariableDeclarationKind,
  type ClassDeclaration,
  type Expression,
  type FunctionTypeNode,
  type GetAccessorDeclaration,
  type InterfaceDeclaration,
  type MethodDeclaration,
  type MethodSignature,
  type NewExpression,
  type PropertyDeclaration,
  type SourceFile,
} from "ts-morph";

import { ArchitecturePathClassificationPolicy } from "../../../Domain/Policies/ArchitecturePathClassificationPolicy.ts";
import {
  isDependencyResolutionAccess,
  isDependencyResolutionDecoratorName,
} from "../../../Domain/Policies/shared/DependencyResolutionDetection.ts";
import type { ArchitectureConstructionOccurrence } from "../../../Domain/ValueObjects/ArchitectureConstructionOccurrence.ts";
import type { ArchitectureDecoratorOccurrence } from "../../../Domain/ValueObjects/ArchitectureDecoratorOccurrence.ts";
import type { ArchitectureDependencyResolutionOccurrence } from "../../../Domain/ValueObjects/ArchitectureDependencyResolutionOccurrence.ts";
import { ArchitectureFile } from "../../../Domain/ValueObjects/ArchitectureFile.ts";
import type { ArchitectureFunctionTypeOccurrence } from "../../../Domain/ValueObjects/ArchitectureFunctionTypeOccurrence.ts";
import type { ArchitectureLinterConfiguration } from "../../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";
import type { ArchitectureStaticMemberAccessOccurrence } from "../../../Domain/ValueObjects/ArchitectureStaticMemberAccessOccurrence.ts";
import type { ArchitectureTopLevelValueDeclarationKind } from "../../../Domain/ValueObjects/ArchitectureTopLevelValueDeclaration.ts";
import { NominalKind } from "../../../Domain/ValueObjects/NominalKind.ts";
import type { SourceCoordinate } from "../../../Domain/ValueObjects/SourceCoordinate.ts";

const BUILTIN_TYPE_NAMES = new Set([
  "Array",
  "Promise",
  "PromiseLike",
  "Record",
  "ReadonlyArray",
  "Map",
  "Set",
  "Date",
  "String",
  "Number",
  "Boolean",
  "Object",
]);

const TYPE_KEYWORDS = new Set([
  "any",
  "unknown",
  "never",
  "void",
  "undefined",
  "null",
  "string",
  "number",
  "boolean",
  "object",
  "symbol",
  "bigint",
  "true",
  "false",
  "readonly",
  "keyof",
  "typeof",
  "infer",
  "extends",
]);

const LOWERCASE_PLATFORM_STATIC_MEMBER_ACCESSES = new Set([
  "document.cookie",
  "navigator.clipboard",
  "process.env",
  "import.meta.env",
  "window.localStorage",
  "window.sessionStorage",
  "globalThis.localStorage",
  "globalThis.sessionStorage",
]);

export class TypeScriptSourceFileModel {
  private readonly classifier: ArchitecturePathClassificationPolicy;

  constructor(configuration: ArchitectureLinterConfiguration) {
    this.classifier = new ArchitecturePathClassificationPolicy(configuration);
  }

  toDomain(sourceFile: SourceFile, rootURL: URL): ArchitectureFile {
    const repoRelativePath = repoRelativePathFromURLs(
      pathToFileURL(sourceFile.getFilePath()),
      rootURL,
    );
    const classification = this.classifier.classify(repoRelativePath);
    const typeReferences = this.collectTypeReferences(sourceFile);
    const topLevelDeclarations = this.collectTopLevelDeclarations(sourceFile);
    const topLevelValueDeclarations =
      this.collectTopLevelValueDeclarations(sourceFile);
    const methodDeclarations = this.collectMethodDeclarations(sourceFile);
    const constructorDeclarations = this.collectConstructorDeclarations(sourceFile);
    const computedPropertyDeclarations = this.collectComputedPropertyDeclarations(
      sourceFile,
    );
    const storedMemberDeclarations = this.collectStoredMemberDeclarations(sourceFile);
    const typedMemberOccurrences = storedMemberDeclarations.map((declaration) => ({
      name: declaration.name,
      typeNames: declaration.typeNames,
      coordinate: declaration.coordinate,
    }));
    const {
      memberCallOccurrences,
      operationalUseOccurrences,
    } = this.collectCallOccurrences(sourceFile);
    const constructionOccurrences = this.collectConstructionOccurrences(sourceFile);
    const staticMemberAccessOccurrences =
      this.collectStaticMemberAccessOccurrences(sourceFile);
    const decoratorOccurrences = this.collectDecoratorOccurrences(sourceFile);
    const dependencyResolutionOccurrences = this.collectDependencyResolutionOccurrences({
      memberCallOccurrences,
      staticMemberAccessOccurrences,
      decoratorOccurrences,
    });

    return new ArchitectureFile({
      repoRelativePath,
      classification,
      imports: sourceFile.getImportDeclarations().map((declaration) => ({
        moduleName: declaration.getModuleSpecifierValue(),
        coordinate: coordinateFor(declaration.getModuleSpecifier()),
      })),
      functionTypeOccurrences: this.collectFunctionTypeOccurrences(sourceFile),
      identifierOccurrences: sourceFile
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((identifier) => ({
          name: identifier.getText(),
          coordinate: coordinateFor(identifier),
        })),
      stringLiteralOccurrences: sourceFile
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .map((literal) => ({
          value: literal.getLiteralValue(),
          coordinate: coordinateFor(literal),
        })),
      typedMemberOccurrences,
      memberCallOccurrences,
      methodDeclarations,
      constructorDeclarations,
      computedPropertyDeclarations,
      storedMemberDeclarations,
      operationalUseOccurrences,
      typeReferences,
      typeAliasDeclarations: this.collectTypeAliasDeclarations(sourceFile),
      topLevelDeclarations,
      topLevelValueDeclarations,
      nestedNominalDeclarations: [],
      constructionOccurrences,
      staticMemberAccessOccurrences,
      decoratorOccurrences,
      dependencyResolutionOccurrences,
    });
  }

  private collectTopLevelDeclarations(sourceFile: SourceFile) {
    return sourceFile.getStatements().flatMap((statement) => {
      if (Node.isClassDeclaration(statement)) {
        const name = statement.getName();
        if (!name) {
          return [];
        }

        return [
          {
            name,
            kind: NominalKind.Class,
            inheritedTypeNames: this.extractHeritageTypeNames(statement),
            memberNames: this.memberNamesForClass(statement),
            coordinate: coordinateFor(statement.getNameNode() ?? statement),
          },
        ];
      }

      if (Node.isInterfaceDeclaration(statement)) {
        return [
          {
            name: statement.getName(),
            kind: NominalKind.Protocol,
            inheritedTypeNames: this.extractHeritageTypeNames(statement),
            memberNames: this.memberNamesForInterface(statement),
            coordinate: coordinateFor(statement.getNameNode()),
          },
        ];
      }

      if (Node.isEnumDeclaration(statement)) {
        return [
          {
            name: statement.getName(),
            kind: NominalKind.Enum,
            inheritedTypeNames: [],
            memberNames: statement.getMembers().map((member) => member.getName()),
            coordinate: coordinateFor(statement.getNameNode()),
          },
        ];
      }

      return [];
    });
  }

  private collectTopLevelValueDeclarations(sourceFile: SourceFile) {
    return sourceFile.getStatements().flatMap((statement) => {
      if (Node.isFunctionDeclaration(statement)) {
        const name = statement.getName();
        if (!name) {
          return [];
        }

        return [
          {
            name,
            kind: "function" as const,
            isExported: statement.isExported(),
            coordinate: coordinateFor(statement.getNameNode() ?? statement),
          },
        ];
      }

      if (Node.isVariableStatement(statement)) {
        const kind = topLevelValueDeclarationKindFor(
          statement.getDeclarationKind(),
        );
        if (!kind) {
          return [];
        }

        return statement.getDeclarations().flatMap((declaration) => {
          const nameNode = declaration.getNameNode();
          if (!Node.isIdentifier(nameNode)) {
            return [];
          }

          return [
            {
              name: nameNode.getText(),
              kind,
              isExported: statement.isExported(),
              coordinate: coordinateFor(nameNode),
            },
          ];
        });
      }

      return [];
    });
  }

  private collectMethodDeclarations(sourceFile: SourceFile) {
    const classMethods = sourceFile.getClasses().flatMap((declaration) =>
      declaration.getMethods().map((method) =>
        this.toMethodDeclaration(method, declaration.getNameOrThrow()),
      ),
    );
    const interfaceMethods = sourceFile.getInterfaces().flatMap((declaration) =>
      declaration.getMethods().map((method) =>
        this.toInterfaceMethodDeclaration(method, declaration.getName()),
      ),
    );

    return [...classMethods, ...interfaceMethods];
  }

  private collectConstructorDeclarations(sourceFile: SourceFile) {
    return sourceFile.getClasses().flatMap((declaration) =>
      declaration.getConstructors().map((constructorDeclaration) => ({
        enclosingTypeName: declaration.getNameOrThrow(),
        parameterTypeNames: constructorDeclaration
          .getParameters()
          .flatMap((parameter) => this.extractTypeNamesFromNode(parameter.getTypeNode())),
        coordinate: coordinateFor(constructorDeclaration),
      })),
    );
  }

  private collectFunctionTypeOccurrences(
    sourceFile: SourceFile,
  ): readonly ArchitectureFunctionTypeOccurrence[] {
    return sourceFile
      .getDescendantsOfKind(SyntaxKind.FunctionType)
      .map((node) => this.toFunctionTypeOccurrence(node));
  }

  private collectComputedPropertyDeclarations(sourceFile: SourceFile) {
    return sourceFile.getClasses().flatMap((declaration) =>
      declaration.getGetAccessors().map((accessor) =>
        this.toComputedPropertyDeclaration(accessor, declaration.getNameOrThrow()),
      ),
    );
  }

  private collectStoredMemberDeclarations(sourceFile: SourceFile) {
    return sourceFile.getClasses().flatMap((declaration) => {
      const typeName = declaration.getNameOrThrow();
      const properties = declaration.getProperties().map((property) =>
        this.toStoredMemberDeclaration(property, typeName),
      );
      const parameterProperties = declaration
        .getConstructors()
        .flatMap((constructorDeclaration) =>
          constructorDeclaration.getParameters().flatMap((parameter) => {
            if (!parameter.isParameterProperty()) {
              return [];
            }

            return [
              {
                enclosingTypeName: typeName,
                name: parameter.getName(),
                typeNames: this.extractTypeNamesFromNode(parameter.getTypeNode()),
                isStatic: false,
                coordinate: coordinateFor(parameter.getNameNode()),
              },
            ];
          }),
        );

      return [...properties, ...parameterProperties];
    });
  }

  private collectTypeReferences(sourceFile: SourceFile) {
    const references = new Map<string, SourceCoordinate>();

    const pushNames = (text: string | undefined, coordinate: SourceCoordinate) => {
      if (!text) {
        return;
      }

      for (const name of this.extractTypeNamesFromText(text)) {
        if (!references.has(name)) {
          references.set(name, coordinate);
        }
      }
    };

    for (const node of sourceFile.getDescendants()) {
      if (Node.isTypeReference(node)) {
        pushNames(node.getText(), coordinateFor(node));
        continue;
      }

      if (Node.isExpressionWithTypeArguments(node)) {
        pushNames(node.getText(), coordinateFor(node));
        continue;
      }

      if (Node.isHeritageClause(node)) {
        pushNames(node.getText(), coordinateFor(node));
        continue;
      }

      if (Node.isNewExpression(node)) {
        pushNames(node.getExpression().getText(), coordinateFor(node));
      }
    }

    return [...references.entries()].map(([name, coordinate]) => ({
      name,
      coordinate,
    }));
  }

  private collectTypeAliasDeclarations(sourceFile: SourceFile) {
    return sourceFile.getTypeAliases().flatMap((declaration) => {
      const typeNames = this.extractTypeNamesFromNode(declaration.getTypeNode());
      const targetTypeName = typeNames.at(-1);
      if (!targetTypeName) {
        return [];
      }

      return [
        {
          aliasName: declaration.getName(),
          targetTypeName,
          coordinate: coordinateFor(declaration.getNameNode()),
        },
      ];
    });
  }

  private collectCallOccurrences(sourceFile: SourceFile) {
    const memberCallOccurrences: Array<{
      baseName: string;
      memberName: string;
      coordinate: SourceCoordinate;
    }> = [];
    const operationalUseOccurrences: Array<{
      enclosingTypeName: string;
      enclosingMethodName: string;
      baseName: string;
      memberName: string;
      coordinate: SourceCoordinate;
    }> = [];

    for (const declaration of sourceFile.getClasses()) {
      const typeName = declaration.getName();
      if (!typeName) {
        continue;
      }

      const memberNames = new Set([
        ...declaration.getProperties().map((property) => property.getName()),
        ...declaration
          .getConstructors()
          .flatMap((constructorDeclaration) =>
            constructorDeclaration
              .getParameters()
              .flatMap((parameter) =>
                parameter.isParameterProperty() ? [parameter.getName()] : [],
              ),
          ),
        ...declaration.getMethods().map((method) => method.getName()),
      ]);

      for (const method of declaration.getMethods()) {
        const aliasMap = this.aliasMapForMethod(method, memberNames);

        for (const callExpression of method.getDescendantsOfKind(
          SyntaxKind.CallExpression,
        )) {
          const occurrence = this.callOccurrenceForExpression(
            callExpression.getExpression(),
            aliasMap,
          );
          if (!occurrence) {
            continue;
          }

          memberCallOccurrences.push({
            baseName: occurrence.baseName,
            memberName: occurrence.memberName,
          coordinate: coordinateFor(callExpression),
          });
          operationalUseOccurrences.push({
            enclosingTypeName: typeName,
            enclosingMethodName: method.getName(),
            baseName: occurrence.baseName,
            memberName: occurrence.memberName,
            coordinate: coordinateFor(callExpression),
          });
        }

        for (const newExpression of method.getDescendantsOfKind(
          SyntaxKind.NewExpression,
        )) {
          const occurrence = this.newOccurrenceForExpression(newExpression);
          if (!occurrence) {
            continue;
          }

          operationalUseOccurrences.push({
            enclosingTypeName: typeName,
            enclosingMethodName: method.getName(),
            baseName: occurrence.baseName,
            memberName: occurrence.memberName,
            coordinate: coordinateFor(newExpression),
          });
        }
      }
    }

    return { memberCallOccurrences, operationalUseOccurrences };
  }

  private collectConstructionOccurrences(
    sourceFile: SourceFile,
  ): readonly ArchitectureConstructionOccurrence[] {
    const occurrences: ArchitectureConstructionOccurrence[] = [];
    const seen = new Set<string>();

    for (const newExpression of sourceFile.getDescendantsOfKind(
      SyntaxKind.NewExpression,
    )) {
      const constructedText = newExpression.getExpression().getText();
      const [typeName] = this.extractTypeNamesFromText(constructedText);
      if (!typeName) {
        continue;
      }

      const coordinate = coordinateFor(newExpression);
      const key = `${typeName}:${coordinate.line}:${coordinate.column}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      occurrences.push({
        typeName,
        assignedName: assignedNameForConstruction(newExpression),
        coordinate,
      });
    }

    return occurrences;
  }

  private collectStaticMemberAccessOccurrences(
    sourceFile: SourceFile,
  ): readonly ArchitectureStaticMemberAccessOccurrence[] {
    const occurrences: ArchitectureStaticMemberAccessOccurrence[] = [];
    const seen = new Set<string>();

    for (const node of sourceFile.getDescendantsOfKind(
      SyntaxKind.PropertyAccessExpression,
    )) {
      const baseExpression = node.getExpression();
      const baseName = baseExpression.getText();
      const memberName = node.getName();
      const access = `${baseName}.${memberName}`;
      if (
        !LOWERCASE_PLATFORM_STATIC_MEMBER_ACCESSES.has(access) &&
        (!Node.isIdentifier(baseExpression) || !isCapitalizedIdentifier(baseName))
      ) {
        continue;
      }

      // Skip the property-access node when it is the callee of a CallExpression
      // (e.g. `Container.resolve(Foo)` — the call form is already captured by
      // `memberCallOccurrences`). Standalone accesses such as `Foo.shared`
      // remain in scope.
      const parent = node.getParent();
      if (
        parent &&
        Node.isCallExpression(parent) &&
        parent.getExpression() === node
      ) {
        continue;
      }

      const coordinate = coordinateFor(node);
      const key = `${baseName}.${memberName}:${coordinate.line}:${coordinate.column}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      occurrences.push({ baseName, memberName, coordinate });
    }

    return occurrences;
  }

  private collectDecoratorOccurrences(
    sourceFile: SourceFile,
  ): readonly ArchitectureDecoratorOccurrence[] {
    const occurrences: ArchitectureDecoratorOccurrence[] = [];
    const seen = new Set<string>();

    for (const decorator of sourceFile.getDescendantsOfKind(
      SyntaxKind.Decorator,
    )) {
      const expression = decorator.getExpression();
      const text = Node.isCallExpression(expression)
        ? expression.getExpression().getText()
        : expression.getText();
      // Pick the trailing identifier from `@foo.bar` style decorators
      // and from plain `@Inject`.
      const segments = text.split(".");
      const name = segments[segments.length - 1] ?? "";
      if (!name) {
        continue;
      }

      const coordinate = coordinateFor(decorator);
      const key = `${name}:${coordinate.line}:${coordinate.column}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      occurrences.push({ name, coordinate });
    }

    return occurrences;
  }

  private collectDependencyResolutionOccurrences(input: {
    readonly memberCallOccurrences: readonly {
      readonly baseName: string;
      readonly memberName: string;
      readonly coordinate: SourceCoordinate;
    }[];
    readonly staticMemberAccessOccurrences: readonly ArchitectureStaticMemberAccessOccurrence[];
    readonly decoratorOccurrences: readonly ArchitectureDecoratorOccurrence[];
  }): readonly ArchitectureDependencyResolutionOccurrence[] {
    const occurrences: ArchitectureDependencyResolutionOccurrence[] = [];
    const seen = new Set<string>();

    const push = (
      occurrence: ArchitectureDependencyResolutionOccurrence,
    ): void => {
      const key = `${occurrence.baseName}.${occurrence.memberName ?? ""}:${occurrence.coordinate.line}:${occurrence.coordinate.column}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      occurrences.push(occurrence);
    };

    for (const call of input.memberCallOccurrences) {
      if (isDependencyResolutionAccess(call.baseName, call.memberName)) {
        push({
          baseName: call.baseName,
          memberName: call.memberName,
          coordinate: call.coordinate,
        });
      }
    }

    for (const access of input.staticMemberAccessOccurrences) {
      if (isDependencyResolutionAccess(access.baseName, access.memberName)) {
        push({
          baseName: access.baseName,
          memberName: access.memberName,
          coordinate: access.coordinate,
        });
      }
    }

    for (const decorator of input.decoratorOccurrences) {
      if (isDependencyResolutionDecoratorName(decorator.name)) {
        push({
          baseName: decorator.name,
          coordinate: decorator.coordinate,
        });
      }
    }

    return occurrences;
  }

  private aliasMapForMethod(
    method: MethodDeclaration,
    memberNames: ReadonlySet<string>,
  ): ReadonlyMap<string, string> {
    const aliases = new Map<string, string>();

    for (const declaration of method.getDescendantsOfKind(
      SyntaxKind.VariableDeclaration,
    )) {
      const initializer = declaration.getInitializer();
      if (!initializer) {
        continue;
      }

      const targetName = declaration.getNameNode().getText();
      const referencedName = this.referenceNameForExpression(
        initializer,
        aliases,
        memberNames,
      );
      if (referencedName) {
        aliases.set(targetName, referencedName);
      }
    }

    for (const assignment of method.getDescendantsOfKind(
      SyntaxKind.BinaryExpression,
    )) {
      if (assignment.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
        continue;
      }

      const left = assignment.getLeft();
      if (!Node.isIdentifier(left)) {
        continue;
      }

      const referencedName = this.referenceNameForExpression(
        assignment.getRight(),
        aliases,
        memberNames,
      );
      if (referencedName) {
        aliases.set(left.getText(), referencedName);
      }
    }

    return aliases;
  }

  private callOccurrenceForExpression(
    expression: Expression,
    aliases: ReadonlyMap<string, string>,
  ): { baseName: string; memberName: string } | undefined {
    if (Node.isIdentifier(expression)) {
      return {
        baseName: aliases.get(expression.getText()) ?? expression.getText(),
        memberName: "call",
      };
    }

    if (Node.isPropertyAccessExpression(expression)) {
      const baseName = this.baseNameForPropertyAccess(expression, aliases);
      if (!baseName) {
        return undefined;
      }

      return {
        baseName,
        memberName: expression.getName(),
      };
    }

    return undefined;
  }

  private newOccurrenceForExpression(
    expression: NewExpression,
  ): { baseName: string; memberName: string } | undefined {
    const constructedText = expression.getExpression().getText();
    const [baseName] = this.extractTypeNamesFromText(constructedText);
    if (!baseName) {
      return undefined;
    }

    return {
      baseName,
      memberName: "new",
    };
  }

  private referenceNameForExpression(
    expression: Expression,
    aliases: ReadonlyMap<string, string>,
    memberNames: ReadonlySet<string>,
  ): string | undefined {
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      return aliases.get(name) ?? (memberNames.has(name) ? name : undefined);
    }

    if (Node.isPropertyAccessExpression(expression)) {
      return this.baseNameForPropertyAccess(expression, aliases, memberNames);
    }

    return undefined;
  }

  private baseNameForPropertyAccess(
    expression: ReturnType<MethodDeclaration["getDescendantsOfKind"]>[number] | Expression,
    aliases: ReadonlyMap<string, string>,
    memberNames?: ReadonlySet<string>,
  ): string | undefined {
    if (!Node.isPropertyAccessExpression(expression)) {
      return undefined;
    }

    const target = expression.getExpression();
    if (Node.isThisExpression(target)) {
      return expression.getName();
    }

    if (Node.isIdentifier(target)) {
      const name = target.getText();
      return aliases.get(name) ?? (memberNames?.has(name) ? name : name);
    }

    if (Node.isPropertyAccessExpression(target)) {
      return this.baseNameForPropertyAccess(target, aliases, memberNames);
    }

    return undefined;
  }

  private toMethodDeclaration(
    declaration: MethodDeclaration,
    enclosingTypeName: string,
  ) {
    const returnTypeNode = declaration.getReturnTypeNode();
    const returnTypeText =
      returnTypeNode?.getText() ?? declaration.getReturnType().getText(declaration);

    return {
      enclosingTypeName,
      name: declaration.getName(),
      isStatic: declaration.isStatic(),
      isPublicOrOpen:
        declaration.getScope() !== Scope.Private &&
        declaration.getScope() !== Scope.Protected,
      isPrivateOrFileprivate: declaration.getScope() === Scope.Private,
      parameterTypeNames: declaration
        .getParameters()
        .flatMap((parameter) => this.extractTypeNamesFromNode(parameter.getTypeNode())),
      hasExplicitReturnType: returnTypeNode != null,
      returnTypeDescription: returnTypeText,
      returnTypeNames: this.extractTypeNamesFromText(returnTypeText),
      returnsVoidLike: this.isVoidLikeType(returnTypeText),
      coordinate: coordinateFor(declaration.getNameNode()),
    };
  }

  private toInterfaceMethodDeclaration(
    declaration: MethodSignature,
    enclosingTypeName: string,
  ) {
    const returnTypeNode = declaration.getReturnTypeNode();
    const returnTypeText = returnTypeNode?.getText() ?? "void";

    return {
      enclosingTypeName,
      name: declaration.getName(),
      isStatic: false,
      isPublicOrOpen: true,
      isPrivateOrFileprivate: false,
      parameterTypeNames: declaration
        .getParameters()
        .flatMap((parameter) => this.extractTypeNamesFromNode(parameter.getTypeNode())),
      hasExplicitReturnType: returnTypeNode != null,
      returnTypeDescription: returnTypeText,
      returnTypeNames: this.extractTypeNamesFromText(returnTypeText),
      returnsVoidLike: this.isVoidLikeType(returnTypeText),
      coordinate: coordinateFor(declaration.getNameNode()),
    };
  }

  private toFunctionTypeOccurrence(
    declaration: FunctionTypeNode,
  ): ArchitectureFunctionTypeOccurrence {
    const returnTypeNode = declaration.getReturnTypeNode();
    const returnTypeText =
      returnTypeNode?.getText() ?? declaration.getReturnType().getText(declaration);

    return {
      coordinate: coordinateFor(declaration),
      parameterTypeNames: declaration
        .getParameters()
        .flatMap((parameter) => this.extractTypeNamesFromNode(parameter.getTypeNode())),
      returnTypeNames: this.extractTypeNamesFromText(returnTypeText),
      isAsync: this.isPromiseLikeType(returnTypeText),
      isVoidLikeReturn: this.isVoidLikeType(returnTypeText),
    };
  }

  private toComputedPropertyDeclaration(
    declaration: GetAccessorDeclaration,
    enclosingTypeName: string,
  ) {
    const returnTypeText =
      declaration.getReturnTypeNode()?.getText() ??
      declaration.getReturnType().getText(declaration);

    return {
      enclosingTypeName,
      name: declaration.getName(),
      typeDescription: returnTypeText,
      typeNames: this.extractTypeNamesFromText(returnTypeText),
      isStatic: declaration.isStatic(),
      coordinate: coordinateFor(declaration.getNameNode()),
    };
  }

  private toStoredMemberDeclaration(
    declaration: PropertyDeclaration,
    enclosingTypeName: string,
  ) {
    return {
      enclosingTypeName,
      name: declaration.getName(),
      typeNames: this.extractTypeNamesFromNode(declaration.getTypeNode()),
      isStatic: declaration.isStatic(),
      coordinate: coordinateFor(declaration.getNameNode()),
    };
  }

  private extractHeritageTypeNames(
    declaration: ClassDeclaration | InterfaceDeclaration,
  ): readonly string[] {
    const names = new Set<string>();

    if (Node.isClassDeclaration(declaration)) {
      const extendsDeclaration = declaration.getExtends();
      if (extendsDeclaration) {
        for (const name of this.extractTypeNamesFromText(extendsDeclaration.getText())) {
          names.add(name);
        }
      }

      for (const implementation of declaration.getImplements()) {
        for (const name of this.extractTypeNamesFromText(implementation.getText())) {
          names.add(name);
        }
      }
    }

    if (Node.isInterfaceDeclaration(declaration)) {
      for (const extension of declaration.getExtends()) {
        for (const name of this.extractTypeNamesFromText(extension.getText())) {
          names.add(name);
        }
      }
    }

    return [...names];
  }

  private memberNamesForClass(declaration: ClassDeclaration): readonly string[] {
    return [
      ...declaration.getProperties().map((property) => property.getName()),
      ...declaration
        .getConstructors()
        .flatMap((constructorDeclaration) =>
          constructorDeclaration
            .getParameters()
            .flatMap((parameter) =>
              parameter.isParameterProperty() ? [parameter.getName()] : [],
            ),
        ),
      ...declaration.getMethods().map((method) => method.getName()),
      ...declaration.getGetAccessors().map((accessor) => accessor.getName()),
    ];
  }

  private memberNamesForInterface(declaration: InterfaceDeclaration): readonly string[] {
    return [
      ...declaration.getProperties().map((property) => property.getName()),
      ...declaration.getMethods().map((method) => method.getName()),
    ];
  }

  private extractTypeNamesFromNode(node: Node | undefined): readonly string[] {
    return this.extractTypeNamesFromText(node?.getText());
  }

  private extractTypeNamesFromText(text: string | undefined): readonly string[] {
    if (!text) {
      return [];
    }

    const names = new Set<string>();
    for (const match of text.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
      const candidate = match[0];
      if (TYPE_KEYWORDS.has(candidate) || BUILTIN_TYPE_NAMES.has(candidate)) {
        continue;
      }

      names.add(candidate);
    }

    return [...names];
  }

  private isVoidLikeType(typeText: string): boolean {
    const normalized = typeText.replace(/\s+/g, "");
    return (
      normalized === "void" ||
      normalized === "Promise<void>" ||
      normalized === "PromiseLike<void>"
    );
  }

  private isPromiseLikeType(typeText: string): boolean {
    const normalized = typeText.replace(/\s+/g, "");
    return (
      normalized.startsWith("Promise<") ||
      normalized.startsWith("PromiseLike<")
    );
  }

}

function topLevelValueDeclarationKindFor(
  kind: VariableDeclarationKind,
): ArchitectureTopLevelValueDeclarationKind | undefined {
  switch (kind) {
    case VariableDeclarationKind.Const:
      return "const";
    case VariableDeclarationKind.Let:
      return "let";
    case VariableDeclarationKind.Var:
      return "var";
    case VariableDeclarationKind.AwaitUsing:
    case VariableDeclarationKind.Using:
      return undefined;
  }
}

function repoRelativePathFromURLs(fileURL: URL, rootURL: URL): string {
  const rootPath = path.normalize(fileURLToPath(rootURL));
  const filePath = path.normalize(fileURLToPath(fileURL));
  const relativePath = path.relative(rootPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return path.basename(filePath);
  }

  return relativePath.split(path.sep).join("/");
}

function coordinateFor(node: Node): SourceCoordinate {
  return node.getSourceFile().getLineAndColumnAtPos(node.getStart());
}

function assignedNameForConstruction(
  newExpression: NewExpression,
): string | undefined {
  const parent = newExpression.getParent();

  if (Node.isVariableDeclaration(parent)) {
    const nameNode = parent.getNameNode();
    return Node.isIdentifier(nameNode) ? nameNode.getText() : undefined;
  }

  if (Node.isPropertyDeclaration(parent)) {
    return parent.getName();
  }

  if (
    Node.isBinaryExpression(parent) &&
    parent.getOperatorToken().getKind() === SyntaxKind.EqualsToken &&
    parent.getRight() === newExpression
  ) {
    return assignedNameFromExpression(parent.getLeft());
  }

  return undefined;
}

function assignedNameFromExpression(expression: Expression): string | undefined {
  if (Node.isIdentifier(expression)) {
    return expression.getText();
  }

  if (Node.isPropertyAccessExpression(expression)) {
    return expression.getName();
  }

  return undefined;
}

function isCapitalizedIdentifier(name: string): boolean {
  if (name.length === 0) {
    return false;
  }

  const first = name.charAt(0);
  return first >= "A" && first <= "Z";
}
