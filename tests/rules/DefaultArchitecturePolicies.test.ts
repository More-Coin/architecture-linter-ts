import test from "node:test";
import assert from "node:assert/strict";

import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
import {
  ApplicationOuterLayerReferencePolicy,
} from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { InfrastructureEmptyDirectoryPolicy } from "../../src/Domain/Policies/InfrastructureArchitecturePolicies.ts";
import { SourceRootEmptyDirectoryPolicy } from "../../src/Domain/Policies/SourceRootArchitecturePolicies.ts";

test("default policies include the full currently ported registry", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.deepEqual(
    policies.map((policy) => policy.constructor.name),
    [
      "SourceRootLayoutPolicy",
      "DomainForbiddenImportPolicy",
      "DomainOuterLayerReferencePolicy",
      "DomainDurableStructurePolicy",
      "DomainPolicyPurityPolicy",
      "DomainPolicyShapePolicy",
      "DomainProtocolNamingPolicy",
      "DomainErrorsShapePolicy",
      "DomainErrorsPlacementPolicy",
      "RepositoryProtocolPlacementPolicy",
      "ApplicationOuterLayerReferencePolicy",
      "ApplicationPortProtocolsShapePolicy",
      "ApplicationContractsShapePolicy",
      "ApplicationContractsNestedErrorPlacementPolicy",
      "ApplicationContractsNoErrorMappingSurfacePolicy",
      "ApplicationContractsNoCollaboratorDependenciesPolicy",
      "ApplicationContractsOwnershipPolicy",
      "ApplicationContractsNoStateTransitionSurfacePolicy",
      "ApplicationContractsErrorTaxonomyPolicy",
      "ApplicationProtocolPlacementPolicy",
      "ApplicationErrorsShapePolicy",
      "ApplicationErrorsPlacementPolicy",
      "ApplicationServicesShapePolicy",
      "ApplicationServicesNoProtocolsPolicy",
      "ApplicationServicesNoUseCasesPolicy",
      "ApplicationServicesOrchestrationPolicy",
      "ApplicationServicesSurfacePolicy",
      "ApplicationUseCasesShapePolicy",
      "ApplicationUseCasesNoProtocolsPolicy",
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
      "CompositionRootInwardReferencePolicy",
      "InfrastructureRepositoriesShapePolicy",
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
      "InfrastructureCrossLayerProtocolConformancePolicy",
      "PresentationControllerShapePolicy",
      "PresentationControllersServiceReferencePolicy",
      "PresentationControllersUseCaseReferencePolicy",
      "PresentationControllersFunctionSeamPolicy",
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
