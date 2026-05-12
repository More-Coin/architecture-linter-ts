import test from "node:test";
import assert from "node:assert/strict";

import {
  ApplicationAmbiguousRoleNamePolicy,
  ApplicationPassiveDependencyResolutionPolicy,
  ApplicationServicesDependencyResolutionPolicy,
  ApplicationServicesPortProtocolReferencePolicy,
  ApplicationServicesServiceReferencePolicy,
  ApplicationServicesUseCaseConstructionPolicy,
  ApplicationUseCasesBoundaryTypeReferencePolicy,
  ApplicationUseCasesDependencyResolutionPolicy,
  ApplicationUseCasesUseCaseReferencePolicy,
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
import type { IndexedDeclaration } from "../../src/Domain/ValueObjects/IndexedDeclaration.ts";

// ============================================================================
// application.passive_dependency_resolution
// ============================================================================

test("application.passive_dependency_resolution flags Container.resolve in a Contract", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Contracts/Commands/CreateOrderContract.ts",
    roleFolder: RoleFolder.ApplicationContractsCommands,
    dependencyResolutionOccurrences: [
      { baseName: "Container", memberName: "resolve", coordinate: { line: 8, column: 5 } },
    ],
  });

  const diagnostics = new ApplicationPassiveDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.passive_dependency_resolution");
  assert.equal(diagnostics[0]!.line, 8);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.passive_dependency_resolution stays silent for non-passive Application files", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    dependencyResolutionOccurrences: [
      { baseName: "Container", memberName: "resolve", coordinate: { line: 1, column: 1 } },
    ],
  });

  const diagnostics = new ApplicationPassiveDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("application.passive_dependency_resolution is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationPassiveDependencyResolutionPolicy.ruleID],
  });
  assert.ok(
    !policies.some((p) => p.constructor === ApplicationPassiveDependencyResolutionPolicy),
  );
});

// ============================================================================
// application.ambiguous_role_name
// ============================================================================

test("application.ambiguous_role_name flags Manager-suffixed Application type", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderManager.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [
      {
        name: "OrderManager",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 14 },
      },
    ],
  });

  const diagnostics = new ApplicationAmbiguousRoleNamePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.ambiguous_role_name");
  assert.equal(diagnostics[0]!.line, 2);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.ambiguous_role_name allows Service suffix inside Application/Services", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [
      {
        name: "OrderService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new ApplicationAmbiguousRoleNamePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("application.ambiguous_role_name is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationAmbiguousRoleNamePolicy.ruleID],
  });
  assert.ok(
    !policies.some((p) => p.constructor === ApplicationAmbiguousRoleNamePolicy),
  );
});

// ============================================================================
// application.services.port_protocol_reference
// ============================================================================

test("application.services.port_protocol_reference flags Application/Ports/Protocols dependency", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderService",
        name: "ordersRepository",
        typeNames: ["OrdersRepositoryProtocol"],
        isStatic: false,
        coordinate: { line: 4, column: 14 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrdersRepositoryProtocol",
      kind: NominalKind.Protocol,
      repoRelativePath: "Symphony/Application/Ports/Protocols/OrdersRepositoryProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    }),
  ]);

  const diagnostics =
    new ApplicationServicesPortProtocolReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.services.port_protocol_reference");
  assert.equal(diagnostics[0]!.line, 4);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.services.port_protocol_reference allows UseCase dependency", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderService",
        name: "fetchOrder",
        typeNames: ["FetchOrderUseCase"],
        isStatic: false,
        coordinate: { line: 4, column: 14 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "FetchOrderUseCase",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
  ]);

  const diagnostics =
    new ApplicationServicesPortProtocolReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("application.services.port_protocol_reference is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationServicesPortProtocolReferencePolicy.ruleID],
  });
  assert.ok(
    !policies.some(
      (p) => p.constructor === ApplicationServicesPortProtocolReferencePolicy,
    ),
  );
});

// ============================================================================
// application.services.service_reference
// ============================================================================

test("application.services.service_reference flags another Application Service dependency", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [
      {
        name: "OrderService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderService",
        name: "billing",
        typeNames: ["BillingService"],
        isStatic: false,
        coordinate: { line: 3, column: 12 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "BillingService",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/BillingService.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
  ]);

  const diagnostics =
    new ApplicationServicesServiceReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.services.service_reference");
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

// ============================================================================
// application.services.usecase_construction
// ============================================================================

test("application.services.usecase_construction flags `new FetchOrderUseCase()` in a Service", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    constructionOccurrences: [
      { typeName: "FetchOrderUseCase", coordinate: { line: 7, column: 22 } },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "FetchOrderUseCase",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
  ]);

  const diagnostics =
    new ApplicationServicesUseCaseConstructionPolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.services.usecase_construction");
  assert.equal(diagnostics[0]!.line, 7);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.services.usecase_construction ignores non-UseCase construction", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    constructionOccurrences: [
      { typeName: "OrderResultContract", coordinate: { line: 7, column: 22 } },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderResultContract",
      kind: NominalKind.Struct,
      repoRelativePath:
        "Symphony/Application/Contracts/Workflow/OrderResultContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics =
    new ApplicationServicesUseCaseConstructionPolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

// ============================================================================
// application.services.dependency_resolution
// ============================================================================

test("application.services.dependency_resolution flags Container.resolve in a Service", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    dependencyResolutionOccurrences: [
      { baseName: "Container", memberName: "resolve", coordinate: { line: 5, column: 12 } },
    ],
  });

  const diagnostics =
    new ApplicationServicesDependencyResolutionPolicy().evaluate(
      file,
      new ProjectContext([]),
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.services.dependency_resolution");
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

// ============================================================================
// application.usecases.usecase_reference
// ============================================================================

test("application.usecases.usecase_reference flags another UseCase dependency", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    topLevelDeclarations: [
      {
        name: "FetchOrderUseCase",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
    storedMemberDeclarations: [
      {
        enclosingTypeName: "FetchOrderUseCase",
        name: "billing",
        typeNames: ["BillOrderUseCase"],
        isStatic: false,
        coordinate: { line: 3, column: 12 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "BillOrderUseCase",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/UseCases/BillOrderUseCase.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
  ]);

  const diagnostics =
    new ApplicationUseCasesUseCaseReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.usecases.usecase_reference");
});

// ============================================================================
// application.usecases.dependency_resolution
// ============================================================================

test("application.usecases.dependency_resolution flags container resolution in a UseCase", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    dependencyResolutionOccurrences: [
      { baseName: "Resolver", memberName: "get", coordinate: { line: 6, column: 1 } },
    ],
  });

  const diagnostics =
    new ApplicationUseCasesDependencyResolutionPolicy().evaluate(
      file,
      new ProjectContext([]),
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.usecases.dependency_resolution");
});

// ============================================================================
// application.usecases.boundary_type_reference
// ============================================================================

test("application.usecases.boundary_type_reference flags Express Request/Response on the UseCase surface", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    methodDeclarations: [
      {
        enclosingTypeName: "FetchOrderUseCase",
        name: "execute",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: ["Request"],
        hasExplicitReturnType: true,
        returnTypeDescription: "Promise<Response>",
        returnTypeNames: ["Promise", "Response"],
        returnsVoidLike: false,
        coordinate: { line: 4, column: 3 },
      },
    ],
  });

  const diagnostics =
    new ApplicationUseCasesBoundaryTypeReferencePolicy().evaluate(
      file,
      new ProjectContext([]),
    );

  // Both Request and Response should fire; check at least one diagnostic with the correct ruleID.
  assert.ok(diagnostics.length >= 1);
  const ruleIDs = new Set(diagnostics.map((d) => d.ruleID));
  assert.ok(ruleIDs.has("application.usecases.boundary_type_reference"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.usecases.boundary_type_reference flags Presentation-layer DTO on UseCase surface", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/RenderOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    methodDeclarations: [
      {
        enclosingTypeName: "RenderOrderUseCase",
        name: "execute",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: [],
        hasExplicitReturnType: true,
        returnTypeDescription: "OrderViewDTO",
        returnTypeNames: ["OrderViewDTO"],
        returnsVoidLike: false,
        coordinate: { line: 4, column: 3 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderViewDTO",
      kind: NominalKind.Struct,
      repoRelativePath: "Symphony/Presentation/DTOs/OrderViewDTO.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationDTOs,
    }),
  ]);

  const diagnostics =
    new ApplicationUseCasesBoundaryTypeReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.usecases.boundary_type_reference");
});

test("application.usecases.boundary_type_reference allows Domain/Contract types on UseCase surface", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    methodDeclarations: [
      {
        enclosingTypeName: "FetchOrderUseCase",
        name: "execute",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: ["OrderContract"],
        hasExplicitReturnType: true,
        returnTypeDescription: "Promise<Order>",
        returnTypeNames: ["Promise", "Order"],
        returnsVoidLike: false,
        coordinate: { line: 4, column: 3 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderContract",
      kind: NominalKind.Struct,
      repoRelativePath:
        "Symphony/Application/Contracts/Workflow/OrderContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
    makeDeclaration({
      name: "Order",
      kind: NominalKind.Struct,
      repoRelativePath: "Symphony/Domain/Entities/Order.ts",
      layer: ArchitectureLayer.Domain,
      roleFolder: RoleFolder.None,
    }),
  ]);

  const diagnostics =
    new ApplicationUseCasesBoundaryTypeReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

// ============================================================================
// Rich-remediation pass — sample Application terse-helper sites
// ============================================================================

test("Application terse helper now emits all five Swift-parity markers", async () => {
  const { ApplicationServicesShapePolicy } = await import(
    "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts"
  );

  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/EmptyService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [], // empty file triggers a shape diagnostic
  });

  const diagnostics = new ApplicationServicesShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.ok(
    diagnostics.length >= 1,
    "expected ApplicationServicesShapePolicy to flag the empty file",
  );

  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(
      diagnostics[0]!.message.includes(marker),
      `expected marker '${marker}' in legacy-Application-helper output: ${diagnostics[0]!.message}`,
    );
  }
});

test("application.usecases.boundary_type_reference is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationUseCasesBoundaryTypeReferencePolicy.ruleID],
  });
  assert.ok(
    !policies.some(
      (p) => p.constructor === ApplicationUseCasesBoundaryTypeReferencePolicy,
    ),
  );
});

// ============================================================================
// Helpers
// ============================================================================

function makeApplicationFile(input: {
  readonly repoRelativePath: string;
  readonly roleFolder: RoleFolder;
  readonly topLevelDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["topLevelDeclarations"];
  readonly storedMemberDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["storedMemberDeclarations"];
  readonly methodDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["methodDeclarations"];
  readonly constructionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["constructionOccurrences"];
  readonly dependencyResolutionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["dependencyResolutionOccurrences"];
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
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    topLevelValueDeclarations: [],
    nestedNominalDeclarations: [],
    constructionOccurrences: input.constructionOccurrences ?? [],
    staticMemberAccessOccurrences: [],
    decoratorOccurrences: [],
    dependencyResolutionOccurrences: input.dependencyResolutionOccurrences ?? [],
  });
}

function makeDeclaration(input: {
  readonly name: string;
  readonly kind: NominalKind;
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
}): IndexedDeclaration {
  return {
    name: input.name,
    kind: input.kind,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: input.repoRelativePath,
    layer: input.layer,
    roleFolder: input.roleFolder,
  };
}
