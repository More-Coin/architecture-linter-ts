import test from "node:test";
import assert from "node:assert/strict";

import {
  PresentationCompositionReferencePolicy,
  PresentationControllersUseCaseReferencePolicy,
  PresentationDependencyResolutionPolicy,
  PresentationPortProtocolReferencePolicy,
  PresentationUseCaseReferencePolicy,
} from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
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
  readonly dependencyResolutionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["dependencyResolutionOccurrences"];
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
    functionTypeOccurrences: [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: input.storedMemberDeclarations ?? [],
    operationalUseOccurrences: [],
    typeReferences: input.typeReferences ?? [],
    topLevelDeclarations: [],
    topLevelValueDeclarations: [],
    nestedNominalDeclarations: [],
    constructionOccurrences: [],
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
