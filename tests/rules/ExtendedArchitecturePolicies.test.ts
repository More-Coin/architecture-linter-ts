import test from "node:test";
import assert from "node:assert/strict";

import {
  ArchitectureUnclassifiedSourcePolicy,
  ArchitectureUnknownRoleSubdirectoryPolicy,
} from "../../src/Domain/Policies/ExtendedArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("architecture.unclassified_source flags unclassified executable source files", () => {
  const diagnostics = new ArchitectureUnclassifiedSourcePolicy().evaluate(
    makeFile({
      repoRelativePath: "WidgetExtension/ProjectionContract.ts",
      layer: ArchitectureLayer.Other,
      roleFolder: RoleFolder.None,
      topLevelDeclarations: [
        declaration("ProjectionContractProtocol", NominalKind.Protocol, 3, 18),
        declaration("ProjectionKind", NominalKind.Enum, 7, 13),
        declaration("ProjectionContract", NominalKind.Struct, 11, 15),
      ],
    }),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    ArchitectureUnclassifiedSourcePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 11);
  assert.equal(diagnostics[0]?.column, 15);
  assert.match(diagnostics[0]?.message ?? "", /layer 'other'/);
});

test("architecture.unclassified_source does not flag test files", () => {
  const diagnostics = new ArchitectureUnclassifiedSourcePolicy().evaluate(
    makeFile({
      repoRelativePath: "ArchitectureLinterTSTests/WidgetExtensionTests.ts",
      layer: ArchitectureLayer.Tests,
      roleFolder: RoleFolder.None,
    }),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("architecture.unclassified_source does not flag classified source files", () => {
  const diagnostics = new ArchitectureUnclassifiedSourcePolicy().evaluate(
    makeFile({
      repoRelativePath: "Application/UseCases/FetchOrderUseCase.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("architecture.unclassified_source does not flag root project config files", () => {
  const policy = new ArchitectureUnclassifiedSourcePolicy();

  for (const fileName of [
    "package.json",
    "tsconfig.json",
    "tsup.config.ts",
  ]) {
    const diagnostics = policy.evaluate(
      makeFile({
        repoRelativePath: fileName,
        layer: ArchitectureLayer.Other,
        roleFolder: RoleFolder.None,
      }),
      new ProjectContext([]),
    );

    assert.equal(diagnostics.length, 0, fileName);
  }
});

test("architecture.unknown_role_subdirectory flags unknown Application subdirectories at the primary declaration", () => {
  const diagnostics = new ArchitectureUnknownRoleSubdirectoryPolicy().evaluate(
    makeFile({
      repoRelativePath: "src/Application/Helpers/OrderProjectionHelper.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.None,
      topLevelDeclarations: [
        declaration("OrderProjectionHelperProtocol", NominalKind.Protocol, 3, 18),
        declaration("OrderProjectionKind", NominalKind.Enum, 7, 13),
        declaration("OrderProjectionHelper", NominalKind.Class, 11, 14),
      ],
    }),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    ArchitectureUnknownRoleSubdirectoryPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 11);
  assert.equal(diagnostics[0]?.column, 14);
  assert.match(diagnostics[0]?.message ?? "", /unrecognized Application subdirectory/);
  assert.match(diagnostics[0]?.message ?? "", /no role folder/);
  assert.match(diagnostics[0]?.message ?? "", /no role-gated rule can evaluate/);
});

test("architecture.unknown_role_subdirectory gives Application Policies domain-policy guidance", () => {
  const diagnostics = new ArchitectureUnknownRoleSubdirectoryPolicy().evaluate(
    makeFile({
      repoRelativePath: "src/Application/Policies/DiscountPolicy.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.None,
      topLevelDeclarations: [
        declaration("DiscountPolicy", NominalKind.Class, 4, 14),
      ],
    }),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0]?.message ?? "", /Application source file/);
  assert.match(diagnostics[0]?.message ?? "", /Domain\/Policies/);
  assert.match(diagnostics[0]?.message ?? "", /another appropriate role|Presentation/);
});

test("architecture.unknown_role_subdirectory flags unknown Presentation and App subdirectories", () => {
  const policy = new ArchitectureUnknownRoleSubdirectoryPolicy();

  const presentationDiagnostics = policy.evaluate(
    makeFile({
      repoRelativePath: "src/Presentation/Widgets/OrderWidget.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.None,
      topLevelDeclarations: [
        declaration("OrderWidget", NominalKind.Class, 5, 14),
      ],
    }),
    new ProjectContext([]),
  );
  const appDiagnostics = policy.evaluate(
    makeFile({
      repoRelativePath: "src/App/Factories/AppFactory.ts",
      layer: ArchitectureLayer.App,
      roleFolder: RoleFolder.None,
      topLevelDeclarations: [
        declaration("AppFactoryProtocol", NominalKind.Protocol, 2, 18),
      ],
    }),
    new ProjectContext([]),
  );

  assert.equal(presentationDiagnostics.length, 1);
  assert.equal(appDiagnostics.length, 1);
  assert.match(
    presentationDiagnostics[0]?.message ?? "",
    /unrecognized Presentation subdirectory/,
  );
  assert.match(appDiagnostics[0]?.message ?? "", /unrecognized App subdirectory/);
  assert.equal(appDiagnostics[0]?.line, 2);
  assert.equal(appDiagnostics[0]?.column, 18);
});

test("architecture.unknown_role_subdirectory does not handle Infrastructure unknown subdirectories", () => {
  const diagnostics = new ArchitectureUnknownRoleSubdirectoryPolicy().evaluate(
    makeFile({
      repoRelativePath: "src/Infrastructure/Clients/StripeClient.ts",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.None,
      topLevelDeclarations: [
        declaration("StripeClient", NominalKind.Class, 4, 14),
      ],
    }),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly topLevelDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["topLevelDeclarations"];
}): ArchitectureFile {
  const pathComponents = input.repoRelativePath.split("/");
  const fileName = pathComponents.at(-1) ?? "unknown.ts";

  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer,
      roleFolder: input.roleFolder,
      pathComponents,
      fileName,
      fileStem: fileName.replace(/\.[^.]+$/, ""),
    }),
    topLevelDeclarations: input.topLevelDeclarations ?? [],
  });
}

function declaration(
  name: string,
  kind: NominalKind,
  line: number,
  column: number,
) {
  return {
    name,
    kind,
    inheritedTypeNames: [],
    memberNames: [],
    coordinate: { line, column },
  };
}
