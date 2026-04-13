import test from "node:test";
import assert from "node:assert/strict";

import { DefaultArchitecturePolicies } from "../../src/domain/policies/DefaultArchitecturePolicies.ts";
import {
  ApplicationOuterLayerReferencePolicy,
} from "../../src/domain/policies/index.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/app/configuration/ArchitectureLinterConfiguration.ts";

test("default policies include the full currently ported registry", () => {
  const policies = DefaultArchitecturePolicies.make();

  assert.deepEqual(
    policies.map((policy) => policy.constructor.name),
    [
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
