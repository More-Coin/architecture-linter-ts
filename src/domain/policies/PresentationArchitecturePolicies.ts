import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import type { IndexedDeclaration } from "../ValueObjects/IndexedDeclaration.ts";
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

    const hasServiceReference = file.typeReferences.some((reference) =>
      context
        .resolvedDeclarations(reference.name)
        .some(
          (declaration) =>
            declaration.roleFolder === RoleFolder.ApplicationServices,
        ),
    );

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

      const declaration = context.resolvedDeclarations(reference.name).find(
        (candidate) => candidate.roleFolder === RoleFolder.ApplicationUseCases,
      );
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

export class PresentationApplicationFunctionSeamPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.application_function_seam";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenCoordinates = new Set<string>();

    for (const occurrence of file.functionTypeOccurrences) {
      const parameterMatches = (occurrence.parameterTypeNames ?? [])
        .flatMap((typeName) => declarationsNamed(context, typeName))
        .filter((declaration) => declaration.layer === ArchitectureLayer.Application);
      const returnMatches = (occurrence.returnTypeNames ?? [])
        .flatMap((typeName) => declarationsNamed(context, typeName))
        .filter((declaration) => declaration.layer === ArchitectureLayer.Application);
      const matched = [...parameterMatches, ...returnMatches][0];
      if (!matched) {
        continue;
      }

      const hasApplicationReturn = returnMatches.length > 0;
      const hasCommandParameter = parameterMatches.some(
        (declaration) =>
          declaration.roleFolder === RoleFolder.ApplicationContractsCommands,
      );
      const hasAsyncApplication = occurrence.isAsync === true;
      const hasNonVoidApplication = occurrence.isVoidLikeReturn !== true;
      if (
        !hasApplicationReturn &&
        !hasCommandParameter &&
        !hasAsyncApplication &&
        !hasNonVoidApplication
      ) {
        continue;
      }

      const coordinateKey = `${occurrence.coordinate.line}:${occurrence.coordinate.column}`;
      if (seenCoordinates.has(coordinateKey)) {
        continue;
      }
      seenCoordinates.add(coordinateKey);

      diagnostics.push(
        file.diagnostic(
          PresentationApplicationFunctionSeamPolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' declares a function or closure seam at line ${occurrence.coordinate.line} whose signature names Application type '${matched.name}'.`,
            categories: [
              "anonymous closure used as the presentation-to-application boundary",
              "Application command contract submitted through a callable instead of a named service method",
              "async Application workflow sequenced, raced, or cancelled inside a view",
            ],
            signs: [
              "a stored property, type alias, interface property, or initializer parameter has a function type",
              "the function type's parameter or return names resolve to Application declarations",
              "the parameter is an Application/Contracts/Commands type, the closure returns an Application type, or the return is Promise-like",
            ],
            architecturalNote:
              "Workflow execution crosses the presentation-to-application boundary through named Application service dependencies, not anonymous callable seams; named seams stay lintable, and timing, fallback, and cancellation policy stays behind the boundary.",
            destination:
              "Application/Services (a named service API injected where the closure was injected; construction stays in App/DependencyInjection).",
            decomposition:
              "Declare the operation as a method on an Application/Services type, move latency budgets, racing, cancellation, deduplication, and fallback decisions into that service, inject the service into the Presentation type in place of the closure, replace each closure invocation with a service call while keeping only render-state assignment in the view, then re-run the linter.",
          }),
          occurrence.coordinate,
        ),
      );
    }

    return diagnostics;
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
    const localNames = new Set([
      ...file.topLevelDeclarations.map((declaration) => declaration.name),
      ...file.nestedNominalDeclarations.map((declaration) => declaration.name),
    ]);
    const seenNames = new Set<string>();
    const occurrences = [
      ...file.typeReferences.map((reference) => ({
        name: reference.name,
        coordinate: reference.coordinate,
      })),
      ...file.constructionOccurrences.map((occurrence) => ({
        name: occurrence.typeName,
        coordinate: occurrence.coordinate,
      })),
      ...file.staticMemberAccessOccurrences.map((occurrence) => ({
        name: occurrence.baseName,
        coordinate: occurrence.coordinate,
      })),
    ];

    for (const occurrence of occurrences) {
      if (localNames.has(occurrence.name) || seenNames.has(occurrence.name)) {
        continue;
      }
      seenNames.add(occurrence.name);

      const declaration = context.resolvedDeclarations(occurrence.name).find(
        (candidate) => candidate.layer === ArchitectureLayer.Infrastructure,
      );
      if (!declaration || declaration.layer !== ArchitectureLayer.Infrastructure) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationInfrastructureReferencePolicy.ruleID,
          presentationRemediationMessage(
            `Presentation must not depend on infrastructure type '${occurrence.name}' from ${declaration.repoRelativePath}.`,
            `Remove the direct infrastructure dependency from ${file.repoRelativePath} and replace it with an inward-facing dependency.`,
          ),
          occurrence.coordinate,
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
 * `presentation.domain_policy_reference` — Presentation must not call or
 * construct Domain policies directly; Application Services surface the
 * resulting decision as passive contract data.
 */
export class PresentationDomainPolicyReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.domain_policy_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const localNames = new Set([
      ...file.topLevelDeclarations.map((declaration) => declaration.name),
      ...file.nestedNominalDeclarations.map((declaration) => declaration.name),
    ]);
    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const occurrence of iterateReferenceOccurrences(file)) {
      if (localNames.has(occurrence.name) || seenNames.has(occurrence.name)) {
        continue;
      }
      seenNames.add(occurrence.name);

      const declarations = context.declarations.filter(
        (declaration) => declaration.name === occurrence.name,
      );
      const declaration = declarations.find(
        (candidate) => candidate.roleFolder === RoleFolder.DomainPolicies,
      );
      if (!declaration) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationDomainPolicyReferencePolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' directly references Domain policy '${occurrence.name}' declared in '${declaration.repoRelativePath}', but policy decisions are made behind the Application service boundary and cross into Presentation as contract data${declarations.length > 1 ? "; the name is ambiguous and one matching declaration violates the Presentation boundary" : ""}.`,
            categories: [
              "policy invocation from a view, view model, route, or style",
              "policy-input selection performed in Presentation",
              "decision logic consumed as a static call instead of a contract field",
            ],
            signs: [
              "a type reference, construction, or static member access in a Presentation file resolves to a declaration under Domain/Policies",
              "Presentation chooses the arguments the policy decides over",
              "the same policy also drives Application services or use cases",
            ],
            architecturalNote:
              "Presentation's only entry into Application is the Application service. Domain policies are inner-layer decision rules whose outcomes are computed once behind the boundary, so a view calling a policy duplicates the decision path and lets the two copies drift.",
            destination:
              "the Application service or use case assembling the contract the view already consumes, surfacing the policy outcome as a passive field on that contract.",
            decomposition: `Move the policy call and its input selection for '${occurrence.name}' into the Application service or use case, add the computed outcome to the contract, and replace the Presentation policy reference with a contract-field read.`,
          }),
          occurrence.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

/**
 * `presentation.state_transition_reference` — Presentation must not invoke
 * Application StateTransitions directly; state mutation belongs behind the
 * Application service boundary.
 */
export class PresentationStateTransitionReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.state_transition_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const localNames = new Set([
      ...file.topLevelDeclarations.map((declaration) => declaration.name),
      ...file.nestedNominalDeclarations.map((declaration) => declaration.name),
    ]);
    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const occurrence of iterateReferenceOccurrences(file)) {
      if (localNames.has(occurrence.name) || seenNames.has(occurrence.name)) {
        continue;
      }
      seenNames.add(occurrence.name);

      const declarations = context.declarations.filter(
        (declaration) => declaration.name === occurrence.name,
      );
      const declaration = declarations.find(
        (candidate) =>
          candidate.roleFolder === RoleFolder.ApplicationStateTransitions,
      );
      if (!declaration) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationStateTransitionReferencePolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' directly references Application StateTransition '${occurrence.name}' from ${declaration.repoRelativePath}${declarations.length > 1 ? "; the name is ambiguous and one matching declaration violates the Presentation boundary" : ""}.`,
            categories: [
              "next-state computation performed in Presentation",
              "whole-state write submitted from a view instead of a field-level command",
              "stale-snapshot resurrection risk from read-modify-write across the boundary",
            ],
            signs: [
              "type reference, construction, or static member access resolves to Application/StateTransitions",
              "Presentation holds the previous full state contract, applies the transition, and submits the result",
              "sibling mutation flows use command contracts while this one computes state",
            ],
            architecturalNote:
              "Presentation adapts user input into commands and triggers Application services; state-transition computation, field coalescing, and defaulting are Application behavior that must see the authoritative current state, not the view's possibly-stale snapshot.",
            destination:
              "Application/Contracts/Commands (an update command contract with optional fields for changed values) applied inside Application/Services or Application/UseCases via the existing StateTransition.",
            decomposition:
              "Define an update command contract carrying only the changed fields as optionals, add a service method that loads current state and applies the StateTransition inside Application, replace each Presentation StateTransition invocation with construction and submission of that command, remove the StateTransition reference from the Presentation file, and re-run the linter.",
          }),
          occurrence.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

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

      const declaration = context.resolvedDeclarations(occurrence.name).find(
        (candidate) => candidate.roleFolder === RoleFolder.ApplicationUseCases,
      );
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

      const declaration = context.resolvedDeclarations(occurrence.name).find(
        (candidate) =>
          candidate.roleFolder === RoleFolder.ApplicationPortsProtocols,
      );
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

      const declaration = context.resolvedDeclarations(occurrence.name).find(
        (candidate) =>
          candidate.layer === ArchitectureLayer.App ||
          candidate.roleFolder === RoleFolder.AppDependencyInjection,
      );
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

/**
 * `presentation.calendar_day_bucketing` — Presentation must not perform
 * day/week bucketing or calendar membership policy. Application should expose
 * precomputed buckets, week slots, and day flags on the consumed contract.
 */
export class PresentationCalendarDayBucketingPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.calendar_day_bucketing";

  private static readonly memberNames = new Set([
    "startOfDay",
    "dateComponents",
    "isDateInToday",
    "isDateInYesterday",
    "isDateInTomorrow",
    "isDateInWeekend",
    "isDate",
    "isToday",
    "isYesterday",
    "isTomorrow",
    "isWeekend",
  ]);

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    return file.memberCallOccurrences.flatMap((occurrence) => {
      if (!PresentationCalendarDayBucketingPolicy.memberNames.has(occurrence.memberName)) {
        return [];
      }

      return [
        file.diagnostic(
          PresentationCalendarDayBucketingPolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' performs calendar day-bucketing via '${occurrence.baseName}.${occurrence.memberName}' at line ${occurrence.coordinate.line}.`,
            categories: [
              "week-window or day-membership computation in a view",
              "consistency or streak math re-derived from raw entries instead of consumed from prepared state",
              "hand-rolled fallback bucketing policy living in Presentation",
            ],
            signs: [
              "startOfDay, dateComponents, isDateIn*, or clear isToday/isWeekend-style calendar calls appear in a Presentation file",
              "entries are grouped into day or week buckets locally",
              "the result parallels a value already computed behind the service boundary",
            ],
            architecturalNote:
              "Day-membership and week-window decisions are policy owned inward by the Domain day-key policy and prepared consistency state; views render buckets and flags they are given, otherwise view math can drift from what the pipeline persists and schedules.",
            destination:
              "the Application UseCase or Service that assembles the consumed contract, exposing precomputed week slots, day flags, and progress as contract fields anchored on the same Domain day-key policy the save path uses.",
            decomposition:
              "Move the week-window derivation, day-bucket matching, and any legacy fallback redistribution into the use case that builds the consumed contract, anchor it on the Domain day-key policy used by the save path, add the resulting slots and flags to the contract, reduce the view to iterating the provided buckets with no calendar arithmetic, then re-run the linter.",
          }),
          occurrence.coordinate,
        ),
      ];
    });
  }
}

/**
 * `presentation.platform_state_access` — Presentation must not read or write
 * durable browser storage, process/bundle/env state, or raw platform handles
 * directly. Mirrors Swift's `PresentationPlatformStateAccessPolicy` using
 * web and Node surfaces visible in the TypeScript analyzer.
 */
export class PresentationPlatformStateAccessPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.platform_state_access";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seen = new Set<string>();

    for (const occurrence of file.identifierOccurrences) {
      if (occurrence.name === "localStorage" || occurrence.name === "sessionStorage") {
        appendPresentationPlatformDiagnostic(
          occurrence.name,
          occurrence.name,
          file,
          occurrence.coordinate,
          seen,
          diagnostics,
        );
      }
    }

    for (const occurrence of file.staticMemberAccessOccurrences) {
      const access = `${occurrence.baseName}.${occurrence.memberName}`;
      if (
        access === "document.cookie" ||
        access === "navigator.clipboard" ||
        access === "process.env" ||
        access === "import.meta.env" ||
        access === "globalThis.localStorage" ||
        access === "globalThis.sessionStorage" ||
        access === "window.localStorage" ||
        access === "window.sessionStorage"
      ) {
        appendPresentationPlatformDiagnostic(
          access,
          normalizePresentationPlatformAccess(access),
          file,
          occurrence.coordinate,
          seen,
          diagnostics,
        );
      }
    }

    for (const occurrence of file.memberCallOccurrences) {
      if (
        occurrence.baseName === "localStorage" ||
        occurrence.baseName === "sessionStorage"
      ) {
        appendPresentationPlatformDiagnostic(
          `${occurrence.baseName}.${occurrence.memberName}`,
          occurrence.baseName,
          file,
          occurrence.coordinate,
          seen,
          diagnostics,
        );
      }
    }

    for (const occurrence of file.typedMemberOccurrences) {
      if (occurrence.typeNames.includes("Clipboard")) {
        appendPresentationPlatformDiagnostic(
          "Clipboard",
          `Clipboard:${occurrence.name}`,
          file,
          occurrence.coordinate,
          seen,
          diagnostics,
        );
      }
    }

    for (const occurrence of file.constructionOccurrences) {
      if (occurrence.typeName === "Clipboard") {
        appendPresentationPlatformDiagnostic(
          "Clipboard",
          "Clipboard",
          file,
          occurrence.coordinate,
          seen,
          diagnostics,
        );
      }
    }

    return diagnostics;
  }
}

export class PresentationCrossLayerWireLiteralPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "presentation.cross_layer_wire_literal";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPresentation) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenValues = new Set<string>();

    for (const occurrence of file.stringLiteralOccurrences) {
      const value = occurrence.value;
      if (
        seenValues.has(value) ||
        !isPresentationCrossLayerWireLiteralCandidate(value)
      ) {
        continue;
      }
      seenValues.add(value);

      const otherSite = context.literalSites(value).find(
        (site) =>
          site.repoRelativePath !== file.repoRelativePath &&
          (site.layer === ArchitectureLayer.Infrastructure ||
            (site.layer === ArchitectureLayer.Application &&
              (site.roleFolder === RoleFolder.ApplicationUseCases ||
                site.roleFolder === RoleFolder.ApplicationServices))),
      );
      if (!otherSite) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          PresentationCrossLayerWireLiteralPolicy.ruleID,
          richRemediationMessage({
            summary: `Presentation file '${file.repoRelativePath}' embeds wire-format token '${value}' that also appears in an Application or Infrastructure file ('${otherSite.repoRelativePath}').`,
            categories: [
              "presentation-side decoding of an encoding minted behind the service boundary",
              "duplicated wire-format prefix drifting independently across layers",
              "identifier translation performed after the contract crossed into Presentation",
            ],
            signs: [
              "a token-like string literal ends with a separator character",
              "the identical literal occurs in Application UseCases/Services or Infrastructure",
              "Presentation strips, matches, or assembles identifiers around the token",
            ],
            architecturalNote:
              "Encodings produced behind the Application service boundary must be resolved there; contracts that cross into Presentation carry fully resolved, passive data, never encoded references that Presentation must reverse-engineer.",
            destination:
              "the owning Application UseCase or Service, resolving the encoded reference before the contract is returned and keeping a single token owner that Infrastructure adapters share.",
            decomposition:
              "Resolve the encoded reference inside the owning Application UseCase or Service, reuse the existing Infrastructure resolver port where one exists, place the resolved identifier on the contract field Presentation consumes, delete the Presentation-side token constant and strip/decode logic, reduce the Presentation mapping to a one-to-one copy of contract fields, then re-run the linter.",
          }),
          occurrence.coordinate,
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
    new PresentationApplicationFunctionSeamPolicy(),
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
    new PresentationDomainPolicyReferencePolicy(),
    new PresentationStateTransitionReferencePolicy(),
    new PresentationUseCaseReferencePolicy(),
    new PresentationPortProtocolReferencePolicy(),
    new PresentationCompositionReferencePolicy(),
    new PresentationDependencyResolutionPolicy(),
    new PresentationCalendarDayBucketingPolicy(),
    new PresentationPlatformStateAccessPolicy(),
    new PresentationCrossLayerWireLiteralPolicy(),
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

function declarationsNamed(
  context: ProjectContext,
  name: string,
): readonly IndexedDeclaration[] {
  return context.declarations.filter((declaration) => declaration.name === name);
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

function normalizePresentationPlatformAccess(access: string): string {
  if (
    access.endsWith(".localStorage") ||
    access.endsWith(".sessionStorage")
  ) {
    return access.split(".").at(-1) ?? access;
  }
  return access;
}

function appendPresentationPlatformDiagnostic(
  access: string,
  dedupeKey: string,
  file: ArchitectureFile,
  coordinate: { readonly line: number; readonly column: number },
  seen: Set<string>,
  diagnostics: ArchitectureDiagnostic[],
): void {
  const key = `${dedupeKey}:${coordinate.line}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);

  diagnostics.push(
    file.diagnostic(
      PresentationPlatformStateAccessPolicy.ruleID,
      richRemediationMessage({
        summary: `Presentation file '${file.repoRelativePath}' accesses platform storage, process state, or a raw platform handle directly via '${access}'.`,
        categories: [
          "durable browser storage read or written from Presentation",
          "process, bundle, or environment state read outside the composition root",
          "clipboard or platform handle accessed from a view, route, controller, or view model",
        ],
        signs: [
          "localStorage, sessionStorage, window/globalThis storage, or document.cookie appears in a Presentation file",
          "process.env or import.meta.env appears in a Presentation file",
          "navigator.clipboard or a Clipboard-typed member appears in a Presentation file",
        ],
        architecturalNote:
          "Durable state goes through inward ports and Application services, and platform access is wired at the composition root. Presentation receives plain values or Application service methods instead of raw storage, environment, clipboard, or platform handles.",
        destination:
          "Application/Services and Application/Ports/Protocols for durable settings or clipboard workflows; App/DependencyInjection or App/Runtime for environment and platform reads, injected into Presentation as plain data or a service API.",
        decomposition:
          "Move persisted settings behind an Application service and port, move clipboard side effects behind an Application service backed by an Infrastructure adapter, replace environment reads with values supplied by App/DependencyInjection, then re-run the linter.",
      }),
      coordinate,
    ),
  );
}

const PRESENTATION_WIRE_LITERAL_PATTERN = /^[A-Za-z0-9._:/-]+$/;
const PRESENTATION_WIRE_LITERAL_TRAILING_SEPARATORS = new Set([
  ".",
  ":",
  "-",
  "_",
  "/",
]);

function isPresentationCrossLayerWireLiteralCandidate(value: string): boolean {
  return (
    value.length >= 4 &&
    PRESENTATION_WIRE_LITERAL_PATTERN.test(value) &&
    PRESENTATION_WIRE_LITERAL_TRAILING_SEPARATORS.has(value.at(-1) ?? "")
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
