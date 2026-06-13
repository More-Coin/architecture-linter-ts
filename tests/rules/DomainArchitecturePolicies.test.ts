import test from "node:test";
import assert from "node:assert/strict";

import {
  DomainDeliveryVocabularyPolicy,
  DomainDurableStructurePolicy,
  DomainErrorsPlacementPolicy,
  DomainErrorsShapePolicy,
  DomainForbiddenImportPolicy,
  DomainOuterLayerReferencePolicy,
  DomainOuterArtifactStringLiteralsPolicy,
  DomainPoliciesSinglePolicySurfacePolicy,
  RepositoryProtocolPlacementPolicy,
  makeDomainArchitecturePolicies,
} from "../../src/Domain/Policies/DomainArchitecturePolicies.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("domain forbidden import policy flags framework imports", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
    imports: [{ moduleName: "node:fs", coordinate: coordinate(1) }],
    topLevelDeclarations: [
      {
        name: "OrderPolicy",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new DomainForbiddenImportPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainForbiddenImportPolicy.ruleID);
});

test("domain.outer_layer_reference flags ambiguous same-name outer declarations", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Entities/Order.ts",
    roleFolder: RoleFolder.DomainEntities,
    typeReferences: [
      {
        name: "OrderSummary",
        coordinate: coordinate(6),
      },
    ],
  });

  const context = new ProjectContext([
    {
      name: "OrderSummary",
      kind: NominalKind.Struct,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "Symphony/Domain/ValueObjects/OrderSummary.ts",
      layer: ArchitectureLayer.Domain,
      roleFolder: RoleFolder.DomainValueObjects,
    },
    {
      name: "OrderSummary",
      kind: NominalKind.Class,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "Symphony/Presentation/ViewModels/OrderSummary.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationViewModels,
    },
  ]);

  const diagnostics = new DomainOuterLayerReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainOuterLayerReferencePolicy.ruleID);
  assert.equal(diagnostics[0]?.line, 6);
  assert.match(diagnostics[0]?.message ?? "", /Presentation/);
});

test("domain durable structure policy flags unsupported domain subfolders", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Services/OrderPolicy.ts",
    roleFolder: RoleFolder.None,
    topLevelDeclarations: [
      {
        name: "OrderPolicy",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new DomainDurableStructurePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainDurableStructurePolicy.ruleID);
});

test("domain errors shape policy requires StructuredErrorProtocol and required members", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Errors/OrderError.ts",
    roleFolder: RoleFolder.DomainErrors,
    topLevelDeclarations: [
      {
        name: "OrderError",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: ["code", "message"],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new DomainErrorsShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, DomainErrorsShapePolicy.ruleID);
  assert.equal(diagnostics[1]?.ruleID, DomainErrorsShapePolicy.ruleID);
});

test("domain errors placement policy flags structured errors outside Domain/Errors", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderError.ts",
    roleFolder: RoleFolder.DomainPolicies,
    topLevelDeclarations: [
      {
        name: "OrderError",
        kind: NominalKind.Struct,
        inheritedTypeNames: ["StructuredErrorProtocol"],
        memberNames: ["code", "message", "retryable", "details"],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new DomainErrorsPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainErrorsPlacementPolicy.ruleID);
});

test("domain policies single policy surface flags non-policy top-level declarations", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
    topLevelDeclarations: [
      {
        name: "OrderPolicy",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
      {
        name: "OrderDecision",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(5),
      },
    ],
  });

  const diagnostics = new DomainPoliciesSinglePolicySurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    DomainPoliciesSinglePolicySurfacePolicy.ruleID,
  );
  assert.match(diagnostics[0]?.message ?? "", /OrderDecision/);
  assert.equal(diagnostics[0]?.line, 5);
  assert.equal(diagnostics[0]?.column, 1);
});

test("domain policies single policy surface ignores policy-suffixed declarations and protocols", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
    topLevelDeclarations: [
      {
        name: "OrderPolicy",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
      {
        name: "OrderPolicyProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(5),
      },
    ],
  });

  const diagnostics = new DomainPoliciesSinglePolicySurfacePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.deepEqual(diagnostics, []);
});

test("domain delivery vocabulary policy flags delivery and platform terms in Domain identifiers", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/RefreshDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    identifierOccurrences: [
      { name: "BackgroundRefreshDecision", coordinate: coordinate(3) },
    ],
  });

  const diagnostics = new DomainDeliveryVocabularyPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainDeliveryVocabularyPolicy.ruleID);
  assert.match(diagnostics[0]?.message ?? "", /BackgroundRefreshDecision/);
  assert.match(diagnostics[0]?.message ?? "", /backgroundrefresh/);
  assert.equal(diagnostics[0]?.line, 3);
});

test("domain delivery vocabulary policy allows configured identifiers", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/RefreshDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    identifierOccurrences: [
      { name: "BackgroundRefreshDecision", coordinate: coordinate(3) },
    ],
  });

  const diagnostics = new DomainDeliveryVocabularyPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    domainVocabularyAllowedIdentifiers: ["BackgroundRefreshDecision"],
  }).evaluate(file, new ProjectContext([]));

  assert.deepEqual(diagnostics, []);
});

test("domain delivery vocabulary policy dedupes diagnostics by matched fragment", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/RefreshDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    identifierOccurrences: [
      { name: "BackgroundRefreshDecision", coordinate: coordinate(3) },
      { name: "BackgroundRefreshWindow", coordinate: coordinate(8) },
    ],
  });

  const diagnostics = new DomainDeliveryVocabularyPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.line, 3);
});

test("domain delivery vocabulary policy does not flag normal identifiers containing short tool acronyms", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/ClaimsWorkflow.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    identifierOccurrences: [
      { name: "ClaimsWorkflow", coordinate: coordinate(3) },
      { name: "MockClaimsWorkflow", coordinate: coordinate(8) },
    ],
  });

  const diagnostics = new DomainDeliveryVocabularyPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainDeliveryVocabularyPolicy.ruleID);
  assert.match(diagnostics[0]?.message ?? "", /MockClaimsWorkflow/);
  assert.match(diagnostics[0]?.message ?? "", /mock/);
  assert.equal(diagnostics[0]?.line, 8);
});

test("domain outer artifact string literals policy flags default outer artifact fragments in Domain literals", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/ClaimDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    stringLiteralOccurrences: [
      {
        value: "Use storage key customer.claim.state",
        coordinate: coordinate(4),
      },
      {
        value: "Another storage key customer.claim.title",
        coordinate: coordinate(7),
      },
      {
        value: "Expose diagnostic summary to logs",
        coordinate: coordinate(9),
      },
    ],
  });

  const diagnostics = new DomainOuterArtifactStringLiteralsPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(
    diagnostics[0]?.ruleID,
    "domain.outer_artifact_string_literals",
  );
  assert.match(diagnostics[0]?.message ?? "", /storage key/);
  assert.equal(diagnostics[0]?.line, 4);
  assert.match(diagnostics[1]?.message ?? "", /diagnostic/);
  assert.equal(diagnostics[1]?.line, 9);
});

test("domain outer artifact string literals policy flags 3 segment dotted catalog key literals once per value", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/ClaimDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    stringLiteralOccurrences: [
      { value: "feature.claim.title", coordinate: coordinate(3) },
      { value: "feature.claim.title", coordinate: coordinate(8) },
      { value: "feature.claim", coordinate: coordinate(12) },
    ],
  });

  const diagnostics = new DomainOuterArtifactStringLiteralsPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0]?.message ?? "", /feature\.claim\.title/);
  assert.equal(diagnostics[0]?.line, 3);
});

test("domain outer artifact string literals policy ignores Domain error files", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Errors/ClaimError.ts",
    roleFolder: RoleFolder.DomainErrors,
    stringLiteralOccurrences: [
      { value: "storage key claim.error.state", coordinate: coordinate(3) },
      { value: "feature.claim.title", coordinate: coordinate(4) },
    ],
  });

  const diagnostics = new DomainOuterArtifactStringLiteralsPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.deepEqual(diagnostics, []);
});

test("domain outer artifact string literals policy uses configured fragments and storage namespaces", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/ClaimDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    stringLiteralOccurrences: [
      { value: "vendor claim envelope", coordinate: coordinate(3) },
      { value: "tenant.cache.claims", coordinate: coordinate(8) },
      { value: "business sentence", coordinate: coordinate(12) },
    ],
  });

  const diagnostics = new DomainOuterArtifactStringLiteralsPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    domainOuterArtifactFragments: ["vendor claim"],
    storageNamespacePrefixes: ["tenant.cache"],
  }).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.line, 3);
  assert.equal(diagnostics[1]?.line, 8);
});

test("domain outer artifact string literals policy does not default TypeScript-only fragments", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/ClaimDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    stringLiteralOccurrences: [
      { value: "gdpr disclosure marker", coordinate: coordinate(3) },
      { value: "route/claim/details", coordinate: coordinate(8) },
    ],
  });

  const diagnostics = new DomainOuterArtifactStringLiteralsPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.deepEqual(diagnostics, []);
});

test("domain outer artifact string literals policy flags TypeScript-only fragments when configured", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/ValueObjects/ClaimDecision.ts",
    roleFolder: RoleFolder.DomainValueObjects,
    stringLiteralOccurrences: [
      { value: "gdpr disclosure marker", coordinate: coordinate(3) },
      { value: "route/claim/details", coordinate: coordinate(8) },
    ],
  });

  const diagnostics = new DomainOuterArtifactStringLiteralsPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    domainOuterArtifactFragments: ["gdpr", "route/"],
  }).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.line, 3);
  assert.equal(diagnostics[1]?.line, 8);
});

test("domain architecture policy factory includes delivery vocabulary policy", () => {
  const policies = makeDomainArchitecturePolicies();

  assert.ok(
    policies.some((policy) => policy.constructor === DomainDeliveryVocabularyPolicy),
  );
});

test("domain architecture policy factory includes outer artifact string literals policy", () => {
  const policies = makeDomainArchitecturePolicies();

  assert.ok(
    policies.some(
      (policy) => policy.constructor === DomainOuterArtifactStringLiteralsPolicy,
    ),
  );
});

test("repository protocol placement flags repository protocols outside Domain/Protocols", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Ports/Protocols/OrderRepositoryProtocol.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationPortsProtocols,
    topLevelDeclarations: [
      {
        name: "OrderRepositoryProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new RepositoryProtocolPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, RepositoryProtocolPlacementPolicy.ruleID);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer?: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly imports?: ConstructorParameters<typeof ArchitectureFile>[0]["imports"];
  readonly identifierOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["identifierOccurrences"];
  readonly stringLiteralOccurrences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["stringLiteralOccurrences"];
  readonly typeReferences?: ConstructorParameters<
    typeof ArchitectureFile
  >[0]["typeReferences"];
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer ?? ArchitectureLayer.Domain,
      roleFolder: input.roleFolder,
      pathComponents: input.repoRelativePath.split("/"),
      fileName: input.repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
    }),
    imports: input.imports ?? [],
    functionTypeOccurrences: [],
    identifierOccurrences: input.identifierOccurrences ?? [],
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
    nestedNominalDeclarations: [],
  });
}

function coordinate(line: number) {
  return { line, column: 1 } as const;
}
