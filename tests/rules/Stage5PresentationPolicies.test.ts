import test from "node:test";
import assert from "node:assert/strict";

import {
  PresentationCompositionReferencePolicy,
  PresentationControllersUseCaseReferencePolicy,
  PresentationDependencyResolutionPolicy,
  PresentationDomainPolicyReferencePolicy,
  PresentationPlatformStateAccessPolicy,
  PresentationPortProtocolReferencePolicy,
  PresentationStateTransitionReferencePolicy,
  PresentationUseCaseReferencePolicy,
  makePresentationArchitecturePolicies,
} from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
import * as PresentationPolicies from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
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
// presentation.domain_policy_reference
// ============================================================================

test("presentation.domain_policy_reference flags Domain policy type construction and static access in Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    constructionOccurrences: [
      { typeName: "OrderEligibilityPolicy", coordinate: { line: 8, column: 21 } },
    ],
    staticMemberAccessOccurrences: [
      {
        baseName: "OrderEligibilityPolicy",
        memberName: "decide",
        coordinate: { line: 10, column: 12 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderEligibilityPolicy",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Domain/Policies/OrderEligibilityPolicy.ts",
      layer: ArchitectureLayer.Domain,
      roleFolder: RoleFolder.DomainPolicies,
    }),
  ]);

  const diagnostics = new PresentationDomainPolicyReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.domain_policy_reference");
  assert.equal(diagnostics[0]!.line, 8);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.domain_policy_reference ignores a local same-name Presentation declaration", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    topLevelDeclarations: [
      {
        name: "OrderEligibilityPolicy",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 1 },
      },
    ],
    typeReferences: [
      { name: "OrderEligibilityPolicy", coordinate: { line: 5, column: 16 } },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderEligibilityPolicy",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Domain/Policies/OrderEligibilityPolicy.ts",
      layer: ArchitectureLayer.Domain,
      roleFolder: RoleFolder.DomainPolicies,
    }),
  ]);

  const diagnostics = new PresentationDomainPolicyReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.domain_policy_reference stays silent outside Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationServices,
    typeReferences: [
      { name: "OrderEligibilityPolicy", coordinate: { line: 4, column: 18 } },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderEligibilityPolicy",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Domain/Policies/OrderEligibilityPolicy.ts",
      layer: ArchitectureLayer.Domain,
      roleFolder: RoleFolder.DomainPolicies,
    }),
  ]);

  const diagnostics = new PresentationDomainPolicyReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.domain_policy_reference is registered by default and in the Presentation factory", () => {
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) => policy.constructor === PresentationDomainPolicyReferencePolicy,
    ),
  );
  assert.ok(
    makePresentationArchitecturePolicies().some(
      (policy) => policy.constructor === PresentationDomainPolicyReferencePolicy,
    ),
  );
});

// ============================================================================
// presentation.usecase_reference (broad — every Presentation role)
// ============================================================================

test("presentation.usecase_reference flags UseCase reference inside a Controller", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderController",
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

  const diagnostics = new PresentationUseCaseReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.usecase_reference");
  assert.equal(diagnostics[0]!.line, 4);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.usecase_reference flags UseCase reference inside a Renderer (non-controller Presentation role)", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Renderers/OrderRenderer.ts",
    roleFolder: RoleFolder.PresentationRenderers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderRenderer",
        name: "fetchOrder",
        typeNames: ["FetchOrderUseCase"],
        isStatic: false,
        coordinate: { line: 3, column: 1 },
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

  const diagnostics = new PresentationUseCaseReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.usecase_reference");
});

test("presentation.usecase_reference allows Application Service references", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderController",
        name: "orderService",
        typeNames: ["OrderService"],
        isStatic: false,
        coordinate: { line: 3, column: 1 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderService",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/OrderService.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
  ]);

  const diagnostics = new PresentationUseCaseReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("presentation.usecase_reference flags ambiguous same-name UseCase declarations", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderController",
        name: "workflow",
        typeNames: ["OrderWorkflow"],
        isStatic: false,
        coordinate: { line: 5, column: 14 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderWorkflow",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/OrderWorkflow.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
    makeDeclaration({
      name: "OrderWorkflow",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/UseCases/OrderWorkflow.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
  ]);

  const diagnostics = new PresentationUseCaseReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.usecase_reference");
  assert.equal(diagnostics[0]!.line, 5);
  assert.match(diagnostics[0]!.message, /Application UseCase/);
});

test("presentation.usecase_reference is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [PresentationUseCaseReferencePolicy.ruleID],
  });
  assert.ok(
    !policies.some((p) => p.constructor === PresentationUseCaseReferencePolicy),
  );
});

// ============================================================================
// presentation.port_protocol_reference
// ============================================================================

test("presentation.port_protocol_reference flags Application port reference in Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderController",
        name: "ordersRepository",
        typeNames: ["OrdersRepositoryProtocol"],
        isStatic: false,
        coordinate: { line: 5, column: 1 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrdersRepositoryProtocol",
      kind: NominalKind.Protocol,
      repoRelativePath:
        "Symphony/Application/Ports/Protocols/OrdersRepositoryProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    }),
  ]);

  const diagnostics = new PresentationPortProtocolReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.port_protocol_reference");
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.port_protocol_reference is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [PresentationPortProtocolReferencePolicy.ruleID],
  });
  assert.ok(
    !policies.some((p) => p.constructor === PresentationPortProtocolReferencePolicy),
  );
});

// ============================================================================
// presentation.composition_reference
// ============================================================================

test("presentation.composition_reference flags App/DependencyInjection reference in Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderController",
        name: "graph",
        typeNames: ["AppGraph"],
        isStatic: false,
        coordinate: { line: 4, column: 1 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "AppGraph",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/App/dependency-injection/AppGraph.ts",
      layer: ArchitectureLayer.App,
      roleFolder: RoleFolder.AppDependencyInjection,
    }),
  ]);

  const diagnostics = new PresentationCompositionReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.composition_reference");
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.composition_reference is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [PresentationCompositionReferencePolicy.ruleID],
  });
  assert.ok(
    !policies.some((p) => p.constructor === PresentationCompositionReferencePolicy),
  );
});

// ============================================================================
// presentation.dependency_resolution
// ============================================================================

test("presentation.dependency_resolution flags Container.resolve inside Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    dependencyResolutionOccurrences: [
      { baseName: "Container", memberName: "resolve", coordinate: { line: 6, column: 12 } },
    ],
  });

  const diagnostics = new PresentationDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.dependency_resolution");
  assert.equal(diagnostics[0]!.line, 6);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.dependency_resolution flags @Inject decorator", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    dependencyResolutionOccurrences: [
      { baseName: "Inject", coordinate: { line: 2, column: 1 } },
    ],
  });

  const diagnostics = new PresentationDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.ok(diagnostics[0]!.message.includes("@Inject"));
});

test("presentation.dependency_resolution stays silent outside Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationServices,
    dependencyResolutionOccurrences: [
      { baseName: "Container", memberName: "resolve", coordinate: { line: 1, column: 1 } },
    ],
  });

  const diagnostics = new PresentationDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.dependency_resolution is disabled by disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [PresentationDependencyResolutionPolicy.ruleID],
  });
  assert.ok(
    !policies.some((p) => p.constructor === PresentationDependencyResolutionPolicy),
  );
});

// ============================================================================
// presentation.platform_state_access
// ============================================================================

test("presentation.platform_state_access flags browser storage and cookie access in Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    identifierOccurrences: [
      { name: "localStorage", coordinate: { line: 5, column: 12 } },
      { name: "localStorage", coordinate: { line: 5, column: 25 } },
      { name: "sessionStorage", coordinate: { line: 6, column: 12 } },
    ],
    staticMemberAccessOccurrences: [
      { baseName: "document", memberName: "cookie", coordinate: { line: 7, column: 12 } },
      { baseName: "window", memberName: "localStorage", coordinate: { line: 8, column: 12 } },
      {
        baseName: "globalThis",
        memberName: "sessionStorage",
        coordinate: { line: 9, column: 12 },
      },
    ],
  });

  const diagnostics = new PresentationPlatformStateAccessPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 5);
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.line),
    [5, 6, 7, 8, 9],
  );
  assert.equal(diagnostics[0]!.ruleID, "presentation.platform_state_access");
  assert.ok(diagnostics[0]!.message.includes("localStorage"));
});

test("presentation.platform_state_access flags process and import-meta env state in Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    staticMemberAccessOccurrences: [
      { baseName: "process", memberName: "env", coordinate: { line: 4, column: 12 } },
      { baseName: "import.meta", memberName: "env", coordinate: { line: 5, column: 12 } },
    ],
  });

  const diagnostics = new PresentationPlatformStateAccessPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.message.includes("env")),
    [true, true],
  );
});

test("presentation.platform_state_access flags clipboard handles in Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Views/OrderView.tsx",
    roleFolder: RoleFolder.PresentationViews,
    staticMemberAccessOccurrences: [
      {
        baseName: "navigator",
        memberName: "clipboard",
        coordinate: { line: 8, column: 12 },
      },
    ],
    typedMemberOccurrences: [
      {
        name: "clipboard",
        typeNames: ["Clipboard"],
        coordinate: { line: 10, column: 11 },
      },
    ],
  });

  const diagnostics = new PresentationPlatformStateAccessPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.line),
    [8, 10],
  );
});

test("presentation.platform_state_access allows ordinary Presentation state", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    identifierOccurrences: [
      { name: "windowTitle", coordinate: { line: 3, column: 9 } },
      { name: "documentTitle", coordinate: { line: 4, column: 9 } },
      { name: "environmentLabel", coordinate: { line: 5, column: 9 } },
    ],
  });

  const diagnostics = new PresentationPlatformStateAccessPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.platform_state_access ignores unrelated same-line platform-shaped identifiers", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    identifierOccurrences: [
      { name: "document", coordinate: { line: 4, column: 9 } },
      { name: "cookie", coordinate: { line: 4, column: 30 } },
      { name: "cookie", coordinate: { line: 4, column: 58 } },
    ],
  });

  const diagnostics = new PresentationPlatformStateAccessPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.platform_state_access stays silent outside Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Infrastructure/Gateways/BrowserStorageGateway.ts",
    layer: ArchitectureLayer.Infrastructure,
    roleFolder: RoleFolder.InfrastructureGateways,
    identifierOccurrences: [
      { name: "localStorage", coordinate: { line: 6, column: 12 } },
      { name: "process", coordinate: { line: 7, column: 12 } },
      { name: "env", coordinate: { line: 7, column: 20 } },
    ],
  });

  const diagnostics = new PresentationPlatformStateAccessPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.platform_state_access is registered by default and in the Presentation factory", () => {
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) => policy.constructor === PresentationPlatformStateAccessPolicy,
    ),
  );
  assert.ok(
    makePresentationArchitecturePolicies().some(
      (policy) => policy.constructor === PresentationPlatformStateAccessPolicy,
    ),
  );
});

// ============================================================================
// presentation.calendar_day_bucketing
// ============================================================================

test("presentation.calendar_day_bucketing flags clear day-bucketing member calls in Presentation", () => {
  const Policy = (PresentationPolicies as any).PresentationCalendarDayBucketingPolicy;
  assert.ok(Policy, "expected PresentationCalendarDayBucketingPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderCalendarViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    memberCallOccurrences: [
      {
        baseName: "calendar",
        memberName: "startOfDay",
        coordinate: { line: 7, column: 21 },
      },
      {
        baseName: "calendar",
        memberName: "isToday",
        coordinate: { line: 9, column: 16 },
      },
    ],
  });

  const diagnostics = new Policy().evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 2);
  assert.deepEqual(
    diagnostics.map((diagnostic: { readonly ruleID: string }) => diagnostic.ruleID),
    ["presentation.calendar_day_bucketing", "presentation.calendar_day_bucketing"],
  );
  assert.deepEqual(
    diagnostics.map((diagnostic: { readonly line: number }) => diagnostic.line),
    [7, 9],
  );
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.calendar_day_bucketing ignores unrelated member calls", () => {
  const Policy = (PresentationPolicies as any).PresentationCalendarDayBucketingPolicy;
  assert.ok(Policy, "expected PresentationCalendarDayBucketingPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderCalendarViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    memberCallOccurrences: [
      {
        baseName: "formatter",
        memberName: "format",
        coordinate: { line: 6, column: 12 },
      },
    ],
  });

  const diagnostics = new Policy().evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 0);
});

test("presentation.calendar_day_bucketing stays silent outside Presentation", () => {
  const Policy = (PresentationPolicies as any).PresentationCalendarDayBucketingPolicy;
  assert.ok(Policy, "expected PresentationCalendarDayBucketingPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Application/Services/OrderCalendarService.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationServices,
    memberCallOccurrences: [
      {
        baseName: "calendar",
        memberName: "startOfDay",
        coordinate: { line: 12, column: 18 },
      },
    ],
  });

  const diagnostics = new Policy().evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 0);
});

test("presentation.calendar_day_bucketing is registered by default and in the Presentation factory", () => {
  const Policy = (PresentationPolicies as any).PresentationCalendarDayBucketingPolicy;
  assert.ok(Policy, "expected PresentationCalendarDayBucketingPolicy to be exported");

  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) => policy.constructor === Policy,
    ),
  );
  assert.ok(
    makePresentationArchitecturePolicies().some(
      (policy) => policy.constructor === Policy,
    ),
  );
});

// ============================================================================
// PresentationControllersUseCaseReferencePolicy un-registration
// ============================================================================

test("default registry no longer ships PresentationControllersUseCaseReferencePolicy (deprecated in Swift)", () => {
  const policies = DefaultArchitecturePolicies.make();
  assert.ok(
    !policies.some(
      (policy) => policy.constructor === PresentationControllersUseCaseReferencePolicy,
    ),
    "Swift deprecated this controllers-specific rule and does not register it by default; TS now mirrors that.",
  );
});

test("default registry still ships the broad PresentationUseCaseReferencePolicy", () => {
  const policies = DefaultArchitecturePolicies.make();
  assert.ok(
    policies.some(
      (policy) => policy.constructor === PresentationUseCaseReferencePolicy,
    ),
  );
});

test("controllers with a UseCase reference fire only the broad rule under the default registry", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrderController",
        name: "fetchOrder",
        typeNames: ["FetchOrderUseCase"],
        isStatic: false,
        coordinate: { line: 4, column: 1 },
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

  const diagnostics = DefaultArchitecturePolicies.make().flatMap((policy) =>
    policy.evaluate(file, context),
  );

  const useCaseRuleHits = diagnostics.filter(
    (diagnostic) =>
      diagnostic.ruleID === "presentation.usecase_reference" ||
      diagnostic.ruleID === "presentation.controllers.usecase_reference",
  );

  assert.ok(
    useCaseRuleHits.some((d) => d.ruleID === "presentation.usecase_reference"),
    "broad rule must fire",
  );
  assert.ok(
    !useCaseRuleHits.some((d) => d.ruleID === "presentation.controllers.usecase_reference"),
    "deprecated controllers-specific rule must NOT fire under the default registry",
  );
});

// ============================================================================
// presentation.application_function_seam
// ============================================================================

test("presentation.application_function_seam flags Application command parameter closures", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    functionTypeOccurrences: [
      {
        coordinate: { line: 12, column: 17 },
        parameterTypeNames: ["SubmitOrderCommand"],
        returnTypeNames: [],
        isAsync: false,
        isVoidLikeReturn: true,
      },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "SubmitOrderCommand",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Application/Contracts/Commands/SubmitOrderCommand.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsCommands,
    }),
  ]);

  const diagnostics = new Policy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.application_function_seam");
  assert.equal(diagnostics[0]!.line, 12);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.application_function_seam flags Application return closures once per occurrence", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    functionTypeOccurrences: [
      {
        coordinate: { line: 8, column: 14 },
        parameterTypeNames: ["FetchOrderCommand"],
        returnTypeNames: ["OrderWorkflowContract"],
        isAsync: false,
        isVoidLikeReturn: false,
      },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "FetchOrderCommand",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Application/Contracts/Commands/FetchOrderCommand.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsCommands,
    }),
    makeDeclaration({
      name: "OrderWorkflowContract",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderWorkflowContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics = new Policy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.application_function_seam");
  assert.equal(diagnostics[0]!.line, 8);
});

test("presentation.application_function_seam flags Promise-returning Application closures as async workflow seams", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Views/OrderView.tsx",
    roleFolder: RoleFolder.PresentationViews,
    functionTypeOccurrences: [
      {
        coordinate: { line: 19, column: 9 },
        parameterTypeNames: [],
        returnTypeNames: ["OrderWorkflowContract"],
        isAsync: true,
        isVoidLikeReturn: false,
      },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderWorkflowContract",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderWorkflowContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics = new Policy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.application_function_seam");
  assert.equal(diagnostics[0]!.line, 19);
});

test("presentation.application_function_seam flags PromiseLike-returning Application closures as async workflow seams", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Views/OrderView.tsx",
    roleFolder: RoleFolder.PresentationViews,
    functionTypeOccurrences: [
      {
        coordinate: { line: 21, column: 9 },
        parameterTypeNames: [],
        returnTypeNames: ["ApplicationContract"],
        isAsync: true,
        isVoidLikeReturn: false,
      },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "ApplicationContract",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/ApplicationContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics = new Policy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.application_function_seam");
  assert.equal(diagnostics[0]!.line, 21);
});

test("presentation.application_function_seam ignores PromiseLike void metadata even when Application declares PromiseLike", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Views/OrderView.tsx",
    roleFolder: RoleFolder.PresentationViews,
    functionTypeOccurrences: [
      {
        coordinate: { line: 21, column: 9 },
        parameterTypeNames: [],
        returnTypeNames: [],
        isAsync: true,
        isVoidLikeReturn: true,
      },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "PromiseLike",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/PromiseLike.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
  ]);

  const diagnostics = new Policy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("presentation.application_function_seam flags non-void non-command Application parameter closures", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    functionTypeOccurrences: [
      {
        coordinate: { line: 23, column: 11 },
        parameterTypeNames: ["OrderWorkflowContract"],
        returnTypeNames: ["OrderViewState"],
        isAsync: false,
        isVoidLikeReturn: false,
      },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderWorkflowContract",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Application/Contracts/Workflow/OrderWorkflowContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    }),
    makeDeclaration({
      name: "OrderViewState",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewState.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationViewModels,
    }),
  ]);

  const diagnostics = new Policy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.application_function_seam");
  assert.equal(diagnostics[0]!.line, 23);
});

test("presentation.application_function_seam ignores non-Application function types", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Presenters/OrderPresenter.ts",
    roleFolder: RoleFolder.PresentationPresenters,
    functionTypeOccurrences: [
      {
        coordinate: { line: 7, column: 21 },
        parameterTypeNames: ["OrderDTO"],
        returnTypeNames: ["DisplayModel"],
        isAsync: false,
        isVoidLikeReturn: false,
      },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderDTO",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Presentation/DTOs/OrderDTO.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationDTOs,
    }),
    makeDeclaration({
      name: "DisplayModel",
      kind: NominalKind.Interface,
      repoRelativePath: "Symphony/Presentation/ViewModels/DisplayModel.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationViewModels,
    }),
  ]);

  const diagnostics = new Policy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("presentation.application_function_seam is registered by default and in the Presentation factory", () => {
  const Policy = (PresentationPolicies as any).PresentationApplicationFunctionSeamPolicy;
  assert.ok(Policy, "expected PresentationApplicationFunctionSeamPolicy to be exported");
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) => policy.constructor === Policy,
    ),
  );
  assert.ok(
    makePresentationArchitecturePolicies().some(
      (policy) => policy.constructor === Policy,
    ),
  );
});

// ============================================================================
// presentation.state_transition_reference
// ============================================================================

test("presentation.state_transition_reference flags type reference, construction, and static access to Application StateTransition", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    typeReferences: [
      { name: "OrderStateTransition", coordinate: { line: 5, column: 18 } },
    ],
    constructionOccurrences: [
      { typeName: "OrderStateTransition", coordinate: { line: 9, column: 21 } },
    ],
    staticMemberAccessOccurrences: [
      {
        baseName: "OrderStateTransition",
        memberName: "apply",
        coordinate: { line: 12, column: 12 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderStateTransition",
      kind: NominalKind.Class,
      repoRelativePath:
        "Symphony/Application/StateTransitions/OrderStateTransition.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationStateTransitions,
    }),
  ]);

  const diagnostics = new PresentationStateTransitionReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.ruleID, "presentation.state_transition_reference");
  assert.equal(diagnostics[0]!.line, 5);
  assert.ok(diagnostics[0]!.message.includes("OrderStateTransition"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostics[0]!.message.includes(marker));
  }
});

test("presentation.state_transition_reference stays silent outside Presentation", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationServices,
    typeReferences: [
      { name: "OrderStateTransition", coordinate: { line: 4, column: 18 } },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderStateTransition",
      kind: NominalKind.Class,
      repoRelativePath:
        "Symphony/Application/StateTransitions/OrderStateTransition.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationStateTransitions,
    }),
  ]);

  const diagnostics = new PresentationStateTransitionReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.state_transition_reference ignores unrelated Application contract and service references", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    typeReferences: [
      { name: "UpdateOrderCommand", coordinate: { line: 5, column: 18 } },
      { name: "OrderService", coordinate: { line: 6, column: 18 } },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "UpdateOrderCommand",
      kind: NominalKind.Class,
      repoRelativePath:
        "Symphony/Application/Contracts/Commands/UpdateOrderCommand.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsCommands,
    }),
    makeDeclaration({
      name: "OrderService",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Application/Services/OrderService.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
    }),
  ]);

  const diagnostics = new PresentationStateTransitionReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.state_transition_reference ignores a local same-name Presentation declaration", () => {
  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    topLevelDeclarations: [
      {
        name: "OrderStateTransition",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 1 },
      },
    ],
    typeReferences: [
      { name: "OrderStateTransition", coordinate: { line: 5, column: 18 } },
    ],
    memberCallOccurrences: [
      {
        baseName: "OrderStateTransition",
        memberName: "apply",
        coordinate: { line: 8, column: 12 },
      },
    ],
  });

  const context = new ProjectContext([
    makeDeclaration({
      name: "OrderStateTransition",
      kind: NominalKind.Class,
      repoRelativePath:
        "Symphony/Application/StateTransitions/OrderStateTransition.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationStateTransitions,
    }),
  ]);

  const diagnostics = new PresentationStateTransitionReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 0);
});

test("presentation.state_transition_reference is registered by default and in the Presentation factory", () => {
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) =>
        policy.constructor === PresentationStateTransitionReferencePolicy,
    ),
  );
  assert.ok(
    makePresentationArchitecturePolicies().some(
      (policy) =>
        policy.constructor === PresentationStateTransitionReferencePolicy,
    ),
  );
});

// ============================================================================
// Rich-remediation acceptance for Presentation legacy helper
// ============================================================================

test("Presentation legacy helper now emits all five Swift-parity markers", async () => {
  const { PresentationInfrastructureReferencePolicy } = await import(
    "../../src/Domain/Policies/PresentationArchitecturePolicies.ts"
  );

  const file = makePresentationFile({
    repoRelativePath: "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    typeReferences: [
      { name: "PostgresOrdersRepository", coordinate: { line: 3, column: 1 } },
    ],
  });
  const context = new ProjectContext([
    makeDeclaration({
      name: "PostgresOrdersRepository",
      kind: NominalKind.Class,
      repoRelativePath: "Symphony/Infrastructure/Repositories/PostgresOrdersRepository.ts",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
    }),
  ]);

  const diagnostics = new PresentationInfrastructureReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(
      diagnostics[0]!.message.includes(marker),
      `expected marker '${marker}' in legacy-Presentation-helper output: ${diagnostics[0]!.message}`,
    );
  }
});

// ============================================================================
// Helpers
// ============================================================================

function makePresentationFile(input: {
  readonly repoRelativePath: string;
  readonly roleFolder: RoleFolder;
  readonly layer?: ArchitectureLayer;
  readonly storedMemberDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["storedMemberDeclarations"];
  readonly typeReferences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["typeReferences"];
  readonly topLevelDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["topLevelDeclarations"];
  readonly constructionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["constructionOccurrences"];
  readonly staticMemberAccessOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["staticMemberAccessOccurrences"];
  readonly identifierOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["identifierOccurrences"];
  readonly typedMemberOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["typedMemberOccurrences"];
  readonly memberCallOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["memberCallOccurrences"];
  readonly dependencyResolutionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["dependencyResolutionOccurrences"];
  readonly functionTypeOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["functionTypeOccurrences"];
}): ArchitectureFile {
  const pathComponents = input.repoRelativePath.split("/");
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer ?? ArchitectureLayer.Presentation,
      roleFolder: input.roleFolder,
      pathComponents,
      fileName: pathComponents.at(-1) ?? "unknown.ts",
      fileStem: pathComponents.at(-1)?.replace(/\.[^.]+$/, "") ?? "unknown",
    }),
    imports: [],
    functionTypeOccurrences: input.functionTypeOccurrences ?? [],
    identifierOccurrences: input.identifierOccurrences ?? [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: input.typedMemberOccurrences ?? [],
    memberCallOccurrences: input.memberCallOccurrences ?? [],
    methodDeclarations: [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: input.storedMemberDeclarations ?? [],
    operationalUseOccurrences: [],
    typeReferences: input.typeReferences ?? [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    topLevelValueDeclarations: [],
    nestedNominalDeclarations: [],
    constructionOccurrences: input.constructionOccurrences ?? [],
    staticMemberAccessOccurrences: input.staticMemberAccessOccurrences ?? [],
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
