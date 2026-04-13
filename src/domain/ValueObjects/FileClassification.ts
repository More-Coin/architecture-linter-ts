import { ArchitectureLayer } from "./ArchitectureLayer.ts";
import { RoleFolder } from "./RoleFolder.ts";

export interface FileClassificationInput {
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly pathComponents: readonly string[];
  readonly fileName: string;
  readonly fileStem: string;
}

export class FileClassification {
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly pathComponents: readonly string[];
  readonly fileName: string;
  readonly fileStem: string;

  constructor(input: FileClassificationInput) {
    this.repoRelativePath = input.repoRelativePath;
    this.layer = input.layer;
    this.roleFolder = input.roleFolder;
    this.pathComponents = [...input.pathComponents];
    this.fileName = input.fileName;
    this.fileStem = input.fileStem;
  }

  get isDomain(): boolean {
    return this.layer === ArchitectureLayer.Domain;
  }

  get isApplication(): boolean {
    return this.layer === ArchitectureLayer.Application;
  }

  get isInfrastructure(): boolean {
    return this.layer === ArchitectureLayer.Infrastructure;
  }

  get isPresentation(): boolean {
    return this.layer === ArchitectureLayer.Presentation;
  }

  get isTestFile(): boolean {
    return this.layer === ArchitectureLayer.Tests;
  }

  get testRootIndex(): number | undefined {
    const index = this.pathComponents.findIndex(
      (component) =>
        component === "Tests" ||
        component.endsWith("Tests") ||
        component.endsWith("UITests"),
    );

    return index >= 0 ? index : undefined;
  }

  get testRootComponent(): string | undefined {
    const index = this.testRootIndex;
    return index === undefined ? undefined : this.pathComponents[index];
  }

  get pathComponentsFromTestRoot(): readonly string[] {
    const index = this.testRootIndex;

    return index === undefined
      ? this.pathComponents
      : this.pathComponents.slice(index);
  }

  get isLegacyTestFile(): boolean {
    return this.testRootComponent === "Tests";
  }

  get isCanonicalRepoTestFile(): boolean {
    const root = this.testRootComponent;

    return Boolean(
      root &&
        root !== "Tests" &&
        root.endsWith("Tests") &&
        !root.endsWith("UITests"),
    );
  }

  get isUITestFile(): boolean {
    return this.testRootComponent?.endsWith("UITests") ?? false;
  }

  get isPolicyFile(): boolean {
    return (
      this.isDomain &&
      (this.roleFolder === RoleFolder.DomainPolicies ||
        this.fileStem.endsWith("Policy"))
    );
  }

  get isControllerFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationControllers;
  }

  get isPresentationDTOFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationDTOs;
  }

  get isPresentationPresenterFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationPresenters;
  }

  get isPresentationRendererFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationRenderers;
  }

  get isPresentationMiddlewareFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationMiddleware;
  }

  get isPresentationErrorFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationErrors;
  }

  get isPresentationViewModelFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationViewModels;
  }

  get isPresentationViewFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationViews;
  }

  get isPresentationStyleFile(): boolean {
    return this.roleFolder === RoleFolder.PresentationStyles;
  }

  get isAppEntrypointFile(): boolean {
    return this.roleFolder === RoleFolder.AppEntrypoint;
  }

  get isAppBootstrapFile(): boolean {
    return this.roleFolder === RoleFolder.AppBootstrap;
  }

  get isAppConfigurationFile(): boolean {
    return this.roleFolder === RoleFolder.AppConfiguration;
  }

  get isAppRuntimeFile(): boolean {
    return this.roleFolder === RoleFolder.AppRuntime;
  }

  get isAppDependencyInjectionFile(): boolean {
    return this.roleFolder === RoleFolder.AppDependencyInjection;
  }

  get isServiceFile(): boolean {
    return (
      this.isApplication &&
      (this.roleFolder === RoleFolder.ApplicationServices ||
        this.fileStem.endsWith("Service"))
    );
  }

  get isRepositoryProtocolFile(): boolean {
    return (
      this.isDomain &&
      this.roleFolder === RoleFolder.DomainProtocols &&
      this.fileStem.endsWith("RepositoryProtocol")
    );
  }

  get isDomainErrorFile(): boolean {
    return this.roleFolder === RoleFolder.DomainErrors;
  }

  get isDomainProtocolFile(): boolean {
    return this.isDomain && this.roleFolder === RoleFolder.DomainProtocols;
  }

  get isPortProtocolFile(): boolean {
    return (
      this.isApplication &&
      this.roleFolder === RoleFolder.ApplicationPortsProtocols
    );
  }

  get isApplicationErrorFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationErrors;
  }

  get isApplicationPortProtocolFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationPortsProtocols;
  }

  get isApplicationCommandContractFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationContractsCommands;
  }

  get isApplicationContractPortFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationContractsPorts;
  }

  get isApplicationWorkflowContractFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationContractsWorkflow;
  }

  get isApplicationContractFile(): boolean {
    return (
      this.isApplicationCommandContractFile ||
      this.isApplicationContractPortFile ||
      this.isApplicationWorkflowContractFile
    );
  }

  get isApplicationServiceFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationServices;
  }

  get isApplicationStateTransitionFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationStateTransitions;
  }

  get isApplicationUseCaseFile(): boolean {
    return this.roleFolder === RoleFolder.ApplicationUseCases;
  }

  get isApplicationServicesRole(): boolean {
    return this.roleFolder === RoleFolder.ApplicationServices;
  }

  get isInfrastructureRepositoryFile(): boolean {
    return this.roleFolder === RoleFolder.InfrastructureRepositories;
  }

  get isInfrastructureGatewayFile(): boolean {
    return this.roleFolder === RoleFolder.InfrastructureGateways;
  }

  get isInfrastructurePortAdapterFile(): boolean {
    return this.roleFolder === RoleFolder.InfrastructurePortAdapters;
  }

  get isInfrastructureEvaluatorFile(): boolean {
    return this.roleFolder === RoleFolder.InfrastructureEvaluators;
  }

  get isInfrastructureTranslationModelFile(): boolean {
    return this.roleFolder === RoleFolder.InfrastructureTranslationModels;
  }

  get isInfrastructureTranslationDTOFile(): boolean {
    return this.roleFolder === RoleFolder.InfrastructureTranslationDTOs;
  }

  get isInfrastructureTranslationFile(): boolean {
    return (
      this.isInfrastructureTranslationModelFile ||
      this.isInfrastructureTranslationDTOFile
    );
  }

  get isInfrastructureErrorFile(): boolean {
    return this.roleFolder === RoleFolder.InfrastructureErrors;
  }

  get isInfrastructureAdapterRole(): boolean {
    return (
      this.isInfrastructureRepositoryFile ||
      this.isInfrastructureGatewayFile ||
      this.isInfrastructurePortAdapterFile
    );
  }
}
