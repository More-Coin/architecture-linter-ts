import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";

export class PresentationControllerShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.controllers.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isControllerFile) {
      return [];
    }

    if (file.topLevelDeclarations.some((declaration) => declaration.name.endsWith("Controller"))) {
      return [];
    }

    return [
      file.diagnostic(
        PresentationControllerShapePolicy.ruleID,
        presentationRemediationMessage(
          "Presentation/Controllers files must expose at least one top-level type ending in 'Controller'.",
          `Add or rename a controller type in ${file.repoRelativePath} so request-entry ownership stays explicit.`,
        ),
      ),
    ];
  }
}

export class PresentationControllersServiceReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.controllers.service_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isControllerFile) {
      return [];
    }

    const hasServiceReference = file.typeReferences.some((reference) => {
      const declaration = context.uniqueDeclaration(reference.name);
      return declaration?.roleFolder === RoleFolder.ApplicationServices;
    });

    if (hasServiceReference) {
      return [];
    }

    return [
      file.diagnostic(
        PresentationControllersServiceReferencePolicy.ruleID,
        presentationRemediationMessage(
          "Presentation controllers should depend on an Application service instead of owning workflow orchestration directly.",
          `Inject an Application/Services type into the controller declarations in ${file.repoRelativePath}.`,
        ),
      ),
    ];
  }
}

export class PresentationControllersUseCaseReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.controllers.usecase_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isControllerFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const reference of file.typeReferences) {
      if (seenNames.has(reference.name)) {
        continue;
      }
      seenNames.add(reference.name);

      const declaration = context.uniqueDeclaration(reference.name);
      if (declaration?.roleFolder !== RoleFolder.ApplicationUseCases) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationControllersUseCaseReferencePolicy.ruleID,
          presentationRemediationMessage(
            `Presentation controllers should call Application services, not use case '${reference.name}' from ${declaration.repoRelativePath}.`,
            `Replace the direct '${reference.name}' dependency in ${file.repoRelativePath} with an Application/Services dependency.`,
          ),
          reference.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class PresentationControllersFunctionSeamPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.controllers.function_seam";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isControllerFile) {
      return [];
    }

    return file.functionTypeOccurrences.map((occurrence) =>
      file.diagnostic(
        PresentationControllersFunctionSeamPolicy.ruleID,
        presentationRemediationMessage(
          "Presentation controllers must not depend on arbitrary function or closure seams for workflow execution.",
          `Replace the function or closure seam in ${file.repoRelativePath} with an injected Application/Services dependency.`,
        ),
        occurrence.coordinate,
      ),
    );
  }
}

export class PresentationRouteShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.routes.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.roleFolder !== RoleFolder.PresentationRoutes) {
      return [];
    }

    if (file.topLevelDeclarations.some((declaration) => declaration.name.endsWith("Routes"))) {
      return [];
    }

    return [
      file.diagnostic(
        PresentationRouteShapePolicy.ruleID,
        presentationRemediationMessage(
          "Presentation/Routes files must expose at least one top-level type ending in 'Routes'.",
          `Add or rename a route-registration type in ${file.repoRelativePath} so presentation entry wiring is easy to find.`,
        ),
      ),
    ];
  }
}

export class PresentationDTOsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.dtos.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentationDTOFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      switch (declaration.kind) {
        case NominalKind.Protocol:
          diagnostics.push(
            file.diagnostic(
              PresentationDTOsShapePolicy.ruleID,
              presentationRemediationMessage(
                `Presentation/DTOs should expose concrete transport shapes, not protocol '${declaration.name}'.`,
                `Replace '${declaration.name}' with a concrete DTO shape or move the protocol to the role that owns abstraction.`,
              ),
              declaration.coordinate,
            ),
          );
          break;
        case NominalKind.Class:
        case NominalKind.Actor:
          diagnostics.push(
            file.diagnostic(
              PresentationDTOsShapePolicy.ruleID,
              presentationRemediationMessage(
                `Presentation/DTOs should expose lightweight transport shapes, not ${declaration.kind} '${declaration.name}'.`,
                `Convert '${declaration.name}' to a struct or enum DTO, or move the behavioral type to the role that owns it.`,
              ),
              declaration.coordinate,
            ),
          );
          break;
        case NominalKind.Struct:
        case NominalKind.Enum:
          if (!hasAllowedPresentationDTOSuffix(declaration.name)) {
            diagnostics.push(
              file.diagnostic(
                PresentationDTOsShapePolicy.ruleID,
                presentationRemediationMessage(
                  `Presentation DTO type '${declaration.name}' should end in 'DTO', 'DTOs', or 'QueryParams'.`,
                  `Rename '${declaration.name}' or move it to the presentation role that matches its actual responsibility.`,
                ),
                declaration.coordinate,
              ),
            );
          }
          break;
      }
    }

    const hasDTOType = file.topLevelDeclarations.some(
      (declaration) =>
        (declaration.kind === NominalKind.Struct ||
          declaration.kind === NominalKind.Enum) &&
        hasAllowedPresentationDTOSuffix(declaration.name),
    );

    if (!hasDTOType) {
      diagnostics.push(
        file.diagnostic(
          PresentationDTOsShapePolicy.ruleID,
          presentationRemediationMessage(
            "Presentation/DTOs files must expose at least one top-level transport type ending in 'DTO', 'DTOs', or 'QueryParams'.",
            `Add or rename a DTO type in ${file.repoRelativePath} so the file clearly owns presentation transport shapes.`,
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class PresentationPresentersShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.presenters.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseSimplePresentationRoleFile(
      file,
      file.classification.isPresentationPresenterFile,
      PresentationPresentersShapePolicy.ruleID,
      "Presenter",
      "Presentation/Presenters",
    );
  }
}

export class PresentationRenderersShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.renderers.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseSimplePresentationRoleFile(
      file,
      file.classification.isPresentationRendererFile,
      PresentationRenderersShapePolicy.ruleID,
      "Renderer",
      "Presentation/Renderers",
    );
  }
}

export class PresentationMiddlewareShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.middleware.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseSimplePresentationRoleFile(
      file,
      file.classification.isPresentationMiddlewareFile,
      PresentationMiddlewareShapePolicy.ruleID,
      "Middleware",
      "Presentation/Middleware",
    );
  }
}

export class PresentationErrorsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.errors.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentationErrorFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      switch (declaration.kind) {
        case NominalKind.Protocol:
          diagnostics.push(
            file.diagnostic(
              PresentationErrorsShapePolicy.ruleID,
              presentationRemediationMessage(
                `Presentation/Errors should expose concrete error types, not protocol '${declaration.name}'.`,
                `Replace '${declaration.name}' with a concrete presentation error type or move the abstraction elsewhere.`,
              ),
              declaration.coordinate,
            ),
          );
          break;
        case NominalKind.Class:
        case NominalKind.Actor:
          diagnostics.push(
            file.diagnostic(
              PresentationErrorsShapePolicy.ruleID,
              presentationRemediationMessage(
                `Presentation/Errors should expose lightweight error declarations, not ${declaration.kind} '${declaration.name}'.`,
                `Convert '${declaration.name}' to a struct or enum presentation error, or move the behavioral type elsewhere.`,
              ),
              declaration.coordinate,
            ),
          );
          break;
        case NominalKind.Struct:
        case NominalKind.Enum:
          if (!hasAllowedPresentationErrorSuffix(declaration.name)) {
            diagnostics.push(
              file.diagnostic(
                PresentationErrorsShapePolicy.ruleID,
                presentationRemediationMessage(
                  `Presentation/Errors declarations should end in 'PresentationError' or 'PresentationErrors', but '${declaration.name}' does not.`,
                  `Rename '${declaration.name}' or move it to the role that actually owns it.`,
                ),
                declaration.coordinate,
              ),
            );
          }
          break;
      }
    }

    const hasRequiredType = file.topLevelDeclarations.some(
      (declaration) =>
        (declaration.kind === NominalKind.Struct ||
          declaration.kind === NominalKind.Enum) &&
        hasAllowedPresentationErrorSuffix(declaration.name),
    );

    if (!hasRequiredType) {
      diagnostics.push(
        file.diagnostic(
          PresentationErrorsShapePolicy.ruleID,
          presentationRemediationMessage(
            "Presentation/Errors files must expose at least one structured error type ending in 'PresentationError' or 'PresentationErrors'.",
            `Add or rename a presentation error type in ${file.repoRelativePath} so error ownership stays explicit.`,
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class PresentationErrorsPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.errors.placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      !file.classification.isPresentation ||
      file.classification.isPresentationErrorFile
    ) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (!hasAllowedPresentationErrorSuffix(declaration.name)) {
        return [];
      }

      return [
        file.diagnostic(
          PresentationErrorsPlacementPolicy.ruleID,
          presentationRemediationMessage(
            `Presentation error declaration '${declaration.name}' belongs in Presentation/Errors, not in ${file.repoRelativePath}.`,
            `Move '${declaration.name}' into a dedicated file under Presentation/Errors.`,
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class PresentationViewModelsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.viewmodels.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseSimplePresentationRoleFile(
      file,
      file.classification.isPresentationViewModelFile,
      PresentationViewModelsShapePolicy.ruleID,
      "ViewModel",
      "Presentation/ViewModels",
    );
  }
}

export class PresentationViewsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.views.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseSimplePresentationRoleFile(
      file,
      file.classification.isPresentationViewFile,
      PresentationViewsShapePolicy.ruleID,
      "View",
      "Presentation/Views",
    );
  }
}

export class PresentationStylesShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.styles.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseSimplePresentationRoleFile(
      file,
      file.classification.isPresentationStyleFile,
      PresentationStylesShapePolicy.ruleID,
      "Style",
      "Presentation/Styles",
    );
  }
}

export class PresentationInfrastructureReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.infrastructure_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const reference of file.typeReferences) {
      if (seenNames.has(reference.name)) {
        continue;
      }
      seenNames.add(reference.name);

      const declaration = context.uniqueDeclaration(reference.name);
      if (!declaration || declaration.layer !== ArchitectureLayer.Infrastructure) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationInfrastructureReferencePolicy.ruleID,
          presentationRemediationMessage(
            `Presentation must not depend on infrastructure type '${reference.name}' from ${declaration.repoRelativePath}.`,
            `Remove the direct infrastructure dependency from ${file.repoRelativePath} and replace it with an inward-facing dependency.`,
          ),
          reference.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export function makePresentationArchitecturePolicies(): readonly ArchitecturePolicyProtocol[] {
  return [
    new PresentationControllerShapePolicy(),
    new PresentationControllersServiceReferencePolicy(),
    new PresentationControllersUseCaseReferencePolicy(),
    new PresentationControllersFunctionSeamPolicy(),
    new PresentationRouteShapePolicy(),
    new PresentationDTOsShapePolicy(),
    new PresentationPresentersShapePolicy(),
    new PresentationRenderersShapePolicy(),
    new PresentationMiddlewareShapePolicy(),
    new PresentationErrorsShapePolicy(),
    new PresentationErrorsPlacementPolicy(),
    new PresentationViewModelsShapePolicy(),
    new PresentationViewsShapePolicy(),
    new PresentationStylesShapePolicy(),
    new PresentationInfrastructureReferencePolicy(),
  ];
}

function diagnoseSimplePresentationRoleFile(
  file: ArchitectureFile,
  shouldEvaluate: boolean,
  ruleID: string,
  requiredSuffix: string,
  roleLabel: string,
): readonly ArchitectureDiagnostic[] {
  if (!shouldEvaluate) {
    return [];
  }

  const diagnostics: ArchitectureDiagnostic[] = [];

  for (const declaration of file.topLevelDeclarations) {
    if (declaration.kind === NominalKind.Protocol) {
      diagnostics.push(
        file.diagnostic(
          ruleID,
          presentationRemediationMessage(
            `${roleLabel} should expose concrete types, not protocol '${declaration.name}'.`,
            `Replace '${declaration.name}' with a concrete ${requiredSuffix.toLowerCase()} type or move the abstraction to the role that owns it.`,
          ),
          declaration.coordinate,
        ),
      );
      continue;
    }

    if (!declaration.name.endsWith(requiredSuffix)) {
      diagnostics.push(
        file.diagnostic(
          ruleID,
          presentationRemediationMessage(
            `${roleLabel} files should expose types ending in '${requiredSuffix}', but '${declaration.name}' does not.`,
            `Rename '${declaration.name}' to end with '${requiredSuffix}' or move it to the presentation role that matches its responsibility.`,
          ),
          declaration.coordinate,
        ),
      );
    }
  }

  const hasRequiredType = file.topLevelDeclarations.some(
    (declaration) =>
      declaration.kind !== NominalKind.Protocol &&
      declaration.name.endsWith(requiredSuffix),
  );

  if (!hasRequiredType) {
    diagnostics.push(
      file.diagnostic(
        ruleID,
        presentationRemediationMessage(
          `${roleLabel} files must expose at least one type ending in '${requiredSuffix}'.`,
          `Add or rename a concrete ${requiredSuffix.toLowerCase()} type in ${file.repoRelativePath} so the file clearly owns that presentation role.`,
        ),
      ),
    );
  }

  return diagnostics;
}

function hasAllowedPresentationDTOSuffix(name: string): boolean {
  return (
    name.endsWith("DTO") ||
    name.endsWith("DTOs") ||
    name.endsWith("QueryParams")
  );
}

function hasAllowedPresentationErrorSuffix(name: string): boolean {
  return (
    name.endsWith("PresentationError") ||
    name.endsWith("PresentationErrors")
  );
}

function presentationRemediationMessage(
  summary: string,
  destination: string,
): string {
  return `${summary} ${destination}`;
}
