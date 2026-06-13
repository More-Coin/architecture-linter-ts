import test from "node:test";
import assert from "node:assert/strict";

import {
  ApplicationContractsPassiveCarrierSurfacePolicy,
} from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { RICH_REMEDIATION_MARKERS } from "../../src/Domain/Policies/shared/RichRemediationMessage.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("application.contracts.passive_carrier_surface flags static contract registries", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderResultContract.ts",
    roleFolder: RoleFolder.ApplicationContractsWorkflow,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderResultContract",
        name: "current",
        typeNames: ["OrderResultContract"],
        isStatic: true,
        coordinate: { line: 4, column: 17 },
      },
    ],
  });

  const diagnostics = new ApplicationContractsPassiveCarrierSurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.contracts.passive_carrier_surface");
  assert.equal(diagnostics[0]!.line, 4);
  assert.ok(diagnostics[0]!.message.includes("'current'"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.contracts.passive_carrier_surface flags top-level contract registries", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderResultContract.ts",
    roleFolder: RoleFolder.ApplicationContractsWorkflow,
    topLevelValueDeclarations: [
      {
        name: "live",
        kind: "const",
        isExported: true,
        coordinate: { line: 3, column: 14 },
      },
    ],
  });

  const diagnostics = new ApplicationContractsPassiveCarrierSurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.line, 3);
  assert.ok(diagnostics[0]!.message.includes("'live'"));
});

test("application.contracts.passive_carrier_surface flags factory methods and private static helpers", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Contracts/Commands/CreateOrderContract.ts",
    roleFolder: RoleFolder.ApplicationContractsCommands,
    methodDeclarations: [
      {
        enclosingTypeName: "CreateOrderContract",
        name: "makeDefault",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: [],
        hasExplicitReturnType: true,
        returnTypeDescription: "CreateOrderContract",
        returnTypeNames: ["CreateOrderContract"],
        returnsVoidLike: false,
        coordinate: { line: 8, column: 3 },
      },
      {
        enclosingTypeName: "CreateOrderContract",
        name: "normalize",
        isStatic: true,
        isPublicOrOpen: false,
        isPrivateOrFileprivate: true,
        parameterTypeNames: [],
        hasExplicitReturnType: true,
        returnTypeDescription: "string",
        returnTypeNames: [],
        returnsVoidLike: false,
        coordinate: { line: 12, column: 18 },
      },
    ],
  });

  const diagnostics = new ApplicationContractsPassiveCarrierSurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.line),
    [8, 12],
  );
  assert.ok(diagnostics[0]!.message.includes("'makeDefault'"));
  assert.ok(diagnostics[1]!.message.includes("'normalize'"));
});

test("application.contracts.passive_carrier_surface flags Intl formatting in contracts", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Contracts/Workflow/PriceContract.ts",
    roleFolder: RoleFolder.ApplicationContractsWorkflow,
    constructionOccurrences: [
      {
        typeName: "Intl.NumberFormat",
        coordinate: { line: 6, column: 14 },
      },
    ],
    staticMemberAccessOccurrences: [
      {
        baseName: "Intl",
        memberName: "DateTimeFormat",
        coordinate: { line: 9, column: 12 },
      },
    ],
  });

  const diagnostics = new ApplicationContractsPassiveCarrierSurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.line),
    [6, 9],
  );
});

test("application.contracts.passive_carrier_surface allows passive contract fields", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderResultContract.ts",
    roleFolder: RoleFolder.ApplicationContractsWorkflow,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderResultContract",
        name: "status",
        typeNames: ["OrderStatusContract"],
        isStatic: false,
        coordinate: { line: 4, column: 12 },
      },
    ],
  });

  const diagnostics = new ApplicationContractsPassiveCarrierSurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("application.contracts.passive_carrier_surface applies only to Application contracts", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    methodDeclarations: [
      {
        enclosingTypeName: "OrderService",
        name: "makeDefault",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: [],
        hasExplicitReturnType: true,
        returnTypeDescription: "OrderService",
        returnTypeNames: ["OrderService"],
        returnsVoidLike: false,
        coordinate: { line: 5, column: 3 },
      },
    ],
  });

  const diagnostics = new ApplicationContractsPassiveCarrierSurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("application.contracts.passive_carrier_surface is registered by default and can be disabled", () => {
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) =>
        policy.constructor === ApplicationContractsPassiveCarrierSurfacePolicy,
    ),
  );

  const disabledPolicies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationContractsPassiveCarrierSurfacePolicy.ruleID],
  });

  assert.ok(
    !disabledPolicies.some(
      (policy) =>
        policy.constructor === ApplicationContractsPassiveCarrierSurfacePolicy,
    ),
  );
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly roleFolder: RoleFolder;
  readonly storedMemberDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["storedMemberDeclarations"];
  readonly methodDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["methodDeclarations"];
  readonly constructionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["constructionOccurrences"];
  readonly staticMemberAccessOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["staticMemberAccessOccurrences"];
  readonly topLevelValueDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["topLevelValueDeclarations"];
}): ArchitectureFile {
  const pathComponents = input.repoRelativePath.split("/");

  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: ArchitectureLayer.Application,
      roleFolder: input.roleFolder,
      pathComponents,
      fileName: pathComponents.at(-1) ?? "unknown.ts",
      fileStem: pathComponents.at(-1)?.replace(/\.[^.]+$/, "") ?? "unknown",
    }),
    imports: [],
    functionTypeOccurrences: [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: input.methodDeclarations ?? [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: input.storedMemberDeclarations ?? [],
    operationalUseOccurrences: [],
    typeReferences: [],
    topLevelDeclarations: [
      {
        name: input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? "Contract",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
    topLevelValueDeclarations: input.topLevelValueDeclarations ?? [],
    nestedNominalDeclarations: [],
    constructionOccurrences: input.constructionOccurrences ?? [],
    staticMemberAccessOccurrences: input.staticMemberAccessOccurrences ?? [],
    decoratorOccurrences: [],
    dependencyResolutionOccurrences: [],
  });
}
