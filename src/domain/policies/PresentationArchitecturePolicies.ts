import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";
import { iterateReferenceOccurrences } from "./shared/ReferenceOccurrences.ts";
import { richRemediationMessage } from "./shared/RichRemediationMessage.ts";

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
      { includeTopLevelValueDeclarations: true },
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

// =============================================================================
// Stage 5 — Swift-parity Presentation policies (CleanArchitectureBoundaryPolicies)
// =============================================================================

/**
 * `presentation.usecase_reference` — Presentation files must not depend
 * directly on Application UseCases; workflows should reach UseCases via
 * Application Services. Broader than the deprecated controllers-specific
 * rule: this policy fires on every Presentation file kind (controllers,
 * routes, DTOs, presenters, renderers, middleware, view-models, views,
 * styles, errors). Mirrors Swift's `PresentationUseCaseReferencePolicy`.
 */
export class PresentationUseCaseReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.usecase_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const occurrence of iterateReferenceOccurrences(file)) {
      if (seenNames.has(occurrence.name)) {
        continue;
      }
      seenNames.add(occurrence.name);

      const declaration = context.uniqueDeclaration(occurrence.name);
      if (!declaration || declaration.roleFolder !== RoleFolder.ApplicationUseCases) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationUseCaseReferencePolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' directly references Application UseCase '${occurrence.name}' from ${declaration.repoRelativePath}.`,
            categories: [
              "direct use-case injection or construction from Presentation",
              "presentation workflow orchestration",
              "inline use-case invocation from a controller, view model, presenter, route, renderer, middleware, DTO, style, or error type",
            ],
            signs: [
              "stored property, constructor parameter, method parameter, return type, computed property, construction, or static access names a UseCase inside a Presentation file",
              "Presentation code calls execute, run, handle, or invoke on a UseCase",
            ],
            architecturalNote:
              "Presentation calls Application Services, not UseCases. Services orchestrate UseCases on the Application side, so Presentation never holds a UseCase reference directly.",
            destination:
              "Application/Services for the workflow boundary that Presentation depends on; the UseCase stays behind that Service.",
            decomposition: `Move the call that uses '${occurrence.name}' behind an Application/Services type, inject that Service into Presentation, and keep orchestration out of the Presentation file.`,
          }),
          occurrence.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

/**
 * `presentation.port_protocol_reference` — Presentation must not invoke
 * Application port protocols directly; UseCases own port invocation behind
 * an Application Service surface. Mirrors Swift's
 * `PresentationPortProtocolReferencePolicy`.
 */
export class PresentationPortProtocolReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.port_protocol_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const occurrence of iterateReferenceOccurrences(file)) {
      if (seenNames.has(occurrence.name)) {
        continue;
      }
      seenNames.add(occurrence.name);

      const declaration = context.uniqueDeclaration(occurrence.name);
      if (
        !declaration ||
        declaration.roleFolder !== RoleFolder.ApplicationPortsProtocols
      ) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationPortProtocolReferencePolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' directly references Application port protocol '${occurrence.name}' from ${declaration.repoRelativePath}.`,
            categories: [
              "direct port invocation from Presentation",
              "missing focused use case behind the port",
              "service API exposing an Application port instead of passive Application Contracts",
            ],
            signs: [
              "Presentation stores, accepts, resolves, or calls a Repository, Gateway, Client, Adapter, Provider, or PortProtocol seam",
              "Presentation wants to fetch, save, emit, schedule, execute, or resolve through a port",
            ],
            architecturalNote:
              "Presentation calls the Application Service only; port invocation belongs in an Application UseCase orchestrated by a Service.",
            destination:
              "Application/UseCases behind Application/Services.",
            decomposition: `Move the port invocation that uses '${occurrence.name}' into an Application UseCase, move workflow coordination into an Application Service, and let Presentation depend on the Application Service only.`,
          }),
          occurrence.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

/**
 * `presentation.composition_reference` — Presentation must not reference
 * composition-root types: App layer declarations or anything in the
 * App/DependencyInjection role folder. Mirrors Swift's
 * `PresentationCompositionReferencePolicy`.
 */
export class PresentationCompositionReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.composition_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const occurrence of iterateReferenceOccurrences(file)) {
      if (seenNames.has(occurrence.name)) {
        continue;
      }
      seenNames.add(occurrence.name);

      const declaration = context.uniqueDeclaration(occurrence.name);
      if (
        !declaration ||
        (declaration.layer !== ArchitectureLayer.App &&
          declaration.roleFolder !== RoleFolder.AppDependencyInjection)
      ) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationCompositionReferencePolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' references composition-root type '${occurrence.name}' from ${declaration.repoRelativePath}.`,
            categories: [
              "composition root accessed from Presentation",
              "dependency container leaked into Presentation",
              "presentation code bypassing Application service injection",
            ],
            signs: [
              "type reference, construction, static access, or resolver call names an App or App/DependencyInjection type",
              "Presentation resolves dependencies instead of receiving an Application Service",
            ],
            architecturalNote:
              "App/DependencyInjection is the wiring root; Presentation receives Application Services from it but does not reference composition types directly.",
            destination:
              "App/DependencyInjection wiring plus Application/Services dependencies in Presentation.",
            decomposition: `Move dependency construction and resolution involving '${occurrence.name}' to App/DependencyInjection, inject the Application Service into Presentation, and keep Presentation free of composition-root types.`,
          }),
          occurrence.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

/**
 * `presentation.dependency_resolution` — Presentation must not use service
 * locators, dependency containers, singleton dependency access, decorator
 * injection, or framework DI helpers. Receive Application Services through
 * the constructor instead. Mirrors Swift's
 * `PresentationDependencyResolutionPolicy`.
 */
export class PresentationDependencyResolutionPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.dependency_resolution";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    return file.dependencyResolutionOccurrences.map((occurrence) =>
      file.diagnostic(
        PresentationDependencyResolutionPolicy.ruleID,
        richRemediationMessage({
          summary: `Presentation file '${file.repoRelativePath}' resolves dependencies directly. Offending access: ${describePresentationResolutionAccess(occurrence)}.`,
          categories: [
            "service-locator or dependency-container resolution inside Presentation",
            "static dependency-registry access from Presentation",
            "decorator-mediated injection on a Presentation declaration",
            "singleton dependency access from a Presentation file",
          ],
          signs: [
            "Presentation references Container, ServiceLocator, DependencyContainer, Resolver, Registry, Injector, AppGraph, Dependencies, or DependencyValues",
            "a static member such as .resolve/.get/.register/.shared/.default/.live appears on a dependency-shaped type inside Presentation",
            "@Inject, @Injected, @Dependency, or @Provided decorates a Presentation class, method, or member",
          ],
          architecturalNote:
            "Presentation receives Application Services from App/DependencyInjection through constructor injection; service locators, dependency containers, decorator injection, and singleton dependency access bypass that wiring.",
          destination:
            "App/DependencyInjection for resolution; Application/Services as the Presentation-facing workflow API; Infrastructure for concrete implementations.",
          decomposition:
            "Move dependency resolution to App/DependencyInjection, inject Application Services into Presentation through the constructor, move any port/protocol invocation into an Application UseCase behind a Service, and keep concrete implementations in Infrastructure.",
        }),
        occurrence.coordinate,
      ),
    );
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
    new PresentationUseCaseReferencePolicy(),
    new PresentationPortProtocolReferencePolicy(),
    new PresentationCompositionReferencePolicy(),
    new PresentationDependencyResolutionPolicy(),
  ];
}

function diagnoseSimplePresentationRoleFile(
  file: ArchitectureFile,
  shouldEvaluate: boolean,
  ruleID: string,
  requiredSuffix: string,
  roleLabel: string,
  options: {
    readonly includeTopLevelValueDeclarations?: boolean;
  } = {},
): readonly ArchitectureDiagnostic[] {
  if (!shouldEvaluate) {
    return [];
  }

  const diagnostics: ArchitectureDiagnostic[] = [];
  const roleDeclarations = presentationRoleDeclarations(file, options);

  for (const declaration of roleDeclarations) {
    if (declaration.isProtocol) {
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
            `${roleLabel} files should expose declarations ending in '${requiredSuffix}', but '${declaration.name}' does not.`,
            `Rename '${declaration.name}' to end with '${requiredSuffix}' or move it to the presentation role that matches its responsibility.`,
          ),
          declaration.coordinate,
        ),
      );
    }
  }

  const hasRequiredType = roleDeclarations.some(
    (declaration) =>
      !declaration.isProtocol && declaration.name.endsWith(requiredSuffix),
  );

  if (!hasRequiredType) {
    diagnostics.push(
      file.diagnostic(
        ruleID,
        presentationRemediationMessage(
          `${roleLabel} files must expose at least one declaration ending in '${requiredSuffix}'.`,
          `Add or rename a concrete ${requiredSuffix.toLowerCase()} declaration in ${file.repoRelativePath} so the file clearly owns that presentation role.`,
        ),
      ),
    );
  }

  return diagnostics;
}

function presentationRoleDeclarations(
  file: ArchitectureFile,
  options: {
    readonly includeTopLevelValueDeclarations?: boolean;
  },
): readonly Array<{
  readonly name: string;
  readonly isProtocol: boolean;
  readonly coordinate: { readonly line: number; readonly column: number };
}> {
  const nominalDeclarations = file.topLevelDeclarations.map((declaration) => ({
    name: declaration.name,
    isProtocol: declaration.kind === NominalKind.Protocol,
    coordinate: declaration.coordinate,
  }));

  if (!options.includeTopLevelValueDeclarations) {
    return nominalDeclarations;
  }

  const valueDeclarations = file.topLevelValueDeclarations.map(
    (declaration) => ({
      name: declaration.name,
      isProtocol: false,
      coordinate: declaration.coordinate,
    }),
  );

  return [...nominalDeclarations, ...valueDeclarations];
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

/**
 * Lift the historic terse `presentationRemediationMessage(summary, destination)`
 * helper into the Swift-parity rich format (5 canonical markers). The new
 * Stage 5 Presentation policies populate the markers directly through
 * `richRemediationMessage`; legacy call sites in this file delegate through
 * this helper so every Presentation diagnostic exposes Likely categories,
 * signs, architectural note, destination, and explicit decomposition guidance.
 *
 * Acceptance criterion: PARITY.md §6.2.
 */
function presentationRemediationMessage(
  summary: string,
  destination: string,
): string {
  return richRemediationMessage({
    summary,
    categories: [
      "Presentation-layer boundary, role, or surface violation",
    ],
    signs: [
      "the file is classified under Presentation but does not satisfy the rule's expected shape, placement, or surface",
    ],
    architecturalNote:
      "Presentation depends on Application Services (and Application Contracts) through inward injection; controllers, routes, DTOs, presenters, renderers, middleware, view-models, views, styles, and errors keep that boundary visible to consumers and to the linter.",
    destination,
    decomposition: `Follow the destination guidance: ${destination}`,
  });
}

function describePresentationResolutionAccess(occurrence: {
  readonly baseName: string;
  readonly memberName?: string;
}): string {
  if (occurrence.memberName === undefined) {
    return `@${occurrence.baseName}`;
  }
  return `${occurrence.baseName}.${occurrence.memberName}`;
}
