import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { TestsDiagnosticsLocationPolicy } from "../../src/Domain/Policies/TestArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";
import { ArchitectureLinterConfigurationModel } from "../../src/Infrastructure/translation/models/ArchitectureLinterConfigurationModel.ts";

test("diagnostics location policy uses configured diagnostics subpath", () => {
  const policy = new TestsDiagnosticsLocationPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    testRootName: "SampleTests",
    diagnosticsSubpath: "Diagnostics/Architecture",
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
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    testRootName: "SymphonyTests",
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

test("configuration model parses domain outer artifact string literal extensions", () => {
  const configuration = new ArchitectureLinterConfigurationModel().toDomain(
    JSON.stringify({
      ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      domainOuterArtifactFragments: ["vendor claim"],
      storageNamespacePrefixes: ["tenant.cache"],
      providerSurfaceTerms: ["planetscale"],
      maxServiceUseCaseDependencies: 10,
      maxUseCasesPerServiceMethod: 6,
    }),
  );

  assert.deepEqual(configuration?.domainOuterArtifactFragments, [
    "vendor claim",
  ]);
  assert.deepEqual(configuration?.storageNamespacePrefixes, ["tenant.cache"]);
  assert.deepEqual(configuration?.providerSurfaceTerms, ["planetscale"]);
  assert.equal(configuration?.maxServiceUseCaseDependencies, 10);
  assert.equal(configuration?.maxUseCasesPerServiceMethod, 6);
});

test("configuration model defaults Application Service cardinality caps", () => {
  const configuration = new ArchitectureLinterConfigurationModel().toDomain(
    JSON.stringify({
      ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      maxServiceUseCaseDependencies: undefined,
      maxUseCasesPerServiceMethod: undefined,
    }),
  );

  assert.equal(configuration?.maxServiceUseCaseDependencies, 8);
  assert.equal(configuration?.maxUseCasesPerServiceMethod, 5);
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
