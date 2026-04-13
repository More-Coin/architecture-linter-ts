import test from "node:test";
import assert from "node:assert/strict";

import { TestsDiagnosticsLocationPolicy } from "../../src/domain/policies/TestArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/domain/value-objects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/domain/value-objects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/domain/value-objects/FileClassification.ts";
import { NominalKind } from "../../src/domain/value-objects/NominalKind.ts";
import { ProjectContext } from "../../src/domain/value-objects/ProjectContext.ts";
import { RoleFolder } from "../../src/domain/value-objects/RoleFolder.ts";

test("diagnostics location policy uses configured diagnostics subpath", () => {
  const policy = new TestsDiagnosticsLocationPolicy({
    testRootName: "SampleTests",
    runtimeNamespaceSegments: [],
    diagnosticsSubpath: "Diagnostics/Architecture",
    sourceExtensions: [".ts"],
    tsConfigFilePath: "tsconfig.json",
    moduleAliases: {
      runtimeSurface: [],
      commandSurface: [],
      diagnostics: ["architecture-linter-ts"],
    },
    disabledRuleIDs: [],
    disabledRulePrefixes: [],
  });

  const file = makeFile({
    repoRelativePath: "SampleTests/Application/FooDiagnosticsTests.ts",
    imports: [{ moduleName: "architecture-linter-ts", coordinate: coordinate(1) }],
    topLevelDeclarations: [
      {
        name: "FooDiagnosticsTests",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = policy.evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.message.includes("SampleTests/Diagnostics/Architecture/"),
    true,
  );
});

test("diagnostics location policy accepts nested package test root", () => {
  const policy = new TestsDiagnosticsLocationPolicy({
    testRootName: "SymphonyTests",
    runtimeNamespaceSegments: [],
    diagnosticsSubpath: "Diagnostics/ArchitectureLinter",
    sourceExtensions: [".ts"],
    tsConfigFilePath: "tsconfig.json",
    moduleAliases: {
      runtimeSurface: [],
      commandSurface: [],
      diagnostics: ["architecture-linter-ts"],
    },
    disabledRuleIDs: [],
    disabledRulePrefixes: [],
  });

  const file = makeFile({
    repoRelativePath:
      "Packages/ArchitectureLinter/ArchitectureLinterTests/Diagnostics/ArchitectureLinter/FooDiagnosticsTests.ts",
    pathComponents: [
      "Packages",
      "ArchitectureLinter",
      "ArchitectureLinterTests",
      "Diagnostics",
      "ArchitectureLinter",
      "FooDiagnosticsTests.ts",
    ],
    imports: [{ moduleName: "architecture-linter-ts", coordinate: coordinate(1) }],
    topLevelDeclarations: [
      {
        name: "FooDiagnosticsTests",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = policy.evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 0);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly pathComponents?: readonly string[];
  readonly imports?: ConstructorParameters<typeof ArchitectureFile>[0]["imports"];
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
}): ArchitectureFile {
  const pathComponents = input.pathComponents ?? input.repoRelativePath.split("/");

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
    methodDeclarations: [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    nestedNominalDeclarations: [],
  });
}

function coordinate(line: number, column = 1) {
  return { line, column };
}
