import test from "node:test";
import assert from "node:assert/strict";

import {
  AppConfigurationShapePolicy,
  AppDependencyInjectionShapePolicy,
  AppRuntimeShapePolicy,
  CompositionRootInwardReferencePolicy,
  makeAppCompositionPolicies,
} from "../../src/domain/policies/AppCompositionPolicies.ts";
import { ProjectContext } from "../../src/domain/value-objects/ProjectContext.ts";
import { ArchitectureFile } from "../../src/domain/value-objects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/domain/value-objects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/domain/value-objects/FileClassification.ts";
import { NominalKind } from "../../src/domain/value-objects/NominalKind.ts";
import { RoleFolder } from "../../src/domain/value-objects/RoleFolder.ts";

test("AppConfigurationShapePolicy flags protocol declarations in App/Configuration", () => {
  const file = makeFile({
    repoRelativePath: "src/app/configuration/BadConfig.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppConfiguration,
    topLevelDeclarations: [
      {
        name: "ConfigurationLoaderProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 4, column: 1 },
      },
    ],
  });

  const diagnostics = new AppConfigurationShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, AppConfigurationShapePolicy.ruleID);
  assert.match(diagnostics[0]?.message ?? "", /declares protocol/);
  assert.match(diagnostics[1]?.message ?? "", /exposes no concrete type ending in 'Configuration'/);
});

test("AppRuntimeShapePolicy ignores files outside App/Runtime", () => {
  const file = makeFile({
    repoRelativePath: "src/app/configuration/ArchitectureLinterConfiguration.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppConfiguration,
    topLevelDeclarations: [
      {
        name: "ArchitectureLinterConfiguration",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new AppRuntimeShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.deepEqual(diagnostics, []);
});

test("AppDependencyInjectionShapePolicy requires a DI suffix", () => {
  const file = makeFile({
    repoRelativePath: "src/app/dependency-injection/ArchitectureLinter.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppDependencyInjection,
    topLevelDeclarations: [
      {
        name: "ArchitectureLinter",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 3, column: 1 },
      },
    ],
  });

  const diagnostics = new AppDependencyInjectionShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.match(diagnostics[0]?.message ?? "", /does not end in 'DI'/);
  assert.match(diagnostics[1]?.message ?? "", /exposes no concrete type ending in 'DI'/);
});

test("CompositionRootInwardReferencePolicy flags app-layer references from presentation once per type", () => {
  const file = makeFile({
    repoRelativePath: "src/presentation/controllers/ArchitectureLinterController.ts",
    layer: ArchitectureLayer.Presentation,
    roleFolder: RoleFolder.PresentationControllers,
    typeReferences: [
      { name: "ArchitectureLinterDI", coordinate: { line: 7, column: 10 } },
      { name: "ArchitectureLinterDI", coordinate: { line: 10, column: 2 } },
    ],
  });
  const context = new ProjectContext([
    {
      name: "ArchitectureLinterDI",
      kind: NominalKind.Class,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/app/dependency-injection/ArchitectureLinterDI.ts",
      layer: ArchitectureLayer.App,
      roleFolder: RoleFolder.AppDependencyInjection,
    },
  ]);

  const diagnostics = new CompositionRootInwardReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    CompositionRootInwardReferencePolicy.ruleID,
  );
  assert.match(
    diagnostics[0]?.message ?? "",
    /must not be referenced from presentation/,
  );
  assert.equal(diagnostics[0]?.line, 7);
});

test("makeAppCompositionPolicies returns the full app composition rule set", () => {
  assert.equal(makeAppCompositionPolicies().length, 4);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
  readonly typeReferences?: ConstructorParameters<typeof ArchitectureFile>[0]["typeReferences"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer,
      roleFolder: input.roleFolder,
      pathComponents: input.repoRelativePath.split("/"),
      fileName: input.repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
    }),
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    typeReferences: input.typeReferences ?? [],
  });
}
