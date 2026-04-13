import test from "node:test";
import assert from "node:assert/strict";

import {
  InfrastructureApplicationContractBehaviorAttachmentPolicy,
  InfrastructureCrossLayerProtocolConformancePolicy,
  InfrastructureErrorsPlacementPolicy,
  InfrastructureErrorsShapePolicy,
  InfrastructureForbiddenPresentationDependencyPolicy,
  InfrastructureRepositoriesShapePolicy,
  InfrastructureTranslationDirectionalNamingPolicy,
  makeInfrastructureArchitecturePolicies,
} from "../../src/Domain/Policies/InfrastructureArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("infrastructure repositories shape flags protocol declarations in repository files", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    topLevelDeclarations: [
      {
        name: "OrderRepositoryProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new InfrastructureRepositoriesShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, InfrastructureRepositoriesShapePolicy.ruleID);
});

test("infrastructure translation directional naming flags non-directional boundary crossing method names", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Translation/Models/OrderProjectionModel.ts",
    roleFolder: RoleFolder.InfrastructureTranslationModels,
    topLevelDeclarations: [
      {
        name: "OrderProjectionModel",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
    methodDeclarations: [
      {
        enclosingTypeName: "OrderProjectionModel",
        name: "mapOrder",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: ["OrderResponseDTO"],
        hasExplicitReturnType: true,
        returnTypeDescription: "Order",
        returnTypeNames: ["Order"],
        returnsVoidLike: false,
        coordinate: coordinate(4),
      },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "Order",
      layer: ArchitectureLayer.Domain,
      roleFolder: RoleFolder.None,
    }),
  ]);

  const diagnostics = new InfrastructureTranslationDirectionalNamingPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureTranslationDirectionalNamingPolicy.ruleID,
  );
});

test("infrastructure errors shape requires StructuredErrorProtocol and full member surface", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Errors/OrderGatewayError.ts",
    roleFolder: RoleFolder.InfrastructureErrors,
    topLevelDeclarations: [
      {
        name: "OrderGatewayError",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: ["code", "message"],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new InfrastructureErrorsShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, InfrastructureErrorsShapePolicy.ruleID);
  assert.equal(diagnostics[1]?.ruleID, InfrastructureErrorsShapePolicy.ruleID);
});

test("infrastructure errors placement flags structured errors outside Infrastructure/Errors", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Gateways/OrderGatewayError.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    topLevelDeclarations: [
      {
        name: "OrderGatewayError",
        kind: NominalKind.Struct,
        inheritedTypeNames: ["StructuredErrorProtocol"],
        memberNames: ["code", "message", "retryable", "details"],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new InfrastructureErrorsPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureErrorsPlacementPolicy.ruleID,
  );
});

test("infrastructure forbidden presentation dependency flags presentation references once per type", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    typeReferences: [
      { name: "OrderViewModel", coordinate: coordinate(7) },
      { name: "OrderViewModel", coordinate: coordinate(14) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "OrderViewModel",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationViewModels,
      repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureForbiddenPresentationDependencyPolicy().evaluate(
      file,
      context,
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureForbiddenPresentationDependencyPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 7);
});

test("infrastructure cross-layer protocol conformance flags adapters without inward protocol seams", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    topLevelDeclarations: [
      {
        name: "OrderRepository",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(3),
      },
    ],
  });

  const diagnostics =
    new InfrastructureCrossLayerProtocolConformancePolicy().evaluate(
      file,
      new ProjectContext([]),
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureCrossLayerProtocolConformancePolicy.ruleID,
  );
});

test("infrastructure application contract behavior attachment flags methods attached to application contracts", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Translation/Models/OrderWorkflowContract+Projection.ts",
    roleFolder: RoleFolder.InfrastructureTranslationModels,
    methodDeclarations: [
      {
        enclosingTypeName: "OrderWorkflowContract",
        name: "toInfrastructureError",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: [],
        hasExplicitReturnType: true,
        returnTypeDescription: "OrderGatewayError",
        returnTypeNames: ["OrderGatewayError"],
        returnsVoidLike: false,
        coordinate: coordinate(8),
      },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "OrderWorkflowContract",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
      repoRelativePath:
        "Symphony/Application/Contracts/Workflow/OrderWorkflowContract.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureApplicationContractBehaviorAttachmentPolicy().evaluate(
      file,
      context,
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureApplicationContractBehaviorAttachmentPolicy.ruleID,
  );
});

test("makeInfrastructureArchitecturePolicies returns the full infrastructure rule set", () => {
  assert.equal(makeInfrastructureArchitecturePolicies().length, 37);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer?: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
  readonly methodDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["methodDeclarations"];
  readonly typeReferences?: ConstructorParameters<typeof ArchitectureFile>[0]["typeReferences"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer ?? ArchitectureLayer.Infrastructure,
      roleFolder: input.roleFolder,
      pathComponents: input.repoRelativePath.split("/"),
      fileName: input.repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
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
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: input.typeReferences ?? [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    nestedNominalDeclarations: [],
  });
}

function indexedDeclaration(input: {
  readonly name: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly repoRelativePath?: string;
}) {
  return {
    name: input.name,
    kind: NominalKind.Struct,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: input.repoRelativePath ?? `${input.name}.ts`,
    layer: input.layer,
    roleFolder: input.roleFolder,
  } as const;
}

function coordinate(line: number) {
  return { line, column: 1 } as const;
}
