import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";

import {
  InfrastructureEmptyDirectoryPolicy,
  InfrastructureAdapterOnAdapterCompositionPolicy,
  InfrastructureApplicationContractBehaviorAttachmentPolicy,
  InfrastructureCrossLayerProtocolConformancePolicy,
  InfrastructureErrorsPlacementPolicy,
  InfrastructureErrorsShapePolicy,
  InfrastructureForbiddenPresentationDependencyPolicy,
  InfrastructureRepositoriesInlineBusinessLiteralsPolicy,
  InfrastructureUseCaseOrServiceReferencePolicy,
  InfrastructureRoleFolderStructurePolicy,
  InfrastructureRepositoriesShapePolicy,
  InfrastructureTranslationStructurePolicy,
  InfrastructureTranslationDirectionalNamingPolicy,
  makeInfrastructureArchitecturePolicies,
} from "../../src/Domain/Policies/InfrastructureArchitecturePolicies.ts";
import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
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

test("infrastructure.repositories.inline_business_literals flags dotted business key in Repository", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    stringLiteralOccurrences: [
      { value: "onboarding.rhythm.weekly", coordinate: coordinate(4) },
    ],
  });

  const diagnostics =
    new InfrastructureRepositoriesInlineBusinessLiteralsPolicy().evaluate(
      file,
      new ProjectContext([]),
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureRepositoriesInlineBusinessLiteralsPolicy.ruleID,
  );
  assert.match(diagnostics[0]?.message ?? "", /onboarding\.rhythm\.weekly/);
});

test("infrastructure.repositories.inline_business_literals flags natural-language copy in PortAdapter", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/PortAdapters/OrderPortAdapter.ts",
    roleFolder: RoleFolder.InfrastructurePortAdapters,
    stringLiteralOccurrences: [
      { value: "Your weekly onboarding rhythm is ready", coordinate: coordinate(8) },
    ],
  });

  const diagnostics =
    new InfrastructureRepositoriesInlineBusinessLiteralsPolicy().evaluate(
      file,
      new ProjectContext([]),
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureRepositoriesInlineBusinessLiteralsPolicy.ruleID,
  );
  assert.match(diagnostics[0]?.message ?? "", /PortAdapter/);
});

test("infrastructure.repositories.inline_business_literals exempts configured storage namespace prefix", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    stringLiteralOccurrences: [
      { value: "store.orders.snapshot", coordinate: coordinate(6) },
    ],
  });

  const diagnostics = new InfrastructureRepositoriesInlineBusinessLiteralsPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    storageNamespacePrefixes: ["store."],
  }).evaluate(file, new ProjectContext([]));

  assert.equal(diagnostics.length, 0);
});

test("infrastructure.repositories.inline_business_literals ignores non-repository and non-port-adapter Infrastructure files", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    stringLiteralOccurrences: [
      { value: "onboarding.rhythm.weekly", coordinate: coordinate(3) },
      { value: "Your weekly onboarding rhythm is ready", coordinate: coordinate(4) },
    ],
  });

  const diagnostics =
    new InfrastructureRepositoriesInlineBusinessLiteralsPolicy().evaluate(
      file,
      new ProjectContext([]),
    );

  assert.equal(diagnostics.length, 0);
});

test("infrastructure.repositories.inline_business_literals is registered by default", () => {
  assert.ok(
    makeInfrastructureArchitecturePolicies().some(
      (policy) =>
        policy.constructor === InfrastructureRepositoriesInlineBusinessLiteralsPolicy,
    ),
  );
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) =>
        policy.constructor === InfrastructureRepositoriesInlineBusinessLiteralsPolicy,
    ),
  );
});

test("infrastructure.adapter_on_adapter_composition flags Repository references to concrete sibling adapters", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    typeReferences: [
      { name: "StripeGateway", coordinate: coordinate(8) },
      { name: "AuditPortAdapter", coordinate: coordinate(13) },
      { name: "CustomerRepository", coordinate: coordinate(21) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "StripeGateway",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath: "Symphony/Infrastructure/Gateways/StripeGateway.ts",
    }),
    indexedDeclaration({
      name: "AuditPortAdapter",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructurePortAdapters,
      repoRelativePath:
        "Symphony/Infrastructure/PortAdapters/AuditPortAdapter.ts",
    }),
    indexedDeclaration({
      name: "CustomerRepository",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
      repoRelativePath:
        "Symphony/Infrastructure/Repositories/CustomerRepository.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureAdapterOnAdapterCompositionPolicy().evaluate(
      file,
      context,
    );

  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.ruleID),
    [
      InfrastructureAdapterOnAdapterCompositionPolicy.ruleID,
      InfrastructureAdapterOnAdapterCompositionPolicy.ruleID,
      InfrastructureAdapterOnAdapterCompositionPolicy.ruleID,
    ],
  );
  assert.deepEqual(
    diagnostics.map((diagnostic) => diagnostic.line),
    [8, 13, 21],
  );
  assert.match(diagnostics[0]?.message ?? "", /StripeGateway/);
});

test("infrastructure.adapter_on_adapter_composition flags construction, static access, and member-call references at the earliest coordinate", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    constructionOccurrences: [
      { typeName: "StripeGateway", coordinate: coordinate(12) },
    ],
    memberCallOccurrences: [
      {
        baseName: "CustomerRepository",
        memberName: "shared",
        coordinate: coordinate(5),
      },
    ],
    staticMemberAccessOccurrences: [
      {
        baseName: "AuditPortAdapter",
        memberName: "shared",
        coordinate: coordinate(9),
      },
      { baseName: "StripeGateway", memberName: "shared", coordinate: coordinate(7) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "StripeGateway",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath: "Symphony/Infrastructure/Gateways/StripeGateway.ts",
    }),
    indexedDeclaration({
      name: "AuditPortAdapter",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructurePortAdapters,
      repoRelativePath:
        "Symphony/Infrastructure/PortAdapters/AuditPortAdapter.ts",
    }),
    indexedDeclaration({
      name: "CustomerRepository",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
      repoRelativePath:
        "Symphony/Infrastructure/Repositories/CustomerRepository.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureAdapterOnAdapterCompositionPolicy().evaluate(
      file,
      context,
    );

  assert.deepEqual(
    diagnostics.map((diagnostic) => [
      diagnostic.message.match(/'(StripeGateway|AuditPortAdapter|CustomerRepository)'/)?.[1],
      diagnostic.line,
    ]),
    [
      ["StripeGateway", 7],
      ["AuditPortAdapter", 9],
      ["CustomerRepository", 5],
    ],
  );
});

test("infrastructure.adapter_on_adapter_composition flags Application StateTransition references", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    typeReferences: [
      { name: "OrderStateTransition", coordinate: coordinate(17) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "OrderStateTransition",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationStateTransitions,
      repoRelativePath:
        "Symphony/Application/StateTransitions/OrderStateTransition.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureAdapterOnAdapterCompositionPolicy().evaluate(
      file,
      context,
    );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureAdapterOnAdapterCompositionPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 17);
  assert.match(diagnostics[0]?.message ?? "", /OrderStateTransition/);
});

test("infrastructure.adapter_on_adapter_composition ignores same-file and local declarations", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    topLevelDeclarations: [
      {
        name: "StripeGateway",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
    nestedNominalDeclarations: [
      {
        name: "AuditPortAdapter",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(5),
      },
    ],
    typeReferences: [
      { name: "StripeGateway", coordinate: coordinate(10) },
      { name: "AuditPortAdapter", coordinate: coordinate(12) },
      { name: "CustomerRepository", coordinate: coordinate(14) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "StripeGateway",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath: "Symphony/Infrastructure/Gateways/StripeGateway.ts",
    }),
    indexedDeclaration({
      name: "AuditPortAdapter",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructurePortAdapters,
      repoRelativePath:
        "Symphony/Infrastructure/PortAdapters/AuditPortAdapter.ts",
    }),
    indexedDeclaration({
      name: "CustomerRepository",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureRepositories,
      repoRelativePath: file.repoRelativePath,
    }),
  ]);

  const diagnostics =
    new InfrastructureAdapterOnAdapterCompositionPolicy().evaluate(
      file,
      context,
    );

  assert.equal(diagnostics.length, 0);
});

test("infrastructure.adapter_on_adapter_composition ignores non-adapter Infrastructure files and non-concrete declarations", () => {
  const translationFile = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Translation/Models/OrderProjectionModel.ts",
    roleFolder: RoleFolder.InfrastructureTranslationModels,
    typeReferences: [
      { name: "StripeGateway", coordinate: coordinate(6) },
    ],
  });
  const repositoryFile = makeFile({
    repoRelativePath: "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    typeReferences: [
      { name: "GatewayProtocol", coordinate: coordinate(8) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "StripeGateway",
      kind: NominalKind.Class,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath: "Symphony/Infrastructure/Gateways/StripeGateway.ts",
    }),
    indexedDeclaration({
      name: "GatewayProtocol",
      kind: NominalKind.Protocol,
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath: "Symphony/Infrastructure/Gateways/GatewayProtocol.ts",
    }),
  ]);

  assert.equal(
    new InfrastructureAdapterOnAdapterCompositionPolicy().evaluate(
      translationFile,
      context,
    ).length,
    0,
  );
  assert.equal(
    new InfrastructureAdapterOnAdapterCompositionPolicy().evaluate(
      repositoryFile,
      context,
    ).length,
    0,
  );
});

test("infrastructure.adapter_on_adapter_composition is registered by default and in the Infrastructure factory", () => {
  assert.ok(
    makeInfrastructureArchitecturePolicies().some(
      (policy) =>
        policy.constructor === InfrastructureAdapterOnAdapterCompositionPolicy,
    ),
  );
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) =>
        policy.constructor === InfrastructureAdapterOnAdapterCompositionPolicy,
    ),
  );
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

test("infrastructure translation structure flags loose files at the translation root", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Translation/LinterRepoRelativePathModel.ts",
    roleFolder: RoleFolder.None,
    topLevelDeclarations: [
      {
        name: "LinterRepoRelativePathModel",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new InfrastructureTranslationStructurePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureTranslationStructurePolicy.ruleID,
  );
  assert.match(diagnostics[0]?.message ?? "", /Likely categories:/);
  assert.match(diagnostics[0]?.message ?? "", /Infrastructure\/Translation\/Models/);
  assert.match(diagnostics[0]?.message ?? "", /Infrastructure\/Translation\/DTOs/);
});

test("infrastructure role folder structure flags unknown first-level infrastructure folders", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Analyzers/TypeScriptProjectAnalyzer.ts",
    roleFolder: RoleFolder.None,
    topLevelDeclarations: [
      {
        name: "TypeScriptProjectAnalyzer",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new InfrastructureRoleFolderStructurePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureRoleFolderStructurePolicy.ruleID,
  );
  assert.match(diagnostics[0]?.message ?? "", /Analyzers/);
  assert.match(diagnostics[0]?.message ?? "", /Repositories/);
  assert.match(diagnostics[0]?.message ?? "", /Gateways/);
  assert.match(diagnostics[0]?.message ?? "", /Translation\/Models/);
});

test("infrastructure empty directory policy flags empty directories under Infrastructure", () => {
  const diagnostics = new InfrastructureEmptyDirectoryPolicy().evaluateProject({
    rootURL: new URL("file:///tmp/example/"),
    configuration: DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    sourceFileURLs: [],
    emptyDirectoryPaths: ["Infrastructure/Analyzers"],
  });

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, InfrastructureEmptyDirectoryPolicy.ruleID);
  assert.equal(diagnostics[0]?.path, "Infrastructure/Analyzers");
  assert.match(
    diagnostics[0]?.message ?? "",
    /Empty directories should not be left behind under Infrastructure/,
  );
  assert.match(
    diagnostics[0]?.message ?? "",
    /Repositories, Gateways, PortAdapters, Evaluators, Translation\/Models, Translation\/DTOs, or Errors/,
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

test("infrastructure forbidden presentation dependency flags ambiguous same-name presentation declarations", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    typeReferences: [
      { name: "OrderProjection", coordinate: coordinate(11) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "OrderProjection",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureTranslationModels,
      repoRelativePath:
        "Symphony/Infrastructure/Translation/Models/OrderProjection.ts",
    }),
    indexedDeclaration({
      name: "OrderProjection",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationViewModels,
      repoRelativePath: "Symphony/Presentation/ViewModels/OrderProjection.ts",
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
  assert.equal(diagnostics[0]?.line, 11);
});

test("infrastructure usecase or service reference flags UseCase construction", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    constructionOccurrences: [
      { typeName: "SubmitOrderUseCase", coordinate: coordinate(9) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "SubmitOrderUseCase",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
      repoRelativePath:
        "Symphony/Application/UseCases/SubmitOrderUseCase.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureUseCaseOrServiceReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureUseCaseOrServiceReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 9);
  assert.match(diagnostics[0]?.message ?? "", /SubmitOrderUseCase/);
  assert.match(diagnostics[0]?.message ?? "", /App\/DependencyInjection/);
});

test("infrastructure usecase or service reference flags Service construction", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/PortAdapters/OrderPortAdapter.ts",
    roleFolder: RoleFolder.InfrastructurePortAdapters,
    constructionOccurrences: [
      { typeName: "OrderWorkflowService", coordinate: coordinate(11) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "OrderWorkflowService",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
      repoRelativePath:
        "Symphony/Application/Services/OrderWorkflowService.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureUseCaseOrServiceReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureUseCaseOrServiceReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 11);
  assert.match(diagnostics[0]?.message ?? "", /OrderWorkflowService/);
});

test("infrastructure usecase or service reference flags UseCase type references once", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Repositories/OrderRepository.ts",
    roleFolder: RoleFolder.InfrastructureRepositories,
    typeReferences: [
      { name: "SubmitOrderUseCase", coordinate: coordinate(6) },
      { name: "SubmitOrderUseCase", coordinate: coordinate(12) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "SubmitOrderUseCase",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
      repoRelativePath:
        "Symphony/Application/UseCases/SubmitOrderUseCase.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureUseCaseOrServiceReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    InfrastructureUseCaseOrServiceReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 6);
});

test("infrastructure usecase or service reference ignores local same-name type references", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Infrastructure/Gateways/SubmitOrderUseCase.ts",
    roleFolder: RoleFolder.InfrastructureGateways,
    topLevelDeclarations: [
      {
        name: "SubmitOrderUseCase",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
    typeReferences: [{ name: "SubmitOrderUseCase", coordinate: coordinate(5) }],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "SubmitOrderUseCase",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
      repoRelativePath:
        "Symphony/Application/UseCases/SubmitOrderUseCase.ts",
    }),
  ]);

  const diagnostics =
    new InfrastructureUseCaseOrServiceReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("infrastructure usecase or service reference ignores non-Infrastructure files", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderController.ts",
    layer: ArchitectureLayer.Presentation,
    roleFolder: RoleFolder.PresentationControllers,
    constructionOccurrences: [
      { typeName: "SubmitOrderUseCase", coordinate: coordinate(9) },
    ],
    typeReferences: [{ name: "SubmitOrderUseCase", coordinate: coordinate(4) }],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "SubmitOrderUseCase",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
    }),
  ]);

  const diagnostics =
    new InfrastructureUseCaseOrServiceReferencePolicy().evaluate(file, context);

  assert.equal(diagnostics.length, 0);
});

test("infrastructure usecase or service reference is registered by default and in the Infrastructure factory", () => {
  assert.ok(
    makeInfrastructureArchitecturePolicies().some(
      (policy) =>
        policy.constructor === InfrastructureUseCaseOrServiceReferencePolicy,
    ),
  );
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) =>
        policy.constructor === InfrastructureUseCaseOrServiceReferencePolicy,
    ),
  );
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
  assert.equal(makeInfrastructureArchitecturePolicies().length, 43);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer?: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
  readonly methodDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["methodDeclarations"];
  readonly stringLiteralOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["stringLiteralOccurrences"];
  readonly typeReferences?: ConstructorParameters<typeof ArchitectureFile>[0]["typeReferences"];
  readonly constructionOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["constructionOccurrences"];
  readonly staticMemberAccessOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["staticMemberAccessOccurrences"];
  readonly memberCallOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["memberCallOccurrences"];
  readonly nestedNominalDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["nestedNominalDeclarations"];
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
    stringLiteralOccurrences: input.stringLiteralOccurrences ?? [],
    typedMemberOccurrences: [],
    memberCallOccurrences: input.memberCallOccurrences ?? [],
    methodDeclarations: input.methodDeclarations ?? [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: input.typeReferences ?? [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    nestedNominalDeclarations: input.nestedNominalDeclarations ?? [],
    constructionOccurrences: input.constructionOccurrences ?? [],
    staticMemberAccessOccurrences: input.staticMemberAccessOccurrences ?? [],
  });
}

function indexedDeclaration(input: {
  readonly name: string;
  readonly kind?: NominalKind;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly repoRelativePath?: string;
}) {
  return {
    name: input.name,
    kind: input.kind ?? NominalKind.Struct,
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
