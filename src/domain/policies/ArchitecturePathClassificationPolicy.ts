import path from "node:path";

import { ArchitectureLayer } from "../value-objects/ArchitectureLayer.ts";
import { FileClassification } from "../value-objects/FileClassification.ts";
import { RoleFolder } from "../value-objects/RoleFolder.ts";

export class ArchitecturePathClassificationPolicy {
  classify(repoRelativePath: string): FileClassification {
    const normalizedPath = repoRelativePath.replaceAll("\\", "/");
    const components = normalizedPath.split("/").filter(Boolean);
    const fileName = components.at(-1) ?? normalizedPath;
    const fileStem = path.posix.parse(fileName).name;

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
      ["Domain", ArchitectureLayer.Domain],
      ["Application", ArchitectureLayer.Application],
      ["Infrastructure", ArchitectureLayer.Infrastructure],
      ["Presentation", ArchitectureLayer.Presentation],
      ["App", ArchitectureLayer.App],
    ];

    for (const [segment, layer] of layerLookup) {
      const layerIndex = components.indexOf(segment);
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
        switch (next) {
          case "Protocols":
            return RoleFolder.DomainProtocols;
          case "Policies":
            return RoleFolder.DomainPolicies;
          case "Errors":
            return RoleFolder.DomainErrors;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.Application:
        switch (next) {
          case "Contracts":
            switch (afterNext) {
              case "Commands":
                return RoleFolder.ApplicationContractsCommands;
              case "Ports":
                return RoleFolder.ApplicationContractsPorts;
              case "Workflow":
                return RoleFolder.ApplicationContractsWorkflow;
              default:
                return RoleFolder.None;
            }
          case "Errors":
            return RoleFolder.ApplicationErrors;
          case "Ports":
            return afterNext === "Protocols"
              ? RoleFolder.ApplicationPortsProtocols
              : RoleFolder.None;
          case "StateTransitions":
            return RoleFolder.ApplicationStateTransitions;
          case "UseCases":
            return RoleFolder.ApplicationUseCases;
          case "Services":
            return RoleFolder.ApplicationServices;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.Infrastructure:
        switch (next) {
          case "Repositories":
            return RoleFolder.InfrastructureRepositories;
          case "Gateways":
            return RoleFolder.InfrastructureGateways;
          case "PortAdapters":
            return RoleFolder.InfrastructurePortAdapters;
          case "Evaluators":
            return RoleFolder.InfrastructureEvaluators;
          case "Translation":
            switch (afterNext) {
              case "Models":
                return RoleFolder.InfrastructureTranslationModels;
              case "DTOs":
                return RoleFolder.InfrastructureTranslationDTOs;
              default:
                return RoleFolder.None;
            }
          case "Errors":
            return RoleFolder.InfrastructureErrors;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.Presentation:
        switch (next) {
          case "Controllers":
            return RoleFolder.PresentationControllers;
          case "Routes":
            return RoleFolder.PresentationRoutes;
          case "DTOs":
            return RoleFolder.PresentationDTOs;
          case "Presenters":
            return RoleFolder.PresentationPresenters;
          case "Renderers":
            return RoleFolder.PresentationRenderers;
          case "Middleware":
            return RoleFolder.PresentationMiddleware;
          case "Errors":
            return RoleFolder.PresentationErrors;
          case "ViewModels":
            return RoleFolder.PresentationViewModels;
          case "Views":
            return RoleFolder.PresentationViews;
          case "Styles":
            return RoleFolder.PresentationStyles;
          default:
            return RoleFolder.None;
        }

      case ArchitectureLayer.UI:
        return RoleFolder.None;

      case ArchitectureLayer.App:
        switch (next) {
          case "Configuration":
            return RoleFolder.AppConfiguration;
          case "Runtime":
            return RoleFolder.AppRuntime;
          case "DependencyInjection":
            return RoleFolder.AppDependencyInjection;
          default:
            switch (fileStem.toLowerCase()) {
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
}
