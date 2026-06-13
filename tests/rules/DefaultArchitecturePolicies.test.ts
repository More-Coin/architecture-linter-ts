import test from "node:test";
import assert from "node:assert/strict";

import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
import {
  ArchitectureUnclassifiedSourcePolicy,
  ArchitectureUnknownRoleSubdirectoryPolicy,
} from "../../src/Domain/Policies/ExtendedArchitecturePolicies.ts";
import {
  ApplicationServicesDependencyCardinalityPolicy,
  ApplicationContractRegistryAccessPolicy,
  ApplicationOuterLayerReferencePolicy,
} from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { InfrastructureEmptyDirectoryPolicy } from "../../src/Domain/Policies/InfrastructureArchitecturePolicies.ts";
import { PresentationCrossLayerWireLiteralPolicy } from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
import { SourceRootEmptyDirectoryPolicy } from "../../src/Domain/Policies/SourceRootArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import type { IndexedDeclaration } from "../../src/Domain/ValueObjects/IndexedDeclaration.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

const disabledRuleVisibilityRuleID = "architecture.disabled_rule_visibility";

test("default policies include the full currently ported registry", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.deepEqual(
    policies.map((policy) => policy.constructor.name),
    [
      "SourceRootLayoutPolicy",
      "DomainForbiddenImportPolicy",
      "DomainOuterLayerReferencePolicy",
      "DomainDependencyResolutionPolicy",
      "DomainDurableStructurePolicy",
      "DomainPolicyPurityPolicy",
      "DomainPolicyShapePolicy",
      "DomainPoliciesSinglePolicySurfacePolicy",
      "DomainDeliveryVocabularyPolicy",
      "DomainOuterArtifactStringLiteralsPolicy",
      "DomainProtocolNamingPolicy",
      "DomainErrorsShapePolicy",
      "DomainErrorsPlacementPolicy",
      "RepositoryProtocolPlacementPolicy",
      "ArchitectureServiceRolePlacementPolicy",
      "TechnicalSeamProtocolPlacementPolicy",
      "ApplicationOuterLayerReferencePolicy",
      "ApplicationPortProtocolsShapePolicy",
      "ApplicationContractsShapePolicy",
      "ApplicationContractsNestedErrorPlacementPolicy",
      "ApplicationContractsNoErrorMappingSurfacePolicy",
      "ApplicationContractsNoCollaboratorDependenciesPolicy",
      "ApplicationContractsOwnershipPolicy",
      "ApplicationContractsNoStateTransitionSurfacePolicy",
      "ApplicationContractsErrorTaxonomyPolicy",
      "ApplicationContractsPassiveCarrierSurfacePolicy",
      "ApplicationPassiveDependencyResolutionPolicy",
      "ApplicationContractRegistryAccessPolicy",
      "ApplicationProtocolPlacementPolicy",
      "ApplicationPortProtocolConformancePolicy",
      "ApplicationAmbiguousRoleNamePolicy",
      "ApplicationProviderAgnosticNamingPolicy",
      "ApplicationErrorsShapePolicy",
      "ApplicationErrorsPlacementPolicy",
      "ApplicationServicesShapePolicy",
      "ApplicationServicesNoProtocolsPolicy",
      "ApplicationServicesPortProtocolReferencePolicy",
      "ApplicationServicesServiceReferencePolicy",
      "ApplicationServicesUseCaseConstructionPolicy",
      "ApplicationServicesDependencyResolutionPolicy",
      "ApplicationServicesNoUseCasesPolicy",
      "ApplicationServicesOrchestrationPolicy",
      "ApplicationServicesDependencyCardinalityPolicy",
      "ApplicationServicesSurfacePolicy",
      "ApplicationUseCasesShapePolicy",
      "ApplicationUseCasesNoProtocolsPolicy",
      "ApplicationUseCasesUseCaseReferencePolicy",
      "ApplicationUseCasesDependencyResolutionPolicy",
      "ApplicationUseCasesBoundaryTypeReferencePolicy",
      "ApplicationUseCasesOperationShapePolicy",
      "ApplicationUseCasesAbstractionDelegationPolicy",
      "ApplicationUseCasesSurfacePolicy",
      "ApplicationUseCasesInfrastructureReferencePolicy",
      "ApplicationUseCasesPlatformAPIPolicy",
      "ApplicationUseCasesServiceReferencePolicy",
      "ApplicationServicesInfrastructureReferencePolicy",
      "ApplicationServicesRepositoryReferencePolicy",
      "ApplicationServicesPlatformAPIPolicy",
      "AppConfigurationShapePolicy",
      "AppRuntimeShapePolicy",
      "AppDependencyInjectionShapePolicy",
      "AppApplicationBoundaryOperationPolicy",
      "AppMultiServiceOrchestrationPolicy",
      "AppPortProtocolConformancePolicy",
      "ArchitectureDisabledRuleVisibilityPolicy",
      "ArchitectureUnclassifiedSourcePolicy",
      "ArchitectureUnknownRoleSubdirectoryPolicy",
      "CompositionRootInwardReferencePolicy",
      "InfrastructureRepositoriesShapePolicy",
      "InfrastructureRepositoriesRoleFitPolicy",
      "InfrastructureRepositoriesInlineBusinessLiteralsPolicy",
      "InfrastructureGatewaysShapePolicy",
      "InfrastructureGatewaysRoleFitPolicy",
      "InfrastructurePortAdaptersShapePolicy",
      "InfrastructurePortAdaptersInlineTranslationSubsystemPolicy",
      "InfrastructurePortAdaptersInlineNormalizationPreparationPolicy",
      "InfrastructurePortAdaptersInlineObviousBoundaryDecisionLogicPolicy",
      "InfrastructurePortAdaptersInlineTypedBoundaryCompatibilityEvaluationPolicy",
      "InfrastructurePortAdaptersInlineTypedInteractionDispatchPolicy",
      "InfrastructureEvaluatorsShapePolicy",
      "InfrastructureEvaluatorsNoExecutionOrchestrationSurfacePolicy",
      "InfrastructureEvaluatorsNoTranslationSurfacePolicy",
      "InfrastructureRoleFolderStructurePolicy",
      "InfrastructureTranslationStructurePolicy",
      "InfrastructureTranslationShapePolicy",
      "InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy",
      "InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy",
      "InfrastructureTranslationModelsSplitRequestShapingPolicy",
      "InfrastructureTranslationDTOsShapePolicy",
      "InfrastructureTranslationDTOsPassiveCarrierPolicy",
      "InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy",
      "InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy",
      "InfrastructureApplicationContractBehaviorAttachmentPolicy",
      "InfrastructureGatewaysInlineBoundaryConfigurationShapingPolicy",
      "InfrastructureGatewaysInlineBoundaryDefinitionShapingPolicy",
      "InfrastructureGatewaysInlineOutboundRequestTranslationPolicy",
      "InfrastructureGatewaysInlineNormalizationPreparationPolicy",
      "InfrastructureGatewaysInlineObviousBoundaryDecisionLogicPolicy",
      "InfrastructureGatewaysInlineTypedBoundaryCompatibilityEvaluationPolicy",
      "InfrastructureGatewaysInlineTypedInteractionDispatchPolicy",
      "InfrastructureGatewaysRejectPrivateInwardTranslationHelpersPolicy",
      "InfrastructureGatewaysNestedIntermediaryTranslationShapesPolicy",
      "InfrastructureGatewaysNoNestedBoundaryShapingHelpersPolicy",
      "InfrastructureGatewaysInlineRequestDefinitionShapingPolicy",
      "InfrastructureTranslationDirectionalNamingPolicy",
      "InfrastructureErrorsShapePolicy",
      "InfrastructureErrorsPlacementPolicy",
      "InfrastructureForbiddenPresentationDependencyPolicy",
      "InfrastructureUseCaseOrServiceReferencePolicy",
      "InfrastructureAdapterOnAdapterCompositionPolicy",
      "InfrastructureCrossLayerProtocolConformancePolicy",
      "PresentationControllerShapePolicy",
      "PresentationControllersServiceReferencePolicy",
      "PresentationUseCaseReferencePolicy",
      "PresentationDomainPolicyReferencePolicy",
      "PresentationStateTransitionReferencePolicy",
      "PresentationPortProtocolReferencePolicy",
      "PresentationCompositionReferencePolicy",
      "PresentationDependencyResolutionPolicy",
      "PresentationCalendarDayBucketingPolicy",
      "PresentationPlatformStateAccessPolicy",
      "PresentationCrossLayerWireLiteralPolicy",
      "PresentationControllersFunctionSeamPolicy",
      "PresentationApplicationFunctionSeamPolicy",
      "PresentationRouteShapePolicy",
      "PresentationDTOsShapePolicy",
      "PresentationPresentersShapePolicy",
      "PresentationRenderersShapePolicy",
      "PresentationMiddlewareShapePolicy",
      "PresentationErrorsShapePolicy",
      "PresentationErrorsPlacementPolicy",
      "PresentationViewModelsShapePolicy",
      "PresentationViewsShapePolicy",
      "PresentationStylesShapePolicy",
      "PresentationInfrastructureReferencePolicy",
      "TestsLegacyRootPolicy",
      "TestsRuntimeLayeredLocationPolicy",
      "TestsDiagnosticsLocationPolicy",
      "TestsSharedSupportPlacementPolicy",
      "TestsMegaArchitectureLinterSuitePolicy",
      "TestsMixedResponsibilityRuntimeSuitePolicy",
      "TestsTestDoublesOnlySupportPolicy",
      "TestsImportOwnershipPolicy",
      "TestsLinterHarnessExtractionPolicy",
    ],
  );
});

test("default policies exclude disabled rule IDs", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRuleIDs: [ApplicationOuterLayerReferencePolicy.ruleID],
  });

  assert.ok(
    !policies.some(
      (policy) => policy.constructor === ApplicationOuterLayerReferencePolicy,
    ),
  );
});

test("default policies exclude disabled rule prefixes", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRulePrefixes: ["app."],
  });

  assert.ok(
    !policies.some(
      (policy) => policy.constructor.name === "AppConfigurationShapePolicy",
    ),
  );
  assert.ok(
    policies.some(
      (policy) => policy.constructor === ApplicationOuterLayerReferencePolicy,
    ),
  );
});

test("disabled rule prefixes emit a visible diagnostic at the stable anchor file", () => {
  const configuration = {
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRulePrefixes: ["app."],
  };
  const anchorFile = makeFile(
    "src/App/DependencyInjection/ArchitectureLinterDI.ts",
    ArchitectureLayer.App,
    RoleFolder.AppDependencyInjection,
  );
  const diagnostics = evaluateDefaultPolicies(
    configuration,
    [
      makeFile(
        "src/App/Runtime/ArchitectureLinterRuntime.ts",
        ArchitectureLayer.App,
        RoleFolder.AppRuntime,
      ),
      anchorFile,
      makeFile(
        "src/Application/Services/LintProjectService.ts",
        ArchitectureLayer.Application,
        RoleFolder.ApplicationServices,
      ),
    ],
    [
      makeDeclaration(
        "ArchitectureLinterRuntime",
        "src/App/Runtime/ArchitectureLinterRuntime.ts",
        ArchitectureLayer.App,
        RoleFolder.AppRuntime,
      ),
      makeDeclaration(
        "ArchitectureLinterDI",
        "src/App/DependencyInjection/ArchitectureLinterDI.ts",
        ArchitectureLayer.App,
        RoleFolder.AppDependencyInjection,
      ),
      makeDeclaration(
        "LintProjectService",
        "src/Application/Services/LintProjectService.ts",
        ArchitectureLayer.Application,
        RoleFolder.ApplicationServices,
      ),
    ],
  ).filter((diagnostic) => diagnostic.ruleID === disabledRuleVisibilityRuleID);

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.path, anchorFile.repoRelativePath);
  assert.equal(diagnostics[0]?.line, 1);
  assert.equal(diagnostics[0]?.column, 1);
  assert.match(diagnostics[0]?.message ?? "", /disabledRulePrefixes app\./);
});

test("explicitly disabling the disabled-rule visibility policy suppresses it", () => {
  const diagnostics = evaluateDefaultPolicies(
    {
      ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      disabledRuleIDs: [disabledRuleVisibilityRuleID],
      disabledRulePrefixes: ["app."],
    },
    [
      makeFile(
        "src/App/DependencyInjection/ArchitectureLinterDI.ts",
        ArchitectureLayer.App,
        RoleFolder.AppDependencyInjection,
      ),
    ],
    [
      makeDeclaration(
        "ArchitectureLinterDI",
        "src/App/DependencyInjection/ArchitectureLinterDI.ts",
        ArchitectureLayer.App,
        RoleFolder.AppDependencyInjection,
      ),
    ],
  );

  assert.ok(
    !diagnostics.some(
      (diagnostic) => diagnostic.ruleID === disabledRuleVisibilityRuleID,
    ),
  );
});

test("disabled rule visibility diagnostic expands matched registered rule IDs", () => {
  const diagnostics = evaluateDefaultPolicies(
    {
      ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      disabledRulePrefixes: ["app."],
    },
    [
      makeFile(
        "src/App/DependencyInjection/ArchitectureLinterDI.ts",
        ArchitectureLayer.App,
        RoleFolder.AppDependencyInjection,
      ),
    ],
    [
      makeDeclaration(
        "ArchitectureLinterDI",
        "src/App/DependencyInjection/ArchitectureLinterDI.ts",
        ArchitectureLayer.App,
        RoleFolder.AppDependencyInjection,
      ),
    ],
  );
  const visibilityDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.ruleID === disabledRuleVisibilityRuleID,
  );

  assert.ok(visibilityDiagnostic);
  assert.match(
    visibilityDiagnostic.message,
    /app\.application_boundary_operation/,
  );
  assert.match(visibilityDiagnostic.message, /app\.dependency_injection\.shape/);
  assert.match(visibilityDiagnostic.message, /app\.runtime\.shape/);
  assert.doesNotMatch(
    visibilityDiagnostic.message,
    /application\.outer_layer_reference/,
  );
});

test("default policies include disabled-rule visibility despite disabled prefixes", () => {
  const policies = DefaultArchitecturePolicies.make({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    disabledRulePrefixes: ["architecture."],
  });

  assert.ok(
    policies.some(
      (policy) => policy.constructor.name === "ArchitectureDisabledRuleVisibilityPolicy",
    ),
  );
});

test("default policies include application.contract_registry_access", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.ok(
    policies.some(
      (policy) => policy.constructor === ApplicationContractRegistryAccessPolicy,
    ),
  );
});

test("default policies include application.provider_agnostic_naming", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.ok(
    policies.some(
      (policy) =>
        policy.constructor.name === "ApplicationProviderAgnosticNamingPolicy",
    ),
  );
});

test("default policies include application.services.dependency_cardinality", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.ok(
    policies.some(
      (policy) =>
        policy.constructor === ApplicationServicesDependencyCardinalityPolicy,
    ),
  );
});

test("default policies include architecture.unclassified_source", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.ok(
    policies.some(
      (policy) => policy.constructor === ArchitectureUnclassifiedSourcePolicy,
    ),
  );
});

test("default policies include architecture.unknown_role_subdirectory", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.ok(
    policies.some(
      (policy) =>
        policy.constructor === ArchitectureUnknownRoleSubdirectoryPolicy,
    ),
  );
});

test("default policies include presentation.cross_layer_wire_literal", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.ok(
    policies.some(
      (policy) => policy.constructor === PresentationCrossLayerWireLiteralPolicy,
    ),
  );
});

test("default policies factory works when passed as a detached callback", () => {
  const makePolicies = DefaultArchitecturePolicies.make;
  const policies = makePolicies(DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION);

  assert.ok(policies.length > 0);
  assert.ok(
    policies.some(
      (policy) => policy.constructor === ApplicationOuterLayerReferencePolicy,
    ),
  );
});

test("default project policies include the empty directory policy", () => {
  const policies = DefaultArchitecturePolicies.makeProjectPolicies(
    DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  );

  assert.ok(
    policies.some(
      (policy) => policy.constructor === SourceRootEmptyDirectoryPolicy,
    ),
  );
  assert.ok(
    policies.some(
      (policy) => policy.constructor === InfrastructureEmptyDirectoryPolicy,
    ),
  );
});

function evaluateDefaultPolicies(
  configuration: typeof DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  files: readonly ArchitectureFile[],
  declarations: readonly IndexedDeclaration[],
) {
  const context = new ProjectContext(declarations);

  return DefaultArchitecturePolicies.make(configuration).flatMap((policy) =>
    files.flatMap((file) => policy.evaluate(file, context)),
  );
}

function makeFile(
  repoRelativePath: string,
  layer: ArchitectureLayer,
  roleFolder: RoleFolder,
): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath,
    classification: new FileClassification({
      repoRelativePath,
      layer,
      roleFolder,
      pathComponents: repoRelativePath.split("/"),
      fileName: repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
    }),
  });
}

function makeDeclaration(
  name: string,
  repoRelativePath: string,
  layer: ArchitectureLayer,
  roleFolder: RoleFolder,
): IndexedDeclaration {
  return {
    name,
    kind: NominalKind.Class,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath,
    layer,
    roleFolder,
  };
}
