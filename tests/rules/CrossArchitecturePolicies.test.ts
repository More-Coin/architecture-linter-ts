import test from "node:test";
import assert from "node:assert/strict";

import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
import {
  ArchitectureServiceRolePlacementPolicy,
  DomainDependencyResolutionPolicy,
  TechnicalSeamProtocolPlacementPolicy,
} from "../../src/Domain/Policies/CrossArchitecturePolicies.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { RICH_REMEDIATION_MARKERS } from "../../src/Domain/Policies/shared/RichRemediationMessage.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

// =============================================================================
// domain.dependency_resolution
// =============================================================================

test("domain.dependency_resolution flags Container.resolve inside Domain", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
    dependencyResolutionOccurrences: [
      {
        baseName: "Container",
        memberName: "resolve",
        coordinate: { line: 7, column: 12 },
      },
    ],
  });

  const diagnostics = new DomainDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  const diagnostic = diagnostics[0]!;
  assert.equal(diagnostic.ruleID, DomainDependencyResolutionPolicy.ruleID);
  assert.equal(diagnostic.line, 7);
  assert.equal(diagnostic.column, 12);
  assert.ok(diagnostic.message.includes("Container.resolve"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(
      diagnostic.message.includes(marker),
      `expected marker '${marker}' in: ${diagnostic.message}`,
    );
  }
});

test("domain.dependency_resolution flags @Inject decorator with decorator-shaped message", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
    dependencyResolutionOccurrences: [
      { baseName: "Inject", coordinate: { line: 3, column: 1 } },
    ],
  });

  const diagnostics = new DomainDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.ok(diagnostics[0]!.message.includes("@Inject"));
  assert.ok(
    diagnostics[0]!.message.includes("decorator-mediated injection"),
    `message should mention decorator-mediated injection, got: ${diagnostics[0]!.message}`,
  );
});

test("domain.dependency_resolution stays silent outside Domain", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationServices,
    dependencyResolutionOccurrences: [
      {
        baseName: "Container",
        memberName: "resolve",
        coordinate: { line: 5, column: 1 },
      },
    ],
  });

  const diagnostics = new DomainDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("domain.dependency_resolution stays silent for clean Domain files", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
  });

  const diagnostics = new DomainDependencyResolutionPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("domain.dependency_resolution can be disabled via disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [DomainDependencyResolutionPolicy.ruleID],
  });

  assert.ok(
    !policies.some(
      (policy) => policy.constructor === DomainDependencyResolutionPolicy,
    ),
  );
});

// =============================================================================
// architecture.service_role_placement
// =============================================================================

test("architecture.service_role_placement flags Service-suffixed type outside Application/Services", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Gateways/OrdersService.ts",
    layer: ArchitectureLayer.Infrastructure,
    roleFolder: RoleFolder.InfrastructureGateways,
    topLevelDeclarations: [
      {
        name: "OrdersService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 4, column: 14 },
      },
    ],
  });

  const diagnostics = new ArchitectureServiceRolePlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  const diagnostic = diagnostics[0]!;
  assert.equal(diagnostic.ruleID, ArchitectureServiceRolePlacementPolicy.ruleID);
  assert.equal(diagnostic.line, 4);
  assert.equal(diagnostic.column, 14);
  assert.ok(diagnostic.message.includes("'OrdersService'"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostic.message.includes(marker));
  }
});

test("architecture.service_role_placement stays silent for Application/Services files", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Services/OrderService.ts",
    layer: ArchitectureLayer.Application,
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

  const diagnostics = new ArchitectureServiceRolePlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("architecture.service_role_placement skips test files", () => {
  const file = makeFile({
    repoRelativePath: "tests/rules/SomeService.test.ts",
    layer: ArchitectureLayer.Tests,
    roleFolder: RoleFolder.None,
    pathComponents: ["tests", "rules", "SomeService.test.ts"],
    topLevelDeclarations: [
      {
        name: "FakeService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new ArchitectureServiceRolePlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("architecture.service_role_placement can be disabled via disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ArchitectureServiceRolePlacementPolicy.ruleID],
  });

  assert.ok(
    !policies.some(
      (policy) => policy.constructor === ArchitectureServiceRolePlacementPolicy,
    ),
  );
});

// =============================================================================
// architecture.technical_seam_protocol_placement
// =============================================================================

test("architecture.technical_seam_protocol_placement flags GatewayInterface in Infrastructure", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Gateways/PaymentGatewayInterface.ts",
    layer: ArchitectureLayer.Infrastructure,
    roleFolder: RoleFolder.InfrastructureGateways,
    topLevelDeclarations: [
      {
        name: "PaymentGatewayInterface",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 18 },
      },
    ],
  });

  const diagnostics = new TechnicalSeamProtocolPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  const diagnostic = diagnostics[0]!;
  assert.equal(diagnostic.ruleID, TechnicalSeamProtocolPlacementPolicy.ruleID);
  assert.ok(diagnostic.message.includes("'PaymentGatewayInterface'"));
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(diagnostic.message.includes(marker));
  }
});

test("architecture.technical_seam_protocol_placement accepts PortProtocol family in Application/Ports/Protocols", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Ports/Protocols/NotifierPortProtocol.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationPortsProtocols,
    topLevelDeclarations: [
      {
        name: "NotifierPortProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new TechnicalSeamProtocolPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("architecture.technical_seam_protocol_placement accepts Repository family in Domain/Protocols", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Protocols/OrdersRepositoryProtocol.ts",
    layer: ArchitectureLayer.Domain,
    roleFolder: RoleFolder.DomainProtocols,
    topLevelDeclarations: [
      {
        name: "OrdersRepositoryProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new TechnicalSeamProtocolPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("architecture.technical_seam_protocol_placement rejects PortProtocol family in Domain/Protocols", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Protocols/NotifierPortProtocol.ts",
    layer: ArchitectureLayer.Domain,
    roleFolder: RoleFolder.DomainProtocols,
    topLevelDeclarations: [
      {
        name: "NotifierPortProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new TechnicalSeamProtocolPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]!.ruleID,
    TechnicalSeamProtocolPlacementPolicy.ruleID,
  );
});

test("architecture.technical_seam_protocol_placement ignores non-protocol declarations", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Gateways/PaymentGatewayProtocol.ts",
    layer: ArchitectureLayer.Infrastructure,
    roleFolder: RoleFolder.InfrastructureGateways,
    topLevelDeclarations: [
      {
        name: "PaymentGatewayProtocol",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new TechnicalSeamProtocolPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 0);
});

test("architecture.technical_seam_protocol_placement can be disabled via disabledRuleIDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [TechnicalSeamProtocolPlacementPolicy.ruleID],
  });

  assert.ok(
    !policies.some(
      (policy) => policy.constructor === TechnicalSeamProtocolPlacementPolicy,
    ),
  );
});

// =============================================================================
// Stage 3 — Domain rich-remediation pass spot check
// =============================================================================

test("domain rich-remediation pass: forbidden-import diagnostic contains all 5 markers", async () => {
  const { DomainForbiddenImportPolicy } = await import(
    "../../src/Domain/Policies/DomainArchitecturePolicies.ts"
  );

  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
    imports: [{ moduleName: "node:fs", coordinate: { line: 1, column: 1 } }],
    topLevelDeclarations: [
      {
        name: "OrderPolicy",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 2, column: 1 },
      },
    ],
  });

  const diagnostics = new DomainForbiddenImportPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(
      diagnostics[0]!.message.includes(marker),
      `expected marker '${marker}' in: ${diagnostics[0]!.message}`,
    );
  }
});

// =============================================================================
// Helpers
// =============================================================================

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer?: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly pathComponents?: readonly string[];
  readonly imports?: ConstructorParameters<typeof ArchitectureFile>[0]["imports"];
  readonly topLevelDeclarations?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["topLevelDeclarations"];
  readonly dependencyResolutionOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["dependencyResolutionOccurrences"];
}): ArchitectureFile {
  const pathComponents =
    input.pathComponents ?? input.repoRelativePath.split("/");
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer ?? ArchitectureLayer.Domain,
      roleFolder: input.roleFolder,
      pathComponents,
      fileName: pathComponents.at(-1) ?? "unknown.ts",
      fileStem:
        pathComponents.at(-1)?.replace(/\.[^.]+$/, "") ?? "unknown",
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
    topLevelValueDeclarations: [],
    nestedNominalDeclarations: [],
    constructionOccurrences: [],
    staticMemberAccessOccurrences: [],
    decoratorOccurrences: [],
    dependencyResolutionOccurrences: input.dependencyResolutionOccurrences ?? [],
  });
}
