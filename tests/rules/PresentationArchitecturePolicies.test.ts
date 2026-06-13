import test from "node:test";
import assert from "node:assert/strict";

import {
  PresentationControllerShapePolicy,
  PresentationControllersFunctionSeamPolicy,
  PresentationControllersUseCaseReferencePolicy,
  PresentationCrossLayerWireLiteralPolicy,
  PresentationDTOsShapePolicy,
  PresentationErrorsPlacementPolicy,
  PresentationInfrastructureReferencePolicy,
  PresentationStateTransitionReferencePolicy,
  PresentationViewsShapePolicy,
  makePresentationArchitecturePolicies,
} from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("presentation controller shape flags controller files without a controller type", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderHandler.ts",
    roleFolder: RoleFolder.PresentationControllers,
    topLevelDeclarations: [
      {
        name: "OrderHandler",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new PresentationControllerShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, PresentationControllerShapePolicy.ruleID);
});

test("presentation controllers use case reference flags direct use case dependencies", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    typeReferences: [{ name: "FetchOrderUseCase", coordinate: coordinate(7) }],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "FetchOrderUseCase",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
      repoRelativePath:
        "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    }),
  ]);

  const diagnostics = new PresentationControllersUseCaseReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationControllersUseCaseReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 7);
});

test("presentation controllers function seam flags closure-based workflow seams", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    functionTypeOccurrences: [{ coordinate: coordinate(11) }],
  });

  const diagnostics = new PresentationControllersFunctionSeamPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationControllersFunctionSeamPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 11);
});

test("presentation DTO shape flags behavioral and misnamed DTO declarations", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/DTOs/OrderPayload.ts",
    roleFolder: RoleFolder.PresentationDTOs,
    topLevelDeclarations: [
      {
        name: "OrderPayload",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(3),
      },
    ],
  });

  const diagnostics = new PresentationDTOsShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, PresentationDTOsShapePolicy.ruleID);
  assert.equal(diagnostics[1]?.ruleID, PresentationDTOsShapePolicy.ruleID);
});

test("presentation errors placement flags presentation errors outside Presentation/Errors", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderPresentationError.ts",
    roleFolder: RoleFolder.PresentationControllers,
    topLevelDeclarations: [
      {
        name: "OrderPresentationError",
        kind: NominalKind.Enum,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(5),
      },
    ],
  });

  const diagnostics = new PresentationErrorsPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationErrorsPlacementPolicy.ruleID,
  );
});

test("presentation infrastructure reference flags direct infrastructure dependencies once per type", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    typeReferences: [
      { name: "OrderGateway", coordinate: coordinate(9) },
      { name: "OrderGateway", coordinate: coordinate(12) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "OrderGateway",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath:
        "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    }),
  ]);

  const diagnostics = new PresentationInfrastructureReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationInfrastructureReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 9);
});

test("presentation infrastructure reference flags infrastructure construction occurrences", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    constructionOccurrences: [
      { typeName: "SqlOrderRepository", coordinate: coordinate(14) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "SqlOrderRepository",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
      repoRelativePath:
        "Symphony/Infrastructure/Repositories/SqlOrderRepository.ts",
    }),
  ]);

  const diagnostics = new PresentationInfrastructureReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationInfrastructureReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 14);
});

test("presentation infrastructure reference flags infrastructure static member access occurrences", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    staticMemberAccessOccurrences: [
      {
        baseName: "SqlOrderRepository",
        memberName: "shared",
        coordinate: coordinate(18),
      },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "SqlOrderRepository",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
      repoRelativePath:
        "Symphony/Infrastructure/Repositories/SqlOrderRepository.ts",
    }),
  ]);

  const diagnostics = new PresentationInfrastructureReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationInfrastructureReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 18);
});

test("presentation infrastructure reference ignores local same-name presentation declarations", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    topLevelDeclarations: [
      {
        name: "SqlOrderRepository",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(4),
      },
    ],
    constructionOccurrences: [
      { typeName: "SqlOrderRepository", coordinate: coordinate(14) },
    ],
    staticMemberAccessOccurrences: [
      {
        baseName: "SqlOrderRepository",
        memberName: "shared",
        coordinate: coordinate(18),
      },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "SqlOrderRepository",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
      repoRelativePath:
        "Symphony/Infrastructure/Repositories/SqlOrderRepository.ts",
    }),
  ]);

  const diagnostics = new PresentationInfrastructureReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation cross-layer wire literal flags token duplicated in infrastructure", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    stringLiteralOccurrences: [
      { value: "order.ref:", coordinate: coordinate(8) },
      { value: "order.ref:", coordinate: coordinate(12) },
    ],
  });
  const context = new ProjectContext([], [
    literalSite({
      value: "order.ref:",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath:
        "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    }),
  ]);

  const diagnostics = new PresentationCrossLayerWireLiteralPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationCrossLayerWireLiteralPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 8);
  assert.match(diagnostics[0]?.message ?? "", /order\.ref:/);
});

test("presentation cross-layer wire literal flags token duplicated in application use case or service", () => {
  const useCaseFile = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    stringLiteralOccurrences: [
      { value: "workflow/session-", coordinate: coordinate(6) },
    ],
  });
  const useCaseContext = new ProjectContext([], [
    literalSite({
      value: "workflow/session-",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
      repoRelativePath:
        "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    }),
  ]);
  const serviceFile = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    stringLiteralOccurrences: [
      { value: "service.ref/", coordinate: coordinate(10) },
    ],
  });
  const serviceContext = new ProjectContext([], [
    literalSite({
      value: "service.ref/",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
      repoRelativePath:
        "Symphony/Application/Services/OrderService.ts",
    }),
  ]);
  const policy = new PresentationCrossLayerWireLiteralPolicy();

  const useCaseDiagnostics = policy.evaluate(useCaseFile, useCaseContext);
  const serviceDiagnostics = policy.evaluate(serviceFile, serviceContext);

  assert.equal(useCaseDiagnostics.length, 1);
  assert.equal(serviceDiagnostics.length, 1);
  assert.equal(
    useCaseDiagnostics[0]?.ruleID,
    PresentationCrossLayerWireLiteralPolicy.ruleID,
  );
  assert.equal(
    serviceDiagnostics[0]?.ruleID,
    PresentationCrossLayerWireLiteralPolicy.ruleID,
  );
});

test("presentation cross-layer wire literal ignores non-token prose", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    stringLiteralOccurrences: [
      { value: "Order reference: ", coordinate: coordinate(8) },
    ],
  });
  const context = new ProjectContext([], [
    literalSite({
      value: "Order reference: ",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath:
        "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    }),
  ]);

  const diagnostics = new PresentationCrossLayerWireLiteralPolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("presentation cross-layer wire literal ignores application contracts and same-file duplicates", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    stringLiteralOccurrences: [
      { value: "order.ref:", coordinate: coordinate(8) },
      { value: "same.file:", coordinate: coordinate(9) },
      { value: "same.file:", coordinate: coordinate(14) },
    ],
  });
  const context = new ProjectContext([], [
    literalSite({
      value: "order.ref:",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
      repoRelativePath:
        "Symphony/Application/Contracts/Workflow/OrderWorkflowContract.ts",
    }),
    literalSite({
      value: "same.file:",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationViewModels,
      repoRelativePath:
        "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    }),
  ]);

  const diagnostics = new PresentationCrossLayerWireLiteralPolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("presentation views shape accepts top-level function and const view declarations", () => {
  const functionFile = makeFile({
    repoRelativePath: "Symphony/Presentation/Views/OrderView.tsx",
    roleFolder: RoleFolder.PresentationViews,
    topLevelValueDeclarations: [
      {
        name: "OrderView",
        kind: "function",
        isExported: true,
        coordinate: coordinate(3),
      },
    ],
  });
  const constFile = makeFile({
    repoRelativePath: "Symphony/Presentation/Views/OrderSummaryView.tsx",
    roleFolder: RoleFolder.PresentationViews,
    topLevelValueDeclarations: [
      {
        name: "OrderSummaryView",
        kind: "const",
        isExported: false,
        coordinate: coordinate(3),
      },
    ],
  });
  const policy = new PresentationViewsShapePolicy();

  assert.deepEqual(policy.evaluate(functionFile, new ProjectContext([])), []);
  assert.deepEqual(policy.evaluate(constFile, new ProjectContext([])), []);
});

test("presentation views shape still flags misnamed exported TSX components", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Presentation/Views/OrderScreen.tsx",
    roleFolder: RoleFolder.PresentationViews,
    topLevelValueDeclarations: [
      {
        name: "OrderScreen",
        kind: "const",
        isExported: true,
        coordinate: coordinate(4),
      },
    ],
  });

  const diagnostics = new PresentationViewsShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, PresentationViewsShapePolicy.ruleID);
  assert.equal(diagnostics[0]?.line, 4);
});

test("makePresentationArchitecturePolicies returns the full presentation rule set", () => {
  const policies = makePresentationArchitecturePolicies();

  assert.equal(policies.length, 25);
  assert.ok(
    policies.some(
      (policy) =>
        policy.constructor === PresentationStateTransitionReferencePolicy,
    ),
  );
  assert.ok(
    policies.some(
      (policy) => policy.constructor === PresentationCrossLayerWireLiteralPolicy,
    ),
  );
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly roleFolder: RoleFolder;
  readonly layer?: ArchitectureLayer;
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
  readonly topLevelValueDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelValueDeclarations"];
  readonly typeReferences?: ConstructorParameters<typeof ArchitectureFile>[0]["typeReferences"];
  readonly constructionOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["constructionOccurrences"];
  readonly staticMemberAccessOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["staticMemberAccessOccurrences"];
  readonly functionTypeOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["functionTypeOccurrences"];
  readonly stringLiteralOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["stringLiteralOccurrences"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer ?? ArchitectureLayer.Presentation,
      roleFolder: input.roleFolder,
      pathComponents: input.repoRelativePath.split("/"),
      fileName: input.repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
    }),
    imports: [],
    functionTypeOccurrences: input.functionTypeOccurrences ?? [],
    identifierOccurrences: [],
    stringLiteralOccurrences: input.stringLiteralOccurrences ?? [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: input.typeReferences ?? [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    topLevelValueDeclarations: input.topLevelValueDeclarations ?? [],
    nestedNominalDeclarations: [],
    constructionOccurrences: input.constructionOccurrences ?? [],
    staticMemberAccessOccurrences: input.staticMemberAccessOccurrences ?? [],
  });
}

function indexedDeclaration(input: {
  readonly name: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly repoRelativePath: string;
}) {
  return {
    name: input.name,
    kind: NominalKind.Struct,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: input.repoRelativePath,
    layer: input.layer,
    roleFolder: input.roleFolder,
  } as const;
}

function literalSite(input: {
  readonly value: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly repoRelativePath: string;
}) {
  return {
    value: input.value,
    repoRelativePath: input.repoRelativePath,
    layer: input.layer,
    roleFolder: input.roleFolder,
  } as const;
}

function coordinate(line: number) {
  return { line, column: 1 } as const;
}
