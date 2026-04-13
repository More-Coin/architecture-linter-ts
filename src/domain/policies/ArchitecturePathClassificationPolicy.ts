import type { ArchitectureLinterConfiguration } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../ValueObjects/FileClassification.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../ValueObjects/ArchitectureLinterConfiguration.ts";

export class ArchitecturePathClassificationPolicy {
  constructor(
    private readonly configuration: ArchitectureLinterConfiguration =
      DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  classify(repoRelativePath: string): FileClassification {
    const normalizedPath = repoRelativePath.replaceAll("\\", "/");
    const components = normalizedPath.split("/").filter(Boolean);
    const fileName = components.at(-1) ?? normalizedPath;
    const fileStem = fileName.replace(/\.[^.]+$/, "");

    const { layer, layerIndex } = this.detectLayer(components);
    const roleFolder = this.detectRoleFolder(
      layer,
      layerIndex,
      components,
      fileStem,
    );

    return new FileClassification({
      repoRelativePath: normalizedPath,
      layer,
      roleFolder,
      pathComponents: components,
      fileName,
      fileStem,
    });
  }

  private detectLayer(components: readonly string[]): {
    layer: ArchitectureLayer;
    layerIndex?: number;
  } {
    if (
      components.some(
        (component) =>
          component === "Tests" ||
          component.endsWith("Tests") ||
          component.endsWith("UITests"),
      )
    ) {
      return { layer: ArchitectureLayer.Tests };
    }

    const layerLookup: ReadonlyArray<readonly [string, ArchitectureLayer]> = [
      [
        this.configuration.layerDirectoryNames.domain,
        ArchitectureLayer.Domain,
      ],
      [
        this.configuration.layerDirectoryNames.application,
        ArchitectureLayer.Application,
      ],
      [
        this.configuration.layerDirectoryNames.infrastructure,
        ArchitectureLayer.Infrastructure,
      ],
      [
        this.configuration.layerDirectoryNames.presentation,
        ArchitectureLayer.Presentation,
      ],
      [
        this.configuration.layerDirectoryNames.app,
        ArchitectureLayer.App,
      ],
    ];

    for (const [segment, layer] of layerLookup) {
      const layerIndex = components.findIndex((component) =>
        this.matchesSegment(component, segment),
      );
      if (layerIndex >= 0) {
        return { layer, layerIndex };
      }
    }

    return { layer: ArchitectureLayer.Other };
  }

  private detectRoleFolder(
    layer: ArchitectureLayer,
    layerIndex: number | undefined,
    components: readonly string[],
    fileStem: string,
  ): RoleFolder {
    if (layerIndex === undefined) {
      return RoleFolder.None;
    }

    const next = this.componentAfter(layerIndex, components);
    const afterNext = this.componentAfter(layerIndex + 1, components);

    switch (layer) {
      case ArchitectureLayer.Domain:
        switch (this.normalizedSegment(next)) {
          case "protocols":
            return RoleFolder.DomainProtocols;
          case "policies":
            return RoleFolder.DomainPolicies;
          case "errors":
            return RoleFolder.DomainErrors;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.Application:
        switch (this.normalizedSegment(next)) {
          case "contracts":
            switch (this.normalizedSegment(afterNext)) {
              case "commands":
                return RoleFolder.ApplicationContractsCommands;
              case "ports":
                return RoleFolder.ApplicationContractsPorts;
              case "workflow":
                return RoleFolder.ApplicationContractsWorkflow;
              default:
                return RoleFolder.None;
            }
          case "errors":
            return RoleFolder.ApplicationErrors;
          case "ports":
            return this.matchesSegment(afterNext, "Protocols")
              ? RoleFolder.ApplicationPortsProtocols
              : RoleFolder.None;
          case "statetransitions":
            return RoleFolder.ApplicationStateTransitions;
          case "usecases":
            return RoleFolder.ApplicationUseCases;
          case "services":
            return RoleFolder.ApplicationServices;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.Infrastructure:
        switch (this.normalizedSegment(next)) {
          case "repositories":
            return RoleFolder.InfrastructureRepositories;
          case "gateways":
            return RoleFolder.InfrastructureGateways;
          case "portadapters":
            return RoleFolder.InfrastructurePortAdapters;
          case "evaluators":
            return RoleFolder.InfrastructureEvaluators;
          case "translation":
            switch (this.normalizedSegment(afterNext)) {
              case "models":
                return RoleFolder.InfrastructureTranslationModels;
              case "dtos":
                return RoleFolder.InfrastructureTranslationDTOs;
              default:
                return RoleFolder.None;
            }
          case "errors":
            return RoleFolder.InfrastructureErrors;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.Presentation:
        switch (this.normalizedSegment(next)) {
          case "controllers":
            return RoleFolder.PresentationControllers;
          case "routes":
            return RoleFolder.PresentationRoutes;
          case "dtos":
            return RoleFolder.PresentationDTOs;
          case "presenters":
            return RoleFolder.PresentationPresenters;
          case "renderers":
            return RoleFolder.PresentationRenderers;
          case "middleware":
            return RoleFolder.PresentationMiddleware;
          case "errors":
            return RoleFolder.PresentationErrors;
          case "viewmodels":
            return RoleFolder.PresentationViewModels;
          case "views":
            return RoleFolder.PresentationViews;
          case "styles":
            return RoleFolder.PresentationStyles;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.UI:
        return RoleFolder.None;

      case ArchitectureLayer.App:
        switch (this.normalizedSegment(next)) {
          case "configuration":
            return RoleFolder.AppConfiguration;
          case "runtime":
            return RoleFolder.AppRuntime;
          case "dependencyinjection":
            return RoleFolder.AppDependencyInjection;
          default:
            switch (this.normalizedSegment(fileStem)) {
              case "main":
                return RoleFolder.AppEntrypoint;
              case "bootstrap":
              case "configure":
                return RoleFolder.AppBootstrap;
              default:
                return RoleFolder.None;
            }
        }

      case ArchitectureLayer.Tests:
      case ArchitectureLayer.Other:
        return RoleFolder.None;
    }
  }

  private componentAfter(
    index: number,
    components: readonly string[],
  ): string | undefined {
    return components.at(index + 1);
  }

  private matchesSegment(
    actual: string | undefined,
    expected: string,
  ): boolean {
    return this.normalizedSegment(actual) === this.normalizedSegment(expected);
  }

  private normalizedSegment(value: string | undefined): string {
    return (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  }
}
