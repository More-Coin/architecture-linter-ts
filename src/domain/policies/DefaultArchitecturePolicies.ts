import type { ArchitectureLinterConfiguration } from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import {
  SourceRootLayoutPolicy,
} from "./SourceRootArchitecturePolicies.ts";
import {
  AppConfigurationShapePolicy,
  AppDependencyInjectionShapePolicy,
  AppRuntimeShapePolicy,
  CompositionRootInwardReferencePolicy,
} from "./AppCompositionPolicies.ts";
import {
  ApplicationContractsErrorTaxonomyPolicy,
  ApplicationContractsNestedErrorPlacementPolicy,
  ApplicationContractsNoCollaboratorDependenciesPolicy,
  ApplicationContractsNoErrorMappingSurfacePolicy,
  ApplicationContractsNoStateTransitionSurfacePolicy,
  ApplicationContractsOwnershipPolicy,
  ApplicationContractsShapePolicy,
  ApplicationErrorsPlacementPolicy,
  ApplicationErrorsShapePolicy,
  ApplicationOuterLayerReferencePolicy,
  ApplicationPortProtocolsShapePolicy,
  ApplicationProtocolPlacementPolicy,
  ApplicationServicesInfrastructureReferencePolicy,
  ApplicationServicesNoProtocolsPolicy,
  ApplicationServicesNoUseCasesPolicy,
  ApplicationServicesOrchestrationPolicy,
  ApplicationServicesPlatformAPIPolicy,
  ApplicationServicesRepositoryReferencePolicy,
  ApplicationServicesShapePolicy,
  ApplicationServicesSurfacePolicy,
  ApplicationUseCasesAbstractionDelegationPolicy,
  ApplicationUseCasesInfrastructureReferencePolicy,
  ApplicationUseCasesNoProtocolsPolicy,
  ApplicationUseCasesOperationShapePolicy,
  ApplicationUseCasesPlatformAPIPolicy,
  ApplicationUseCasesServiceReferencePolicy,
  ApplicationUseCasesShapePolicy,
  ApplicationUseCasesSurfacePolicy,
} from "./ApplicationArchitecturePolicies.ts";
import {
  DomainDurableStructurePolicy,
  DomainErrorsPlacementPolicy,
  DomainErrorsShapePolicy,
  DomainForbiddenImportPolicy,
  DomainOuterLayerReferencePolicy,
  DomainPolicyPurityPolicy,
  DomainPolicyShapePolicy,
  DomainProtocolNamingPolicy,
  RepositoryProtocolPlacementPolicy,
} from "./DomainArchitecturePolicies.ts";
import {
  InfrastructureApplicationContractBehaviorAttachmentPolicy,
  InfrastructureCrossLayerProtocolConformancePolicy,
  InfrastructureErrorsPlacementPolicy,
  InfrastructureErrorsShapePolicy,
  InfrastructureEvaluatorsNoExecutionOrchestrationSurfacePolicy,
  InfrastructureEvaluatorsNoTranslationSurfacePolicy,
  InfrastructureEvaluatorsShapePolicy,
  InfrastructureForbiddenPresentationDependencyPolicy,
  InfrastructureGatewaysInlineBoundaryConfigurationShapingPolicy,
  InfrastructureGatewaysInlineBoundaryDefinitionShapingPolicy,
  InfrastructureGatewaysInlineNormalizationPreparationPolicy,
  InfrastructureGatewaysInlineObviousBoundaryDecisionLogicPolicy,
  InfrastructureGatewaysInlineOutboundRequestTranslationPolicy,
  InfrastructureGatewaysInlineRequestDefinitionShapingPolicy,
  InfrastructureGatewaysInlineTypedBoundaryCompatibilityEvaluationPolicy,
  InfrastructureGatewaysInlineTypedInteractionDispatchPolicy,
  InfrastructureGatewaysNestedIntermediaryTranslationShapesPolicy,
  InfrastructureGatewaysNoNestedBoundaryShapingHelpersPolicy,
  InfrastructureGatewaysRejectPrivateInwardTranslationHelpersPolicy,
  InfrastructureGatewaysRoleFitPolicy,
  InfrastructureGatewaysShapePolicy,
  InfrastructurePortAdaptersInlineNormalizationPreparationPolicy,
  InfrastructurePortAdaptersInlineObviousBoundaryDecisionLogicPolicy,
  InfrastructurePortAdaptersInlineTranslationSubsystemPolicy,
  InfrastructurePortAdaptersInlineTypedBoundaryCompatibilityEvaluationPolicy,
  InfrastructurePortAdaptersInlineTypedInteractionDispatchPolicy,
  InfrastructurePortAdaptersShapePolicy,
  InfrastructureRepositoriesShapePolicy,
  InfrastructureTranslationDirectionalNamingPolicy,
  InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy,
  InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy,
  InfrastructureTranslationDTOsPassiveCarrierPolicy,
  InfrastructureTranslationDTOsShapePolicy,
  InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy,
  InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy,
  InfrastructureTranslationModelsSplitRequestShapingPolicy,
  InfrastructureTranslationShapePolicy,
} from "./InfrastructureArchitecturePolicies.ts";
import {
  PresentationControllerShapePolicy,
  PresentationControllersFunctionSeamPolicy,
  PresentationControllersServiceReferencePolicy,
  PresentationControllersUseCaseReferencePolicy,
  PresentationDTOsShapePolicy,
  PresentationErrorsPlacementPolicy,
  PresentationErrorsShapePolicy,
  PresentationInfrastructureReferencePolicy,
  PresentationMiddlewareShapePolicy,
  PresentationPresentersShapePolicy,
  PresentationRenderersShapePolicy,
  PresentationRouteShapePolicy,
  PresentationStylesShapePolicy,
  PresentationViewModelsShapePolicy,
  PresentationViewsShapePolicy,
} from "./PresentationArchitecturePolicies.ts";
import {
  TestsDiagnosticsLocationPolicy,
  TestsImportOwnershipPolicy,
  TestsLegacyRootPolicy,
  TestsLinterHarnessExtractionPolicy,
  TestsMegaArchitectureLinterSuitePolicy,
  TestsMixedResponsibilityRuntimeSuitePolicy,
  TestsRuntimeLayeredLocationPolicy,
  TestsSharedSupportPlacementPolicy,
  TestsTestDoublesOnlySupportPolicy,
} from "./TestArchitecturePolicies.ts";
import type { ArchitecturePolicyProtocol } from "../protocols/ArchitecturePolicyProtocol.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../app/configuration/ArchitectureLinterConfiguration.ts";

interface RegisteredArchitecturePolicy {
  readonly ruleID: string;
  readonly make: (
    configuration: ArchitectureLinterConfiguration,
  ) => ArchitecturePolicyProtocol;
}

export class DefaultArchitecturePolicies {
  static make(
    configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ): readonly ArchitecturePolicyProtocol[] {
    return REGISTERED_POLICIES.flatMap((policy) => {
      if (!DefaultArchitecturePolicies.shouldIncludePolicy(policy.ruleID, configuration)) {
        return [];
      }

      return [policy.make(configuration)];
    });
  }

  private static shouldIncludePolicy(
    ruleID: string,
    configuration: ArchitectureLinterConfiguration,
  ): boolean {
    if (configuration.disabledRuleIDs.includes(ruleID)) {
      return false;
    }

    return !configuration.disabledRulePrefixes.some((prefix) =>
      ruleID.startsWith(prefix),
    );
  }
}

const REGISTERED_POLICIES: readonly RegisteredArchitecturePolicy[] = [
  {
    ruleID: SourceRootLayoutPolicy.ruleID,
    make: (configuration) => new SourceRootLayoutPolicy(configuration),
  },
  {
    ruleID: DomainForbiddenImportPolicy.ruleID,
    make: () => new DomainForbiddenImportPolicy(),
  },
  {
    ruleID: DomainOuterLayerReferencePolicy.ruleID,
    make: () => new DomainOuterLayerReferencePolicy(),
  },
  {
    ruleID: DomainDurableStructurePolicy.ruleID,
    make: () => new DomainDurableStructurePolicy(),
  },
  {
    ruleID: DomainPolicyPurityPolicy.ruleID,
    make: () => new DomainPolicyPurityPolicy(),
  },
  {
    ruleID: DomainPolicyShapePolicy.ruleID,
    make: () => new DomainPolicyShapePolicy(),
  },
  {
    ruleID: DomainProtocolNamingPolicy.ruleID,
    make: () => new DomainProtocolNamingPolicy(),
  },
  {
    ruleID: DomainErrorsShapePolicy.ruleID,
    make: () => new DomainErrorsShapePolicy(),
  },
  {
    ruleID: DomainErrorsPlacementPolicy.ruleID,
    make: () => new DomainErrorsPlacementPolicy(),
  },
  {
    ruleID: RepositoryProtocolPlacementPolicy.ruleID,
    make: () => new RepositoryProtocolPlacementPolicy(),
  },
  {
    ruleID: ApplicationOuterLayerReferencePolicy.ruleID,
    make: () => new ApplicationOuterLayerReferencePolicy(),
  },
  {
    ruleID: ApplicationPortProtocolsShapePolicy.ruleID,
    make: () => new ApplicationPortProtocolsShapePolicy(),
  },
  {
    ruleID: ApplicationContractsShapePolicy.ruleID,
    make: () => new ApplicationContractsShapePolicy(),
  },
  {
    ruleID: ApplicationContractsNestedErrorPlacementPolicy.ruleID,
    make: () => new ApplicationContractsNestedErrorPlacementPolicy(),
  },
  {
    ruleID: ApplicationContractsNoErrorMappingSurfacePolicy.ruleID,
    make: () => new ApplicationContractsNoErrorMappingSurfacePolicy(),
  },
  {
    ruleID: ApplicationContractsNoCollaboratorDependenciesPolicy.ruleID,
    make: () => new ApplicationContractsNoCollaboratorDependenciesPolicy(),
  },
  {
    ruleID: ApplicationContractsOwnershipPolicy.ruleID,
    make: () => new ApplicationContractsOwnershipPolicy(),
  },
  {
    ruleID: ApplicationContractsNoStateTransitionSurfacePolicy.ruleID,
    make: () => new ApplicationContractsNoStateTransitionSurfacePolicy(),
  },
  {
    ruleID: ApplicationContractsErrorTaxonomyPolicy.ruleID,
    make: () => new ApplicationContractsErrorTaxonomyPolicy(),
  },
  {
    ruleID: ApplicationProtocolPlacementPolicy.ruleID,
    make: () => new ApplicationProtocolPlacementPolicy(),
  },
  {
    ruleID: ApplicationErrorsShapePolicy.ruleID,
    make: () => new ApplicationErrorsShapePolicy(),
  },
  {
    ruleID: ApplicationErrorsPlacementPolicy.ruleID,
    make: () => new ApplicationErrorsPlacementPolicy(),
  },
  {
    ruleID: ApplicationServicesShapePolicy.ruleID,
    make: () => new ApplicationServicesShapePolicy(),
  },
  {
    ruleID: ApplicationServicesNoProtocolsPolicy.ruleID,
    make: () => new ApplicationServicesNoProtocolsPolicy(),
  },
  {
    ruleID: ApplicationServicesNoUseCasesPolicy.ruleID,
    make: () => new ApplicationServicesNoUseCasesPolicy(),
  },
  {
    ruleID: ApplicationServicesOrchestrationPolicy.ruleID,
    make: () => new ApplicationServicesOrchestrationPolicy(),
  },
  {
    ruleID: ApplicationServicesSurfacePolicy.ruleID,
    make: () => new ApplicationServicesSurfacePolicy(),
  },
  {
    ruleID: ApplicationUseCasesShapePolicy.ruleID,
    make: () => new ApplicationUseCasesShapePolicy(),
  },
  {
    ruleID: ApplicationUseCasesNoProtocolsPolicy.ruleID,
    make: () => new ApplicationUseCasesNoProtocolsPolicy(),
  },
  {
    ruleID: ApplicationUseCasesOperationShapePolicy.ruleID,
    make: () => new ApplicationUseCasesOperationShapePolicy(),
  },
  {
    ruleID: ApplicationUseCasesAbstractionDelegationPolicy.ruleID,
    make: () => new ApplicationUseCasesAbstractionDelegationPolicy(),
  },
  {
    ruleID: ApplicationUseCasesSurfacePolicy.ruleID,
    make: () => new ApplicationUseCasesSurfacePolicy(),
  },
  {
    ruleID: ApplicationUseCasesInfrastructureReferencePolicy.ruleID,
    make: () => new ApplicationUseCasesInfrastructureReferencePolicy(),
  },
  {
    ruleID: ApplicationUseCasesPlatformAPIPolicy.ruleID,
    make: () => new ApplicationUseCasesPlatformAPIPolicy(),
  },
  {
    ruleID: ApplicationUseCasesServiceReferencePolicy.ruleID,
    make: () => new ApplicationUseCasesServiceReferencePolicy(),
  },
  {
    ruleID: ApplicationServicesInfrastructureReferencePolicy.ruleID,
    make: () => new ApplicationServicesInfrastructureReferencePolicy(),
  },
  {
    ruleID: ApplicationServicesRepositoryReferencePolicy.ruleID,
    make: () => new ApplicationServicesRepositoryReferencePolicy(),
  },
  {
    ruleID: ApplicationServicesPlatformAPIPolicy.ruleID,
    make: () => new ApplicationServicesPlatformAPIPolicy(),
  },
  {
    ruleID: AppConfigurationShapePolicy.ruleID,
    make: () => new AppConfigurationShapePolicy(),
  },
  {
    ruleID: AppRuntimeShapePolicy.ruleID,
    make: () => new AppRuntimeShapePolicy(),
  },
  {
    ruleID: AppDependencyInjectionShapePolicy.ruleID,
    make: () => new AppDependencyInjectionShapePolicy(),
  },
  {
    ruleID: CompositionRootInwardReferencePolicy.ruleID,
    make: () => new CompositionRootInwardReferencePolicy(),
  },
  {
    ruleID: InfrastructureRepositoriesShapePolicy.ruleID,
    make: () => new InfrastructureRepositoriesShapePolicy(),
  },
  {
    ruleID: InfrastructureGatewaysShapePolicy.ruleID,
    make: () => new InfrastructureGatewaysShapePolicy(),
  },
  {
    ruleID: InfrastructureGatewaysRoleFitPolicy.ruleID,
    make: () => new InfrastructureGatewaysRoleFitPolicy(),
  },
  {
    ruleID: InfrastructurePortAdaptersShapePolicy.ruleID,
    make: () => new InfrastructurePortAdaptersShapePolicy(),
  },
  {
    ruleID: InfrastructurePortAdaptersInlineTranslationSubsystemPolicy.ruleID,
    make: () => new InfrastructurePortAdaptersInlineTranslationSubsystemPolicy(),
  },
  {
    ruleID: InfrastructurePortAdaptersInlineNormalizationPreparationPolicy.ruleID,
    make: () => new InfrastructurePortAdaptersInlineNormalizationPreparationPolicy(),
  },
  {
    ruleID: InfrastructurePortAdaptersInlineObviousBoundaryDecisionLogicPolicy.ruleID,
    make: () => new InfrastructurePortAdaptersInlineObviousBoundaryDecisionLogicPolicy(),
  },
  {
    ruleID: InfrastructurePortAdaptersInlineTypedBoundaryCompatibilityEvaluationPolicy.ruleID,
    make: () =>
      new InfrastructurePortAdaptersInlineTypedBoundaryCompatibilityEvaluationPolicy(),
  },
  {
    ruleID: InfrastructurePortAdaptersInlineTypedInteractionDispatchPolicy.ruleID,
    make: () => new InfrastructurePortAdaptersInlineTypedInteractionDispatchPolicy(),
  },
  {
    ruleID: InfrastructureEvaluatorsShapePolicy.ruleID,
    make: () => new InfrastructureEvaluatorsShapePolicy(),
  },
  {
    ruleID: InfrastructureEvaluatorsNoExecutionOrchestrationSurfacePolicy.ruleID,
    make: () =>
      new InfrastructureEvaluatorsNoExecutionOrchestrationSurfacePolicy(),
  },
  {
    ruleID: InfrastructureEvaluatorsNoTranslationSurfacePolicy.ruleID,
    make: () => new InfrastructureEvaluatorsNoTranslationSurfacePolicy(),
  },
  {
    ruleID: InfrastructureTranslationShapePolicy.ruleID,
    make: () => new InfrastructureTranslationShapePolicy(),
  },
  {
    ruleID: InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy.ruleID,
    make: () =>
      new InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy(),
  },
  {
    ruleID:
      InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy.ruleID,
    make: () =>
      new InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy(),
  },
  {
    ruleID: InfrastructureTranslationModelsSplitRequestShapingPolicy.ruleID,
    make: () => new InfrastructureTranslationModelsSplitRequestShapingPolicy(),
  },
  {
    ruleID: InfrastructureTranslationDTOsShapePolicy.ruleID,
    make: () => new InfrastructureTranslationDTOsShapePolicy(),
  },
  {
    ruleID: InfrastructureTranslationDTOsPassiveCarrierPolicy.ruleID,
    make: () => new InfrastructureTranslationDTOsPassiveCarrierPolicy(),
  },
  {
    ruleID:
      InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy.ruleID,
    make: () =>
      new InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy(),
  },
  {
    ruleID:
      InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy.ruleID,
    make: () =>
      new InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy(),
  },
  {
    ruleID: InfrastructureApplicationContractBehaviorAttachmentPolicy.ruleID,
    make: () => new InfrastructureApplicationContractBehaviorAttachmentPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysInlineBoundaryConfigurationShapingPolicy.ruleID,
    make: () => new InfrastructureGatewaysInlineBoundaryConfigurationShapingPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysInlineBoundaryDefinitionShapingPolicy.ruleID,
    make: () => new InfrastructureGatewaysInlineBoundaryDefinitionShapingPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysInlineOutboundRequestTranslationPolicy.ruleID,
    make: () => new InfrastructureGatewaysInlineOutboundRequestTranslationPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysInlineNormalizationPreparationPolicy.ruleID,
    make: () => new InfrastructureGatewaysInlineNormalizationPreparationPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysInlineObviousBoundaryDecisionLogicPolicy.ruleID,
    make: () => new InfrastructureGatewaysInlineObviousBoundaryDecisionLogicPolicy(),
  },
  {
    ruleID:
      InfrastructureGatewaysInlineTypedBoundaryCompatibilityEvaluationPolicy.ruleID,
    make: () =>
      new InfrastructureGatewaysInlineTypedBoundaryCompatibilityEvaluationPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysInlineTypedInteractionDispatchPolicy.ruleID,
    make: () => new InfrastructureGatewaysInlineTypedInteractionDispatchPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysRejectPrivateInwardTranslationHelpersPolicy.ruleID,
    make: () => new InfrastructureGatewaysRejectPrivateInwardTranslationHelpersPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysNestedIntermediaryTranslationShapesPolicy.ruleID,
    make: () => new InfrastructureGatewaysNestedIntermediaryTranslationShapesPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysNoNestedBoundaryShapingHelpersPolicy.ruleID,
    make: () => new InfrastructureGatewaysNoNestedBoundaryShapingHelpersPolicy(),
  },
  {
    ruleID: InfrastructureGatewaysInlineRequestDefinitionShapingPolicy.ruleID,
    make: () => new InfrastructureGatewaysInlineRequestDefinitionShapingPolicy(),
  },
  {
    ruleID: InfrastructureTranslationDirectionalNamingPolicy.ruleID,
    make: () => new InfrastructureTranslationDirectionalNamingPolicy(),
  },
  {
    ruleID: InfrastructureErrorsShapePolicy.ruleID,
    make: () => new InfrastructureErrorsShapePolicy(),
  },
  {
    ruleID: InfrastructureErrorsPlacementPolicy.ruleID,
    make: () => new InfrastructureErrorsPlacementPolicy(),
  },
  {
    ruleID: InfrastructureForbiddenPresentationDependencyPolicy.ruleID,
    make: () => new InfrastructureForbiddenPresentationDependencyPolicy(),
  },
  {
    ruleID: InfrastructureCrossLayerProtocolConformancePolicy.ruleID,
    make: () => new InfrastructureCrossLayerProtocolConformancePolicy(),
  },
  {
    ruleID: PresentationControllerShapePolicy.ruleID,
    make: () => new PresentationControllerShapePolicy(),
  },
  {
    ruleID: PresentationControllersServiceReferencePolicy.ruleID,
    make: () => new PresentationControllersServiceReferencePolicy(),
  },
  {
    ruleID: PresentationControllersUseCaseReferencePolicy.ruleID,
    make: () => new PresentationControllersUseCaseReferencePolicy(),
  },
  {
    ruleID: PresentationControllersFunctionSeamPolicy.ruleID,
    make: () => new PresentationControllersFunctionSeamPolicy(),
  },
  {
    ruleID: PresentationRouteShapePolicy.ruleID,
    make: () => new PresentationRouteShapePolicy(),
  },
  {
    ruleID: PresentationDTOsShapePolicy.ruleID,
    make: () => new PresentationDTOsShapePolicy(),
  },
  {
    ruleID: PresentationPresentersShapePolicy.ruleID,
    make: () => new PresentationPresentersShapePolicy(),
  },
  {
    ruleID: PresentationRenderersShapePolicy.ruleID,
    make: () => new PresentationRenderersShapePolicy(),
  },
  {
    ruleID: PresentationMiddlewareShapePolicy.ruleID,
    make: () => new PresentationMiddlewareShapePolicy(),
  },
  {
    ruleID: PresentationErrorsShapePolicy.ruleID,
    make: () => new PresentationErrorsShapePolicy(),
  },
  {
    ruleID: PresentationErrorsPlacementPolicy.ruleID,
    make: () => new PresentationErrorsPlacementPolicy(),
  },
  {
    ruleID: PresentationViewModelsShapePolicy.ruleID,
    make: () => new PresentationViewModelsShapePolicy(),
  },
  {
    ruleID: PresentationViewsShapePolicy.ruleID,
    make: () => new PresentationViewsShapePolicy(),
  },
  {
    ruleID: PresentationStylesShapePolicy.ruleID,
    make: () => new PresentationStylesShapePolicy(),
  },
  {
    ruleID: PresentationInfrastructureReferencePolicy.ruleID,
    make: () => new PresentationInfrastructureReferencePolicy(),
  },
  {
    ruleID: TestsLegacyRootPolicy.ruleID,
    make: (configuration) => new TestsLegacyRootPolicy(configuration),
  },
  {
    ruleID: TestsRuntimeLayeredLocationPolicy.ruleID,
    make: (configuration) => new TestsRuntimeLayeredLocationPolicy(configuration),
  },
  {
    ruleID: TestsDiagnosticsLocationPolicy.ruleID,
    make: (configuration) => new TestsDiagnosticsLocationPolicy(configuration),
  },
  {
    ruleID: TestsSharedSupportPlacementPolicy.ruleID,
    make: (configuration) => new TestsSharedSupportPlacementPolicy(configuration),
  },
  {
    ruleID: TestsMegaArchitectureLinterSuitePolicy.ruleID,
    make: (configuration) =>
      new TestsMegaArchitectureLinterSuitePolicy(configuration),
  },
  {
    ruleID: TestsMixedResponsibilityRuntimeSuitePolicy.ruleID,
    make: (configuration) =>
      new TestsMixedResponsibilityRuntimeSuitePolicy(configuration),
  },
  {
    ruleID: TestsTestDoublesOnlySupportPolicy.ruleID,
    make: (configuration) =>
      new TestsTestDoublesOnlySupportPolicy(configuration),
  },
  {
    ruleID: TestsImportOwnershipPolicy.ruleID,
    make: (configuration) => new TestsImportOwnershipPolicy(configuration),
  },
  {
    ruleID: TestsLinterHarnessExtractionPolicy.ruleID,
    make: (configuration) =>
      new TestsLinterHarnessExtractionPolicy(configuration),
  },
];
