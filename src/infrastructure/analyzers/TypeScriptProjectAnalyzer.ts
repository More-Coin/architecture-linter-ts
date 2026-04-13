import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  Node,
  Project,
  Scope,
  ScriptTarget,
  SyntaxKind,
  ts,
  type ClassDeclaration,
  type Expression,
  type GetAccessorDeclaration,
  type Identifier,
  type InterfaceDeclaration,
  type MethodDeclaration,
  type MethodSignature,
  type NewExpression,
  type ParameterDeclaration,
  type PropertyDeclaration,
  type SourceFile,
} from "ts-morph";

import type { ArchitectureLinterConfiguration } from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import { ArchitecturePathClassificationPolicy } from "../../domain/policies/ArchitecturePathClassificationPolicy.ts";
import { ArchitectureFile } from "../../domain/value-objects/ArchitectureFile.ts";
import { NominalKind } from "../../domain/value-objects/NominalKind.ts";
import type { SourceCoordinate } from "../../domain/value-objects/SourceCoordinate.ts";
import { LinterRepoRelativePathModel } from "../translation/LinterRepoRelativePathModel.ts";

const BUILTIN_TYPE_NAMES = new Set([
  "Array",
  "Promise",
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

export class TypeScriptProjectAnalyzer {
  private readonly repoRelativePathModel = new LinterRepoRelativePathModel();
  private readonly classifier: ArchitecturePathClassificationPolicy;

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration,
  ) {
    this.classifier = new ArchitecturePathClassificationPolicy(configuration);
  }

  analyzeProject(
    rootURL: URL,
    fileURLs: readonly URL[],
  ): readonly ArchitectureFile[] {
    const project = this.makeProject(rootURL);
    const filePaths = fileURLs.map((fileURL) => fileURLToPath(fileURL));

    project.addSourceFilesAtPaths(filePaths);
    project.resolveSourceFileDependencies();

    return filePaths.flatMap((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }

      return [this.toArchitectureFile(sourceFile, rootURL)];
    });
  }

  private makeProject(rootURL: URL): Project {
    const rootPath = fileURLToPath(rootURL);
    const tsConfigPath = path.join(rootPath, this.configuration.tsConfigFilePath);

    if (fs.existsSync(tsConfigPath)) {
      return new Project({
        tsConfigFilePath: tsConfigPath,
        skipAddingFilesFromTsConfig: true,
      });
    }

    return new Project({
      compilerOptions: {
        target: ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        allowJs: false,
      },
    });
  }

  private toArchitectureFile(sourceFile: SourceFile, rootURL: URL): ArchitectureFile {
    const repoRelativePath = this.repoRelativePathModel.fromURLs(
      pathToFileURL(sourceFile.getFilePath()),
      rootURL,
    );
    const classification = this.classifier.classify(repoRelativePath);
    const typeReferences = this.collectTypeReferences(sourceFile);
    const topLevelDeclarations = this.collectTopLevelDeclarations(sourceFile);
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

    return new ArchitectureFile({
      repoRelativePath,
      classification,
      imports: sourceFile.getImportDeclarations().map((declaration) => ({
        moduleName: declaration.getModuleSpecifierValue(),
        coordinate: this.coordinateFor(declaration.getModuleSpecifier()),
      })),
      functionTypeOccurrences: sourceFile
        .getDescendantsOfKind(SyntaxKind.FunctionType)
        .map((node) => ({
          coordinate: this.coordinateFor(node),
        })),
      identifierOccurrences: sourceFile
        .getDescendantsOfKind(SyntaxKind.Identifier)
        .map((identifier) => ({
          name: identifier.getText(),
          coordinate: this.coordinateFor(identifier),
        })),
      stringLiteralOccurrences: sourceFile
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .map((literal) => ({
          value: literal.getLiteralValue(),
          coordinate: this.coordinateFor(literal),
        })),
      typedMemberOccurrences,
      memberCallOccurrences,
      methodDeclarations,
      constructorDeclarations,
      computedPropertyDeclarations,
      storedMemberDeclarations,
      operationalUseOccurrences,
      typeReferences,
      topLevelDeclarations,
      nestedNominalDeclarations: [],
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
            coordinate: this.coordinateFor(statement.getNameNode() ?? statement),
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
            coordinate: this.coordinateFor(statement.getNameNode()),
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
            coordinate: this.coordinateFor(statement.getNameNode()),
          },
        ];
      }

      if (Node.isTypeAliasDeclaration(statement)) {
        return [
          {
            name: statement.getName(),
            kind: NominalKind.Struct,
            inheritedTypeNames: [],
            memberNames: [],
            coordinate: this.coordinateFor(statement.getNameNode()),
          },
        ];
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
        coordinate: this.coordinateFor(constructorDeclaration),
      })),
    );
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
                coordinate: this.coordinateFor(parameter.getNameNode()),
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
        pushNames(node.getText(), this.coordinateFor(node));
        continue;
      }

      if (Node.isExpressionWithTypeArguments(node)) {
        pushNames(node.getText(), this.coordinateFor(node));
        continue;
      }

      if (Node.isHeritageClause(node)) {
        pushNames(node.getText(), this.coordinateFor(node));
        continue;
      }

      if (Node.isNewExpression(node)) {
        pushNames(node.getExpression().getText(), this.coordinateFor(node));
      }
    }

    return [...references.entries()].map(([name, coordinate]) => ({
      name,
      coordinate,
    }));
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
            coordinate: this.coordinateFor(callExpression),
          });
          operationalUseOccurrences.push({
            enclosingTypeName: typeName,
            enclosingMethodName: method.getName(),
            baseName: occurrence.baseName,
            memberName: occurrence.memberName,
            coordinate: this.coordinateFor(callExpression),
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
            coordinate: this.coordinateFor(newExpression),
          });
        }
      }
    }

    return { memberCallOccurrences, operationalUseOccurrences };
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
      coordinate: this.coordinateFor(declaration.getNameNode()),
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
      coordinate: this.coordinateFor(declaration.getNameNode()),
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
      coordinate: this.coordinateFor(declaration.getNameNode()),
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
      coordinate: this.coordinateFor(declaration.getNameNode()),
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

  private coordinateFor(node: Node): SourceCoordinate {
    return node.getSourceFile().getLineAndColumnAtPos(node.getStart());
  }
}
