import test from "node:test";
import assert from "node:assert/strict";

import {
  ApplicationAmbiguousRoleNamePolicy,
  ApplicationContractRegistryAccessPolicy,
  ApplicationOuterLayerReferencePolicy,
  ApplicationPassiveDependencyResolutionPolicy,
  ApplicationPortProtocolConformancePolicy,
  ApplicationServicesDependencyCardinalityPolicy,
  ApplicationServicesDependencyResolutionPolicy,
  ApplicationServicesPortProtocolReferencePolicy,
  ApplicationServicesServiceReferencePolicy,
  ApplicationServicesUseCaseConstructionPolicy,
  ApplicationUseCasesBoundaryTypeReferencePolicy,
  ApplicationUseCasesDependencyResolutionPolicy,
  ApplicationUseCasesServiceReferencePolicy,
  ApplicationUseCasesUseCaseReferencePolicy,
} from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import * as ApplicationPolicies from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { RICH_REMEDIATION_MARKERS } from "../../src/Domain/Policies/shared/RichRemediationMessage.ts";
import type { ArchitecturePolicyProtocol } from "../../src/Domain/Protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";
import type { IndexedDeclaration } from "../../src/Domain/ValueObjects/IndexedDeclaration.ts";

// ============================================================================
// application.provider_agnostic_naming
// ============================================================================

test("application.provider_agnostic_naming flags provider vocabulary in Application declarations", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Ports/Protocols/PrismaOrdersPortProtocol.ts",
    roleFolder: RoleFolder.ApplicationPortsProtocols,
    topLevelDeclarations: [
      {
        name: "PrismaOrdersPortProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 3, column: 18 },
      },
    ],
  });

  const diagnostics = makeApplicationProviderAgnosticNamingPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.provider_agnostic_naming");
  assert.equal(diagnostics[0]!.line, 3);
  assert.ok(diagnostics[0]!.message.includes("PrismaOrdersPortProtocol"));
  assert.ok(diagnostics[0]!.message.includes("prisma"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.provider_agnostic_naming checks nested declarations", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Contracts/Ports/OrdersContract.ts",
    roleFolder: RoleFolder.ApplicationContractsPorts,
    topLevelDeclarations: [
      {
        name: "OrdersContract",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 15 },
      },
    ],
    nestedNominalDeclarations: [
      {
        enclosingTypeName: "OrdersContract",
        name: "FirebaseSnapshot",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 5, column: 17 },
      },
    ],
  });

  const diagnostics = makeApplicationProviderAgnosticNamingPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.line, 5);
  assert.ok(diagnostics[0]!.message.includes("FirebaseSnapshot"));
});

test("application.provider_agnostic_naming avoids noisy substring matches", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/ExpressionUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    topLevelDeclarations: [
      {
        name: "ExpressionUseCase",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 14 },
      },
      {
        name: "RedispatchOrderUseCase",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 8, column: 14 },
      },
    ],
  });

  const diagnostics = makeApplicationProviderAgnosticNamingPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("application.provider_agnostic_naming supports configured provider terms", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Ports/Protocols/DrizzleOrdersPortProtocol.ts",
    roleFolder: RoleFolder.ApplicationPortsProtocols,
    topLevelDeclarations: [
      {
        name: "DrizzleOrdersPortProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 18 },
      },
    ],
  });

  const defaultDiagnostics = makeApplicationProviderAgnosticNamingPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(defaultDiagnostics.length, 0);

  const diagnostics = makeApplicationProviderAgnosticNamingPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    providerSurfaceTerms: ["drizzle"],
  }).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 1);
  assert.ok(diagnostics[0]!.message.includes("drizzle"));
});

test("application.provider_agnostic_naming ignores non-Application files", () => {
  const file = makeClassifiedFile({
    repoRelativePath: "Symphony/Infrastructure/Repositories/PrismaOrdersRepository.ts",
    layer: ArchitectureLayer.Infrastructure,
    roleFolder: RoleFolder.InfrastructureRepositories,
    topLevelDeclarations: [
      {
        name: "PrismaOrdersRepository",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 14 },
      },
    ],
  });

  const diagnostics = makeApplicationProviderAgnosticNamingPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("application.provider_agnostic_naming is included in the Application policy factory", () => {
  const policies = ApplicationPolicies.makeApplicationArchitecturePolicies();

  assert.ok(
    policies.some(
      (policy) => policy.constructor.name === "ApplicationProviderAgnosticNamingPolicy",
    ),
  );
});

test("application.outer_layer_reference flags ambiguous same-name Presentation declarations", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    typeReferences: [
      {
        name: "SharedWorkflow",
        coordinate: { line: 6, column: 18 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "SharedWorkflow",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/SharedWorkflow.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
    makeDeclaration({
      name: "SharedWorkflow",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Presentation/ViewModels/SharedWorkflow.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationViewModels,
    }),
  ]);

  const diagnostics = new ApplicationOuterLayerReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.outer_layer_reference");
  assert.equal(diagnostics[0]!.line, 6);
  assert.match(diagnostics[0]!.message, /Presentation/);
});

test("application.usecases.service_reference flags ambiguous same-name service declarations", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/SubmitOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    typeReferences: [
      {
        name: "OrderCoordinator",
        coordinate: { line: 7, column: 22 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderCoordinator",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/UseCases/OrderCoordinator.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
    makeDeclaration({
      name: "OrderCoordinator",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/OrderCoordinator.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
  ]);

  const diagnostics = new ApplicationUseCasesServiceReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]!.ruleID,
    "application.usecases.service_reference",
  );
  assert.equal(diagnostics[0]!.line, 7);
  assert.match(diagnostics[0]!.message, /Application service/);
});

test("application.usecases.service_reference flags ambiguous same-name service declarations through static member access", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/SubmitOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    staticMemberAccessOccurrences: [
      {
        baseName: "OrderCoordinator",
        memberName: "current",
        coordinate: { line: 10, column: 12 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderCoordinator",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/UseCases/OrderCoordinator.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
    makeDeclaration({
      name: "OrderCoordinator",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/OrderCoordinator.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
  ]);

  const diagnostics = new ApplicationUseCasesServiceReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]!.ruleID,
    "application.usecases.service_reference",
  );
  assert.equal(diagnostics[0]!.line, 10);
  assert.match(diagnostics[0]!.message, /Application service/);
});

test("application.usecases.service_reference flags ambiguous same-name service declarations through construction", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/SubmitOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    constructionOccurrences: [
      {
        typeName: "OrderCoordinator",
        coordinate: { line: 12, column: 21 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderCoordinator",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/UseCases/OrderCoordinator.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
    makeDeclaration({
      name: "OrderCoordinator",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/OrderCoordinator.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
  ]);

  const diagnostics = new ApplicationUseCasesServiceReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]!.ruleID,
    "application.usecases.service_reference",
  );
  assert.equal(diagnostics[0]!.line, 12);
  assert.match(diagnostics[0]!.message, /Application service/);
});

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
// application.port_protocol_conformance
// ============================================================================

test("application.port_protocol_conformance flags Application class implementing an Application port protocol", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    topLevelDeclarations: [
      {
        name: "InMemoryOrdersGateway",
        kind: NominalKind.Class,
        inheritedTypeNames: ["OrdersPortProtocol"],
        memberNames: [],
        coordinate: { line: 4, column: 14 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrdersPortProtocol",
      kind: NominalKind.Protocol,
      repoRelativePath: "Symphony/Application/Ports/Protocols/OrdersPortProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    }),
  ]);

  const diagnostics =
    new ApplicationPortProtocolConformancePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.port_protocol_conformance");
  assert.equal(diagnostics[0]!.line, 4);
  assert.ok(diagnostics[0]!.message.includes("InMemoryOrdersGateway"));
  assert.ok(diagnostics[0]!.message.includes("OrdersPortProtocol"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.port_protocol_conformance flags Application construction of a type that conforms to an Application port protocol", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    constructionOccurrences: [
      { typeName: "InMemoryOrdersGateway", coordinate: { line: 9, column: 18 } },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrdersPortProtocol",
      kind: NominalKind.Protocol,
      repoRelativePath: "Symphony/Application/Ports/Protocols/OrdersPortProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    }),
    makeDeclaration({
      name: "InMemoryOrdersGateway",
      kind: NominalKind.Class,
      inheritedTypeNames: ["OrdersPortProtocol"],
      repoRelativePath: "Symphony/Application/UseCases/InMemoryOrdersGateway.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
  ]);

  const diagnostics =
    new ApplicationPortProtocolConformancePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.port_protocol_conformance");
  assert.equal(diagnostics[0]!.line, 9);
  assert.ok(diagnostics[0]!.message.includes("InMemoryOrdersGateway"));
});

test("application.port_protocol_conformance ignores interface declarations themselves", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Ports/Protocols/OrdersPortProtocol.ts",
    roleFolder: RoleFolder.ApplicationPortsProtocols,
    topLevelDeclarations: [
      {
        name: "OrdersPortProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: ["BaseOrdersPortProtocol"],
        memberNames: [],
        coordinate: { line: 1, column: 18 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "BaseOrdersPortProtocol",
      kind: NominalKind.Protocol,
      repoRelativePath:
        "Symphony/Application/Ports/Protocols/BaseOrdersPortProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    }),
  ]);

  const diagnostics =
    new ApplicationPortProtocolConformancePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("application.port_protocol_conformance ignores non-Application files", () => {
  const file = makeClassifiedFile({
    repoRelativePath: "Symphony/Infrastructure/PortAdapters/OrdersPortAdapter.ts",
    layer: ArchitectureLayer.Infrastructure,
    roleFolder: RoleFolder.InfrastructurePortAdapters,
    topLevelDeclarations: [
      {
        name: "OrdersPortAdapter",
        kind: NominalKind.Class,
        inheritedTypeNames: ["OrdersPortProtocol"],
        memberNames: [],
        coordinate: { line: 1, column: 14 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrdersPortProtocol",
      kind: NominalKind.Protocol,
      repoRelativePath: "Symphony/Application/Ports/Protocols/OrdersPortProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    }),
  ]);

  const diagnostics =
    new ApplicationPortProtocolConformancePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("application.port_protocol_conformance is included in the Application policy factory", () => {
  const policies = ApplicationPolicies.makeApplicationArchitecturePolicies();

  assert.ok(
    policies.some(
      (policy) => policy.constructor === ApplicationPortProtocolConformancePolicy,
    ),
  );
});

test("application.port_protocol_conformance is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationPortProtocolConformancePolicy.ruleID],
  });
  assert.ok(
    !policies.some(
      (policy) => policy.constructor === ApplicationPortProtocolConformancePolicy,
    ),
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
// application.services.dependency_cardinality
// ============================================================================

test("application.services.dependency_cardinality flags Service storing too many UseCase dependencies", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [
      {
        name: "OrderService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 14 },
      },
    ],
    storedMemberDeclarations: [
      storedMember("OrderService", "fetchOrder", "FetchOrderUseCase", 4),
      storedMember("OrderService", "priceOrder", "PriceOrderUseCase", 5),
      storedMember("OrderService", "shipOrder", "ShipOrderUseCase", 6),
    ],
  });

  const diagnostics = new ApplicationServicesDependencyCardinalityPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    maxServiceUseCaseDependencies: 2,
    maxUseCasesPerServiceMethod: 10,
  }).evaluate(file, makeUseCaseContext([
    "FetchOrderUseCase",
    "PriceOrderUseCase",
    "ShipOrderUseCase",
  ]));

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.services.dependency_cardinality");
  assert.equal(diagnostics[0]!.line, 2);
  assert.ok(diagnostics[0]!.message.includes("stores 3 injected UseCase dependencies"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.services.dependency_cardinality flags public method coordinating too many UseCases", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [
      {
        name: "OrderService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 14 },
      },
    ],
    storedMemberDeclarations: [
      storedMember("OrderService", "fetchOrder", "FetchOrderUseCase", 4),
      storedMember("OrderService", "priceOrder", "PriceOrderUseCase", 5),
    ],
    methodDeclarations: [
      serviceMethod("OrderService", "checkout", 8),
    ],
    operationalUseOccurrences: [
      operationalUse("OrderService", "checkout", "fetchOrder", "execute", 9),
      operationalUse("OrderService", "checkout", "priceOrder", "execute", 10),
    ],
  });

  const diagnostics = new ApplicationServicesDependencyCardinalityPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    maxServiceUseCaseDependencies: 10,
    maxUseCasesPerServiceMethod: 1,
  }).evaluate(file, makeUseCaseContext([
    "FetchOrderUseCase",
    "PriceOrderUseCase",
  ]));

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.services.dependency_cardinality");
  assert.equal(diagnostics[0]!.line, 8);
  assert.ok(diagnostics[0]!.message.includes("method 'checkout' coordinates 2 distinct UseCases"));
});

test("application.services.dependency_cardinality includes UseCases used through private helpers", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [
      {
        name: "OrderService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 14 },
      },
    ],
    storedMemberDeclarations: [
      storedMember("OrderService", "fetchOrder", "FetchOrderUseCase", 4),
      storedMember("OrderService", "priceOrder", "PriceOrderUseCase", 5),
    ],
    methodDeclarations: [
      serviceMethod("OrderService", "checkout", 8),
      serviceMethod("OrderService", "preparePricing", 14, {
        isPrivateOrFileprivate: true,
        isPublicOrOpen: false,
      }),
    ],
    operationalUseOccurrences: [
      operationalUse("OrderService", "checkout", "fetchOrder", "execute", 9),
      operationalUse("OrderService", "checkout", "preparePricing", "call", 10),
      operationalUse("OrderService", "preparePricing", "priceOrder", "execute", 15),
    ],
  });

  const diagnostics = new ApplicationServicesDependencyCardinalityPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    maxServiceUseCaseDependencies: 10,
    maxUseCasesPerServiceMethod: 1,
  }).evaluate(file, makeUseCaseContext([
    "FetchOrderUseCase",
    "PriceOrderUseCase",
  ]));

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.line, 8);
  assert.ok(diagnostics[0]!.message.includes("checkout"));
});

test("application.services.dependency_cardinality stays silent below configured caps", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    topLevelDeclarations: [
      {
        name: "OrderService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 14 },
      },
    ],
    storedMemberDeclarations: [
      storedMember("OrderService", "fetchOrder", "FetchOrderUseCase", 4),
      storedMember("OrderService", "priceOrder", "PriceOrderUseCase", 5),
    ],
    methodDeclarations: [
      serviceMethod("OrderService", "checkout", 8),
    ],
    operationalUseOccurrences: [
      operationalUse("OrderService", "checkout", "fetchOrder", "execute", 9),
      operationalUse("OrderService", "checkout", "priceOrder", "execute", 10),
    ],
  });

  const diagnostics = new ApplicationServicesDependencyCardinalityPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    maxServiceUseCaseDependencies: 2,
    maxUseCasesPerServiceMethod: 2,
  }).evaluate(file, makeUseCaseContext([
    "FetchOrderUseCase",
    "PriceOrderUseCase",
  ]));

  assert.equal(diagnostics.length, 0);
});

test("application.services.dependency_cardinality is included in the Application policy factory", () => {
  const policies = ApplicationPolicies.makeApplicationArchitecturePolicies();

  assert.ok(
    policies.some(
      (policy) =>
        policy.constructor === ApplicationServicesDependencyCardinalityPolicy,
    ),
  );
});

// ============================================================================
// application.contract_registry_access
// ============================================================================

test("application.contract_registry_access flags Service access to Contract.current", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    staticMemberAccessOccurrences: [
      {
        baseName: "OrderResultContract",
        memberName: "current",
        coordinate: { line: 9, column: 18 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderResultContract",
      kind: NominalKind.Struct,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderResultContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics = new ApplicationContractRegistryAccessPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.contract_registry_access");
  assert.equal(diagnostics[0]!.line, 9);
  assert.equal(diagnostics[0]!.column, 18);
  assert.ok(diagnostics[0]!.message.includes("OrderResultContract.current"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("application.contract_registry_access flags UseCase access to Contract.fixture member", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    staticMemberAccessOccurrences: [
      {
        baseName: "OrderResultContract",
        memberName: "fixturePaidOrder",
        coordinate: { line: 12, column: 14 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderResultContract",
      kind: NominalKind.Struct,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderResultContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics = new ApplicationContractRegistryAccessPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "application.contract_registry_access");
  assert.equal(diagnostics[0]!.line, 12);
  assert.ok(diagnostics[0]!.message.includes("OrderResultContract.fixturePaidOrder"));
});

test("application.contract_registry_access ignores non-registry static members", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    roleFolder: RoleFolder.ApplicationServices,
    staticMemberAccessOccurrences: [
      {
        baseName: "OrderResultContract",
        memberName: "fromDomain",
        coordinate: { line: 9, column: 18 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderResultContract",
      kind: NominalKind.Struct,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderResultContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics = new ApplicationContractRegistryAccessPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("application.contract_registry_access ignores registry members when base is not an Application contract", () => {
  const file = makeApplicationFile({
    repoRelativePath: "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    roleFolder: RoleFolder.ApplicationUseCases,
    staticMemberAccessOccurrences: [
      {
        baseName: "OrderRepository",
        memberName: "current",
        coordinate: { line: 9, column: 18 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderRepository",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Infrastructure/Repositories/OrderRepository.ts",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
    }),
  ]);

  const diagnostics = new ApplicationContractRegistryAccessPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("application.contract_registry_access is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationContractRegistryAccessPolicy.ruleID],
  });
  assert.ok(
    !policies.some((p) => p.constructor === ApplicationContractRegistryAccessPolicy),
  );
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
  readonly nestedNominalDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["nestedNominalDeclarations"];
  readonly storedMemberDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["storedMemberDeclarations"];
  readonly typeReferences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["typeReferences"];
    readonly methodDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["methodDeclarations"];
  readonly operationalUseOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["operationalUseOccurrences"];
  readonly constructionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["constructionOccurrences"];
  readonly staticMemberAccessOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["staticMemberAccessOccurrences"];
  readonly dependencyResolutionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["dependencyResolutionOccurrences"];
}): ArchitectureFile {
  return makeClassifiedFile({
    ...input,
    layer: ArchitectureLayer.Application,
  });
}

function makeClassifiedFile(input: {
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly topLevelDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["topLevelDeclarations"];
  readonly nestedNominalDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["nestedNominalDeclarations"];
  readonly storedMemberDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["storedMemberDeclarations"];
  readonly typeReferences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["typeReferences"];
  readonly methodDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["methodDeclarations"];
  readonly constructionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["constructionOccurrences"];
  readonly staticMemberAccessOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["staticMemberAccessOccurrences"];
  readonly dependencyResolutionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["dependencyResolutionOccurrences"];
}): ArchitectureFile {
  const pathComponents = input.repoRelativePath.split("/");
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer,
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
    operationalUseOccurrences: input.operationalUseOccurrences ?? [],
    typeReferences: input.typeReferences ?? [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    topLevelValueDeclarations: [],
    nestedNominalDeclarations: input.nestedNominalDeclarations ?? [],
    constructionOccurrences: input.constructionOccurrences ?? [],
    staticMemberAccessOccurrences: input.staticMemberAccessOccurrences ?? [],
    decoratorOccurrences: [],
    dependencyResolutionOccurrences: input.dependencyResolutionOccurrences ?? [],
  });
}

function storedMember(
  enclosingTypeName: string,
  name: string,
  typeName: string,
  line: number,
) {
  return {
    enclosingTypeName,
    name,
    typeNames: [typeName],
    isStatic: false,
    coordinate: { line, column: 12 },
  };
}

function serviceMethod(
  enclosingTypeName: string,
  name: string,
  line: number,
  options: {
    readonly isPublicOrOpen?: boolean;
    readonly isPrivateOrFileprivate?: boolean;
  } = {},
) {
  return {
    enclosingTypeName,
    name,
    isStatic: false,
    isPublicOrOpen: options.isPublicOrOpen ?? true,
    isPrivateOrFileprivate: options.isPrivateOrFileprivate ?? false,
    parameterTypeNames: [],
    hasExplicitReturnType: true,
    returnTypeNames: [],
    returnsVoidLike: true,
    coordinate: { line, column: 3 },
  };
}

function operationalUse(
  enclosingTypeName: string,
  enclosingMethodName: string,
  baseName: string,
  memberName: string,
  line: number,
) {
  return {
    enclosingTypeName,
    enclosingMethodName,
    baseName,
    memberName,
    coordinate: { line, column: 5 },
  };
}

function makeUseCaseContext(names: readonly string[]): ProjectContext {
  return new ProjectContext(
    names.map((name) =>
      makeDeclaration({
        name,
        kind: NominalKind.Class,
        repoRelativePath: `Symphony/Application/UseCases/${name}.ts`,
        layer: ArchitectureLayer.Application,
        roleFolder: RoleFolder.ApplicationUseCases,
      }),
    ),
  );
}

function makeDeclaration(input: {
  readonly name: string;
  readonly kind: NominalKind;
  readonly inheritedTypeNames?: readonly string[];
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
}): IndexedDeclaration {
  return {
    name: input.name,
    kind: input.kind,
    inheritedTypeNames: input.inheritedTypeNames ?? [],
    methodShapes: [],
    repoRelativePath: input.repoRelativePath,
    layer: input.layer,
    roleFolder: input.roleFolder,
  };
}

function makeApplicationProviderAgnosticNamingPolicy(
  configuration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
): ArchitecturePolicyProtocol {
  const Policy = (
    ApplicationPolicies as Record<string, unknown>
  ).ApplicationProviderAgnosticNamingPolicy;

  assert.equal(typeof Policy, "function");
  return new (Policy as new (
    configuration: typeof DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) => ArchitecturePolicyProtocol)(configuration);
}
