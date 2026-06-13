import type { ArchitectureLinterConfiguration } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import {
  SourceRootEmptyDirectoryPolicy,
  SourceRootLayoutPolicy,
} from "./SourceRootArchitecturePolicies.ts";
import {
  AppApplicationBoundaryOperationPolicy,
  AppConfigurationShapePolicy,
  AppDependencyInjectionShapePolicy,
  AppMultiServiceOrchestrationPolicy,
  AppPortProtocolConformancePolicy,
  AppRuntimeShapePolicy,
  CompositionRootInwardReferencePolicy,
} from "./AppCompositionPolicies.ts";
import {
  ApplicationAmbiguousRoleNamePolicy,
  ApplicationContractRegistryAccessPolicy,
  ApplicationContractsErrorTaxonomyPolicy,
  ApplicationContractsNestedErrorPlacementPolicy,
  ApplicationContractsNoCollaboratorDependenciesPolicy,
  ApplicationContractsNoErrorMappingSurfacePolicy,
  ApplicationContractsNoStateTransitionSurfacePolicy,
  ApplicationContractsOwnershipPolicy,
  ApplicationContractsPassiveCarrierSurfacePolicy,
  ApplicationContractsShapePolicy,
  ApplicationErrorsPlacementPolicy,
  ApplicationErrorsShapePolicy,
  ApplicationOuterLayerReferencePolicy,
  ApplicationPassiveDependencyResolutionPolicy,
  ApplicationPortProtocolConformancePolicy,
  ApplicationPortProtocolsShapePolicy,
  ApplicationProviderAgnosticNamingPolicy,
  ApplicationProtocolPlacementPolicy,
  ApplicationServicesDependencyCardinalityPolicy,
  ApplicationServicesDependencyResolutionPolicy,
  ApplicationServicesInfrastructureReferencePolicy,
  ApplicationServicesNoProtocolsPolicy,
  ApplicationServicesNoUseCasesPolicy,
  ApplicationServicesOrchestrationPolicy,
  ApplicationServicesPlatformAPIPolicy,
  ApplicationServicesPortProtocolReferencePolicy,
  ApplicationServicesRepositoryReferencePolicy,
  ApplicationServicesServiceReferencePolicy,
  ApplicationServicesShapePolicy,
  ApplicationServicesSurfacePolicy,
  ApplicationServicesUseCaseConstructionPolicy,
  ApplicationUseCasesAbstractionDelegationPolicy,
  ApplicationUseCasesBoundaryTypeReferencePolicy,
  ApplicationUseCasesDependencyResolutionPolicy,
  ApplicationUseCasesInfrastructureReferencePolicy,
  ApplicationUseCasesNoProtocolsPolicy,
  ApplicationUseCasesOperationShapePolicy,
  ApplicationUseCasesPlatformAPIPolicy,
  ApplicationUseCasesServiceReferencePolicy,
  ApplicationUseCasesShapePolicy,
  ApplicationUseCasesSurfacePolicy,
  ApplicationUseCasesUseCaseReferencePolicy,
} from "./ApplicationArchitecturePolicies.ts";
import {
  DomainDeliveryVocabularyPolicy,
  DomainDurableStructurePolicy,
  DomainErrorsPlacementPolicy,
  DomainErrorsShapePolicy,
  DomainForbiddenImportPolicy,
  DomainOuterArtifactStringLiteralsPolicy,
  DomainOuterLayerReferencePolicy,
  DomainPoliciesSinglePolicySurfacePolicy,
  DomainPolicyPurityPolicy,
  DomainPolicyShapePolicy,
  DomainProtocolNamingPolicy,
  RepositoryProtocolPlacementPolicy,
} from "./DomainArchitecturePolicies.ts";
import {
  ArchitectureServiceRolePlacementPolicy,
  DomainDependencyResolutionPolicy,
  TechnicalSeamProtocolPlacementPolicy,
} from "./CrossArchitecturePolicies.ts";
import {
  ArchitectureDisabledRuleVisibilityPolicy,
  ArchitectureUnclassifiedSourcePolicy,
  ArchitectureUnknownRoleSubdirectoryPolicy,
} from "./ExtendedArchitecturePolicies.ts";
import {
  InfrastructureApplicationContractBehaviorAttachmentPolicy,
  InfrastructureAdapterOnAdapterCompositionPolicy,
  InfrastructureCrossLayerProtocolConformancePolicy,
  InfrastructureEmptyDirectoryPolicy,
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
  InfrastructureRepositoriesInlineBusinessLiteralsPolicy,
  InfrastructureRepositoriesRoleFitPolicy,
  InfrastructureRepositoriesShapePolicy,
  InfrastructureRoleFolderStructurePolicy,
  InfrastructureTranslationDirectionalNamingPolicy,
  InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy,
  InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy,
  InfrastructureTranslationDTOsPassiveCarrierPolicy,
  InfrastructureTranslationDTOsShapePolicy,
  InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy,
  InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy,
  InfrastructureTranslationModelsSplitRequestShapingPolicy,
  InfrastructureTranslationStructurePolicy,
  InfrastructureTranslationShapePolicy,
  InfrastructureUseCaseOrServiceReferencePolicy,
} from "./InfrastructureArchitecturePolicies.ts";
import {
  PresentationApplicationFunctionSeamPolicy,
  PresentationCalendarDayBucketingPolicy,
  PresentationCompositionReferencePolicy,
  PresentationControllerShapePolicy,
  PresentationControllersFunctionSeamPolicy,
  PresentationControllersServiceReferencePolicy,
  PresentationCrossLayerWireLiteralPolicy,
  PresentationDependencyResolutionPolicy,
  PresentationDomainPolicyReferencePolicy,
  PresentationDTOsShapePolicy,
  PresentationErrorsPlacementPolicy,
  PresentationErrorsShapePolicy,
  PresentationInfrastructureReferencePolicy,
  PresentationMiddlewareShapePolicy,
  PresentationPlatformStateAccessPolicy,
  PresentationPortProtocolReferencePolicy,
  PresentationPresentersShapePolicy,
  PresentationRenderersShapePolicy,
  PresentationRouteShapePolicy,
  PresentationStateTransitionReferencePolicy,
  PresentationStylesShapePolicy,
  PresentationUseCaseReferencePolicy,
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
import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import type { ArchitectureProjectPolicyProtocol } from "../Protocols/ArchitectureProjectPolicyProtocol.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../ValueObjects/ArchitectureLinterConfiguration.ts";

type RegisteredArchitecturePolicy = Readonly<{
  readonly ruleID: string;
  readonly make: (
    configuration: ArchitectureLinterConfiguration,
  ) => ArchitecturePolicyProtocol;
}>;

type RegisteredProjectArchitecturePolicy = Readonly<{
  readonly ruleID: string;
  readonly make: (
    configuration: ArchitectureLinterConfiguration,
  ) => ArchitectureProjectPolicyProtocol;
}>;

export class DefaultArchitecturePolicies {
  static get registeredRuleIDs(): readonly string[] {
    return [
      ...REGISTERED_POLICIES.map((policy) => policy.ruleID),
      ...REGISTERED_PROJECT_POLICIES.map((policy) => policy.ruleID),
    ];
  }

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

  static makeProjectPolicies(
    configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ): readonly ArchitectureProjectPolicyProtocol[] {
    return REGISTERED_PROJECT_POLICIES.flatMap((policy) => {
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

    if (ruleID === ArchitectureDisabledRuleVisibilityPolicy.ruleID) {
      return true;
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
    ruleID: DomainDependencyResolutionPolicy.ruleID,
    make: () => new DomainDependencyResolutionPolicy(),
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
    ruleID: DomainPoliciesSinglePolicySurfacePolicy.ruleID,
    make: () => new DomainPoliciesSinglePolicySurfacePolicy(),
  },
  {
    ruleID: DomainDeliveryVocabularyPolicy.ruleID,
    make: (configuration) => new DomainDeliveryVocabularyPolicy(configuration),
  },
  {
    ruleID: DomainOuterArtifactStringLiteralsPolicy.ruleID,
    make: (configuration) =>
      new DomainOuterArtifactStringLiteralsPolicy(configuration),
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
    ruleID: ArchitectureServiceRolePlacementPolicy.ruleID,
    make: () => new ArchitectureServiceRolePlacementPolicy(),
  },
  {
    ruleID: TechnicalSeamProtocolPlacementPolicy.ruleID,
    make: () => new TechnicalSeamProtocolPlacementPolicy(),
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
    ruleID: ApplicationContractsPassiveCarrierSurfacePolicy.ruleID,
    make: () => new ApplicationContractsPassiveCarrierSurfacePolicy(),
  },
  {
    ruleID: ApplicationPassiveDependencyResolutionPolicy.ruleID,
    make: () => new ApplicationPassiveDependencyResolutionPolicy(),
  },
  {
    ruleID: ApplicationContractRegistryAccessPolicy.ruleID,
    make: () => new ApplicationContractRegistryAccessPolicy(),
  },
  {
    ruleID: ApplicationProtocolPlacementPolicy.ruleID,
    make: () => new ApplicationProtocolPlacementPolicy(),
  },
  {
    ruleID: ApplicationPortProtocolConformancePolicy.ruleID,
    make: () => new ApplicationPortProtocolConformancePolicy(),
  },
  {
    ruleID: ApplicationAmbiguousRoleNamePolicy.ruleID,
    make: () => new ApplicationAmbiguousRoleNamePolicy(),
  },
  {
    ruleID: ApplicationProviderAgnosticNamingPolicy.ruleID,
    make: (configuration) =>
      new ApplicationProviderAgnosticNamingPolicy(configuration),
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
    ruleID: ApplicationServicesPortProtocolReferencePolicy.ruleID,
    make: () => new ApplicationServicesPortProtocolReferencePolicy(),
  },
  {
    ruleID: ApplicationServicesServiceReferencePolicy.ruleID,
    make: () => new ApplicationServicesServiceReferencePolicy(),
  },
  {
    ruleID: ApplicationServicesUseCaseConstructionPolicy.ruleID,
    make: () => new ApplicationServicesUseCaseConstructionPolicy(),
  },
  {
    ruleID: ApplicationServicesDependencyResolutionPolicy.ruleID,
    make: () => new ApplicationServicesDependencyResolutionPolicy(),
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
    ruleID: ApplicationServicesDependencyCardinalityPolicy.ruleID,
    make: (configuration) =>
      new ApplicationServicesDependencyCardinalityPolicy(configuration),
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
    ruleID: ApplicationUseCasesUseCaseReferencePolicy.ruleID,
    make: () => new ApplicationUseCasesUseCaseReferencePolicy(),
  },
  {
    ruleID: ApplicationUseCasesDependencyResolutionPolicy.ruleID,
    make: () => new ApplicationUseCasesDependencyResolutionPolicy(),
  },
  {
    ruleID: ApplicationUseCasesBoundaryTypeReferencePolicy.ruleID,
    make: () => new ApplicationUseCasesBoundaryTypeReferencePolicy(),
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
    ruleID: AppApplicationBoundaryOperationPolicy.ruleID,
    make: () => new AppApplicationBoundaryOperationPolicy(),
  },
  {
    ruleID: AppMultiServiceOrchestrationPolicy.ruleID,
    make: () => new AppMultiServiceOrchestrationPolicy(),
  },
  {
    ruleID: AppPortProtocolConformancePolicy.ruleID,
    make: () => new AppPortProtocolConformancePolicy(),
  },
  {
    ruleID: ArchitectureDisabledRuleVisibilityPolicy.ruleID,
    make: (configuration) =>
      new ArchitectureDisabledRuleVisibilityPolicy(
        configuration,
        DefaultArchitecturePolicies.registeredRuleIDs,
      ),
  },
  {
    ruleID: ArchitectureUnclassifiedSourcePolicy.ruleID,
    make: () => new ArchitectureUnclassifiedSourcePolicy(),
  },
  {
    ruleID: ArchitectureUnknownRoleSubdirectoryPolicy.ruleID,
    make: () => new ArchitectureUnknownRoleSubdirectoryPolicy(),
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
    ruleID: InfrastructureRepositoriesRoleFitPolicy.ruleID,
    make: () => new InfrastructureRepositoriesRoleFitPolicy(),
  },
  {
    ruleID: InfrastructureRepositoriesInlineBusinessLiteralsPolicy.ruleID,
    make: (configuration) =>
      new InfrastructureRepositoriesInlineBusinessLiteralsPolicy(configuration),
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
    ruleID: InfrastructureRoleFolderStructurePolicy.ruleID,
    make: () => new InfrastructureRoleFolderStructurePolicy(),
  },
  {
    ruleID: InfrastructureTranslationStructurePolicy.ruleID,
    make: () => new InfrastructureTranslationStructurePolicy(),
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
    ruleID: InfrastructureUseCaseOrServiceReferencePolicy.ruleID,
    make: () => new InfrastructureUseCaseOrServiceReferencePolicy(),
  },
  {
    ruleID: InfrastructureAdapterOnAdapterCompositionPolicy.ruleID,
    make: () => new InfrastructureAdapterOnAdapterCompositionPolicy(),
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
  // PresentationControllersUseCaseReferencePolicy is intentionally NOT
  // registered here. Swift defines but deprecates `presentation.controllers
  // .usecase_reference` (the broader `presentation.usecase_reference` rule
  // applies to every Presentation file role). The TS class stays exported
  // for manual/custom policy construction, but the default registry mirrors
  // Swift's deprecated-but-unregistered stance. See PARITY.md §2.3 and §3.8.
  {
    ruleID: PresentationUseCaseReferencePolicy.ruleID,
    make: () => new PresentationUseCaseReferencePolicy(),
  },
  {
    ruleID: PresentationDomainPolicyReferencePolicy.ruleID,
    make: () => new PresentationDomainPolicyReferencePolicy(),
  },
  {
    ruleID: PresentationStateTransitionReferencePolicy.ruleID,
    make: () => new PresentationStateTransitionReferencePolicy(),
  },
  {
    ruleID: PresentationPortProtocolReferencePolicy.ruleID,
    make: () => new PresentationPortProtocolReferencePolicy(),
  },
  {
    ruleID: PresentationCompositionReferencePolicy.ruleID,
    make: () => new PresentationCompositionReferencePolicy(),
  },
  {
    ruleID: PresentationDependencyResolutionPolicy.ruleID,
    make: () => new PresentationDependencyResolutionPolicy(),
  },
  {
    ruleID: PresentationCalendarDayBucketingPolicy.ruleID,
    make: () => new PresentationCalendarDayBucketingPolicy(),
  },
  {
    ruleID: PresentationPlatformStateAccessPolicy.ruleID,
    make: () => new PresentationPlatformStateAccessPolicy(),
  },
  {
    ruleID: PresentationCrossLayerWireLiteralPolicy.ruleID,
    make: () => new PresentationCrossLayerWireLiteralPolicy(),
  },
  {
    ruleID: PresentationControllersFunctionSeamPolicy.ruleID,
    make: () => new PresentationControllersFunctionSeamPolicy(),
  },
  {
    ruleID: PresentationApplicationFunctionSeamPolicy.ruleID,
    make: () => new PresentationApplicationFunctionSeamPolicy(),
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

const REGISTERED_PROJECT_POLICIES: readonly RegisteredProjectArchitecturePolicy[] = [
  {
    ruleID: SourceRootEmptyDirectoryPolicy.ruleID,
    make: () => new SourceRootEmptyDirectoryPolicy(),
  },
  {
    ruleID: InfrastructureEmptyDirectoryPolicy.ruleID,
    make: () => new InfrastructureEmptyDirectoryPolicy(),
  },
];
