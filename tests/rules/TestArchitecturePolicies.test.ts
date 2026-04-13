import test from "node:test";
import assert from "node:assert/strict";

import {
  TestsImportOwnershipPolicy,
  TestsLinterHarnessExtractionPolicy,
  TestsRuntimeLayeredLocationPolicy,
  TestsSharedSupportPlacementPolicy,
  TestsTestDoublesOnlySupportPolicy,
  makeTestArchitecturePolicies,
} from "../../src/domain/policies/TestArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/domain/value-objects/ArchitectureFile.ts";
import type { ArchitectureMethodDeclaration } from "../../src/domain/value-objects/ArchitectureMethodDeclaration.ts";
import type { ArchitectureNestedNominalDeclaration } from "../../src/domain/value-objects/ArchitectureNestedNominalDeclaration.ts";
import { ArchitectureLayer } from "../../src/domain/value-objects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/domain/value-objects/FileClassification.ts";
import { NominalKind } from "../../src/domain/value-objects/NominalKind.ts";
import { ProjectContext } from "../../src/domain/value-objects/ProjectContext.ts";
import { RoleFolder } from "../../src/domain/value-objects/RoleFolder.ts";

const TEST_CONFIGURATION = {
  testRootName: "SymphonyTests",
  runtimeNamespaceSegments: [],
  diagnosticsSubpath: "Diagnostics/ArchitectureLinter",
  sourceExtensions: [".ts"],
  tsConfigFilePath: "tsconfig.json",
  moduleAliases: {
    runtimeSurface: ["SymphonyRuntime"],
    commandSurface: ["ArchitectureLinterCLI"],
    diagnostics: ["architecture-linter-ts"],
  },
  disabledRuleIDs: [],
  disabledRulePrefixes: [],
} as const;

test("runtime layered location flags a service suite outside the Application bucket", () => {
  const file = makeFile({
    repoRelativePath: "SymphonyTests/Infrastructure/OrderServiceTests.ts",
    topLevelDeclarations: [
      {
        name: "OrderServiceTests",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new TestsRuntimeLayeredLocationPolicy(
    TEST_CONFIGURATION,
  ).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, TestsRuntimeLayeredLocationPolicy.ruleID);
  assert.equal(
    diagnostics[0]?.message.includes("SymphonyTests/Application/"),
    true,
  );
});

test("shared support placement flags reusable support embedded in a runtime suite", () => {
  const file = makeFile({
    repoRelativePath: "SymphonyTests/Application/OrderServiceTests.ts",
    topLevelDeclarations: [
      {
        name: "OrderServiceTests",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
    nestedNominalDeclarations: [
      {
        enclosingTypeName: "OrderServiceTests",
        name: "OrderGatewaySpy",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(11),
      },
    ],
  });

  const diagnostics = new TestsSharedSupportPlacementPolicy(
    TEST_CONFIGURATION,
  ).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, TestsSharedSupportPlacementPolicy.ruleID);
  assert.equal(diagnostics[0]?.line, 11);
});

test("test doubles only support flags active suites under TestDoubles", () => {
  const file = makeFile({
    repoRelativePath: "SymphonyTests/TestDoubles/OrderServiceTests.ts",
    topLevelDeclarations: [
      {
        name: "OrderServiceTests",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(3),
      },
    ],
  });

  const diagnostics = new TestsTestDoublesOnlySupportPolicy(
    TEST_CONFIGURATION,
  ).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    TestsTestDoublesOnlySupportPolicy.ruleID,
  );
});

test("import ownership flags diagnostics suites that import runtime modules", () => {
  const file = makeFile({
    repoRelativePath:
      "SymphonyTests/Diagnostics/ArchitectureLinter/RuntimeLeakTests.ts",
    imports: [
      { moduleName: "architecture-linter-ts", coordinate: coordinate(1) },
      { moduleName: "SymphonyRuntime", coordinate: coordinate(2) },
    ],
    topLevelDeclarations: [
      {
        name: "RuntimeLeakTests",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(4),
      },
    ],
  });

  const diagnostics = new TestsImportOwnershipPolicy(
    TEST_CONFIGURATION,
  ).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, TestsImportOwnershipPolicy.ruleID);
  assert.equal(diagnostics[0]?.line, 2);
});

test("linter harness extraction flags reusable harness helpers outside diagnostics support", () => {
  const file = makeFile({
    repoRelativePath:
      "SymphonyTests/Diagnostics/ArchitectureLinter/DomainArchitecturePoliciesTests.ts",
    imports: [{ moduleName: "architecture-linter-ts", coordinate: coordinate(1) }],
    topLevelDeclarations: [
      {
        name: "DomainArchitecturePoliciesTests",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(4),
      },
    ],
    methodDeclarations: [
      {
        enclosingTypeName: "DomainArchitecturePoliciesTests",
        name: "lint",
        isStatic: false,
        isPublicOrOpen: false,
        isPrivateOrFileprivate: true,
        parameterTypeNames: [],
        hasExplicitReturnType: false,
        returnTypeNames: [],
        returnsVoidLike: true,
        coordinate: coordinate(18),
      },
    ],
  });

  const diagnostics = new TestsLinterHarnessExtractionPolicy(
    TEST_CONFIGURATION,
  ).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    TestsLinterHarnessExtractionPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 18);
});

test("makeTestArchitecturePolicies returns the full test policy set", () => {
  assert.equal(makeTestArchitecturePolicies(TEST_CONFIGURATION).length, 9);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly imports?: ConstructorParameters<typeof ArchitectureFile>[0]["imports"];
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
  readonly nestedNominalDeclarations?: readonly ArchitectureNestedNominalDeclaration[];
  readonly methodDeclarations?: readonly ArchitectureMethodDeclaration[];
}): ArchitectureFile {
  const pathComponents = input.repoRelativePath.split("/");

  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: ArchitectureLayer.Tests,
      roleFolder: RoleFolder.None,
      pathComponents,
      fileName: pathComponents.at(-1) ?? "unknown.ts",
      fileStem: (pathComponents.at(-1) ?? "unknown.ts").replace(/\.[^.]+$/, ""),
    }),
    imports: input.imports ?? [],
    functionTypeOccurrences: [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: input.methodDeclarations ?? [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    nestedNominalDeclarations: input.nestedNominalDeclarations ?? [],
  });
}

function coordinate(line: number, column = 1) {
  return { line, column };
}
