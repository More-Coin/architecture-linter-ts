import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import type {
  ArchitectureProjectPolicyInput,
  ArchitectureProjectPolicyProtocol,
} from "../Protocols/ArchitectureProjectPolicyProtocol.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { ArchitectureComputedPropertyDeclaration } from "../ValueObjects/ArchitectureComputedPropertyDeclaration.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import type { ArchitectureLinterConfiguration } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import type { ArchitectureMethodDeclaration } from "../ValueObjects/ArchitectureMethodDeclaration.ts";
import type { ArchitectureNestedNominalDeclaration } from "../ValueObjects/ArchitectureNestedNominalDeclaration.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import type { ArchitectureOperationalUseOccurrence } from "../ValueObjects/ArchitectureOperationalUseOccurrence.ts";
import type { ArchitectureStoredMemberDeclaration } from "../ValueObjects/ArchitectureStoredMemberDeclaration.ts";
import type { ArchitectureTopLevelDeclaration } from "../ValueObjects/ArchitectureTopLevelDeclaration.ts";
import type { IndexedDeclaration } from "../ValueObjects/IndexedDeclaration.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";
import type { SourceCoordinate } from "../ValueObjects/SourceCoordinate.ts";
import {
  canonicalReferenceTypeName,
  iterateReferenceOccurrences,
} from "./shared/ReferenceOccurrences.ts";
import { richRemediationMessage } from "./shared/RichRemediationMessage.ts";

export class InfrastructureRepositoriesShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.repositories.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureRepositoryFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      if (declaration.kind === NominalKind.Protocol) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureRepositoriesShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Repositories should expose concrete repository implementations, but '${declaration.name}' is a protocol.`,
              `Move '${declaration.name}' to Domain/Protocols or Application/Ports/Protocols and keep only concrete repository implementations in ${file.repoRelativePath}.`,
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (
        declaration.kind !== NominalKind.Enum &&
        !declaration.name.endsWith("Repository")
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureRepositoriesShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Repositories should expose concrete repository types ending in 'Repository', but '${declaration.name}' does not.`,
              `Rename '${declaration.name}' to end with 'Repository' or move it to the folder that matches its actual responsibility.`,
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    if (!hasConcreteTypeWithSuffix(file, "Repository")) {
      diagnostics.push(
        file.diagnostic(
          InfrastructureRepositoriesShapePolicy.ruleID,
          infrastructureRemediationMessage(
            "Infrastructure/Repositories files should expose at least one concrete repository type ending in 'Repository'.",
            `Add a concrete repository implementation to ${file.repoRelativePath} or move the file to the correct infrastructure role.`,
          ),
        ),
      );
    }

    return diagnostics;
  }
}

/**
 * `infrastructure.repositories.role_fit` — concrete repository-shaped types
 * under `Infrastructure/Repositories` must actually behave like repository
 * adapters. Two violation paths, mirroring Swift's
 * `InfrastructureRepositoriesRoleFitPolicy`:
 *
 *   (a) **Public surface leak.** A public method parameter or return type
 *       resolves to a declaration in `InfrastructureTranslationDTOs`,
 *       `InfrastructureTranslationModels`, or `PresentationDTOs`. Repository
 *       boundaries speak Domain/Application types; provider DTOs and
 *       translation models stay internal to Infrastructure.
 *
 *   (b) **Missing inward conformance.** A `*Repository`-suffixed concrete
 *       declaration declares no inherited type ending in `Repository`
 *       (i.e. no inward Repository protocol/interface). A real repository
 *       adapter fulfils an inward repository contract; a "repository" that
 *       conforms to nothing is usually mislabeled translation or gateway
 *       behavior.
 */
export class InfrastructureRepositoriesRoleFitPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.repositories.role_fit";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureRepositoryFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    const repositoryDeclarations = file.topLevelDeclarations.filter(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol &&
        declaration.kind !== NominalKind.Enum &&
        declaration.name.endsWith("Repository"),
    );

    for (const declaration of repositoryDeclarations) {
      // Path (a) — public surface leak.
      const seenLeakKeys = new Set<string>();
      for (const method of file.methodDeclarations) {
        if (method.enclosingTypeName !== declaration.name) {
          continue;
        }
        if (!method.isPublicOrOpen) {
          continue;
        }

        for (const typeName of [
          ...method.parameterTypeNames,
          ...method.returnTypeNames,
        ]) {
          const leakedDeclaration = repositoryBoundaryLeakDeclaration(
            typeName,
            context,
          );
          if (!isRepositoryMisclassificationTypeName(typeName, file, context)) {
            continue;
          }

          const key = `${typeName}:${method.coordinate.line}:${method.coordinate.column}`;
          if (seenLeakKeys.has(key)) {
            continue;
          }
          seenLeakKeys.add(key);

          diagnostics.push(
            file.diagnostic(
              InfrastructureRepositoriesRoleFitPolicy.ruleID,
              richRemediationMessage({
                summary: `Repository '${declaration.name}' exposes outer-layer DTO/model type '${typeName}' in its public operation surface (${repositoryLeakSourceDescription(leakedDeclaration)}).`,
                categories: [
                  "provider DTO leaked through repository API",
                  "translation model exposed instead of Domain/Application result",
                  "Presentation DTO leaked into Infrastructure repository boundary",
                ],
                signs: [
                  "public repository method parameter or return type resolves to Infrastructure/Translation/DTOs, Infrastructure/Translation/Models, or Presentation/DTOs",
                  `repository file lives under Infrastructure/Repositories and the offending type is '${typeName}'`,
                  "repository type name ends with 'Repository'",
                ],
                architecturalNote:
                  "Repositories hide provider and persistence details from UseCases. Public repository APIs speak Domain/Application types through inward protocols, while provider DTOs and translation models stay internal to Infrastructure.",
                destination:
                  "Return or accept Domain/Application types at the repository protocol boundary. Keep provider DTOs in Infrastructure/Translation/DTOs and normalized intermediary models in Infrastructure/Translation/Models.",
                decomposition: `Move '${typeName}' out of the public surface of '${declaration.name}'. Map provider DTOs or translation models inside the repository (or in a translation helper) and return the Domain/Application type required by the inward Repository protocol. If the method really is a provider call returning provider data, move it to Infrastructure/Gateways or Infrastructure/PortAdapters instead of exposing it as a repository operation.`,
              }),
              method.coordinate,
            ),
          );
        }
      }

      // Path (b) — missing inward Repository conformance plus evidence that
      // the type is not acting as a real data-access adapter.
      const methods = file.methodDeclarations.filter(
        (method) => method.enclosingTypeName === declaration.name,
      );

      if (
        !hasRepositoryInwardProtocolConformance(declaration, context) &&
        !hasRepositoryDataAccessEvidence(file, declaration.name, methods, context) &&
        hasRepositoryMisclassificationEvidence(file, declaration, methods, context)
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureRepositoriesRoleFitPolicy.ruleID,
            richRemediationMessage({
              summary: `'${declaration.name}' is repository-shaped but does not appear to act as a concrete repository adapter.`,
              categories: [
                "repository-shaped type without data-source adaptation",
                "translation/helper/reporting behavior placed in Infrastructure/Repositories",
                "gateway or port-adapter behavior mislabeled as repository",
                "repository type missing inward protocol conformance",
              ],
              signs: [
                `type '${declaration.name}' ends with 'Repository'`,
                "type lives under Infrastructure/Repositories",
                "type lacks conformance to an Application/Ports/Protocols or Domain/Protocols abstraction",
                "methods do not show repository data-access verbs or data-source adaptation",
                "methods or public signatures show DTO, Response, Request, Model, Mapper, Builder, Parser, Evaluator, Gateway, or Adapter evidence",
              ],
              architecturalNote:
                "A repository is a concrete Infrastructure adapter that fulfils an inward repository/data-access protocol and hides persistence or provider details from UseCases. Translation-only, DTO-only, gateway execution, and evaluator behavior belong in adjacent Infrastructure roles.",
              destination:
                "Keep true data-source adaptation in Infrastructure/Repositories. Move provider request/response shapes to Infrastructure/Translation/DTOs, intermediary mapping shapes to Infrastructure/Translation/Models, external boundary execution to Infrastructure/Gateways, seam adapters to Infrastructure/PortAdapters, and pure technical decisions to Infrastructure/Evaluators.",
              decomposition: `Decide what '${declaration.name}' actually owns. If it adapts persistence or provider data access, make it conform to the matching inward Repository protocol/interface and keep public methods returning Domain/Application types. If it primarily maps provider shapes, move the mapping to Infrastructure/Translation/Models or to a private helper used only by this repository. If it primarily executes an external boundary, move it to Infrastructure/Gateways. If it only exposes DTOs or response models, move those types to Infrastructure/Translation/DTOs and keep a concrete *Repository in this file only when there is actual repository behavior.`,
            }),
            declaration.coordinate,
          ),
        );
      }
    }

    return diagnostics;
  }
}

export class InfrastructureRepositoriesInlineBusinessLiteralsPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.repositories.inline_business_literals";

  private readonly storageNamespacePrefixes: readonly string[];

  constructor(
    configuration: ArchitectureLinterConfiguration =
      DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {
    this.storageNamespacePrefixes = configuration.storageNamespacePrefixes;
  }

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      file.classification.roleFolder !== RoleFolder.InfrastructureRepositories &&
      file.classification.roleFolder !== RoleFolder.InfrastructurePortAdapters
    ) {
      return [];
    }

    const role =
      file.classification.roleFolder === RoleFolder.InfrastructureRepositories
        ? "Repository"
        : "PortAdapter";

    return file.stringLiteralOccurrences
      .filter((occurrence) => {
        const value = occurrence.value;
        const isCatalogKey =
          INFRASTRUCTURE_BUSINESS_CATALOG_KEY_PATTERN.test(value) &&
          !this.storageNamespacePrefixes.some((prefix) =>
            value.startsWith(prefix),
          );
        const isCopy = value.split(/\s+/).filter(Boolean).length >= 4;

        return isCatalogKey || isCopy;
      })
      .map((occurrence) =>
        file.diagnostic(
          InfrastructureRepositoriesInlineBusinessLiteralsPolicy.ruleID,
          richRemediationMessage({
            summary: `Infrastructure ${role} '${file.repoRelativePath}' embeds business/content vocabulary as string literal '${occurrence.value}'.`,
            categories: [
              "business projection or synthesis policy implemented inside a persistence adapter",
              "localization-catalog key hardcoded in Infrastructure",
              "unlocalized user-facing copy authored in Infrastructure",
            ],
            signs: [
              "literal is a 3+-segment dotted catalog key outside the project's configured storage namespaces, or contains 4 or more words of natural-language copy",
              "the same literal is duplicated across sibling implementations",
              "the adapter conforms to an inward port yet decides what content the user sees",
            ],
            architecturalNote:
              "repositories and adapters adapt persistence and providers only -- selection, synthesis, and mapping rules expressed through key literals or copy templates are Domain/Application policy, and duplicating them per store guarantees drift between backends while shipping unlocalized copy on localized devices.",
            destination:
              "Domain/Policies (or the Application UseCase invoked through the port) for the projection/synthesis rule; the localization catalog, resolved in Presentation, for user-visible copy; Infrastructure/Translation/Models for genuine stored-value constants.",
            decomposition:
              "1) extract one shared Domain policy owning the key taxonomy and mapping; 2) have every backend return raw stored aggregates through the port; 3) compose the policy in the Application use case so all backends share one implementation; 4) replace embedded copy with a localization key plus arguments resolved at the presentation edge; 5) re-run the linter.",
          }),
          occurrence.coordinate,
        ),
      );
  }
}

export class InfrastructureGatewaysShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.gateways.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureGatewayFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      if (declaration.kind === NominalKind.Protocol) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureGatewaysShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Gateways should expose concrete gateway implementations, but '${declaration.name}' is a protocol.`,
              `Move '${declaration.name}' to the inward seam that owns the abstraction and keep only concrete gateways in ${file.repoRelativePath}.`,
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (
        INFRASTRUCTURE_GATEWAY_FORBIDDEN_SUFFIXES.some((suffix) =>
          declaration.name.endsWith(suffix),
        )
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureGatewaysShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Gateways should model external boundary executors, but '${declaration.name}' is shaped like a different role.`,
              `Move '${declaration.name}' to the infrastructure folder that matches its role or rename it to a gateway-shaped type.`,
            ),
            declaration.coordinate,
          ),
        );
      }

      if (
        declaration.kind !== NominalKind.Enum &&
        !declaration.name.endsWith("Gateway")
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureGatewaysShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Gateways should expose concrete gateway types ending in 'Gateway', but '${declaration.name}' does not.`,
              `Rename '${declaration.name}' to end with 'Gateway' or move it to the folder that matches its actual responsibility.`,
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    if (!hasConcreteTypeWithSuffix(file, "Gateway")) {
      diagnostics.push(
        file.diagnostic(
          InfrastructureGatewaysShapePolicy.ruleID,
          infrastructureRemediationMessage(
            "Infrastructure/Gateways files should expose at least one concrete gateway type ending in 'Gateway'.",
            `Add a concrete gateway implementation to ${file.repoRelativePath} or move the file to the correct infrastructure role.`,
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class InfrastructureGatewaysRoleFitPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.gateways.role_fit";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureGatewayFile) {
      return [];
    }

    return concreteTopLevelDeclarations(file).flatMap((declaration) => {
      if (!declaration.name.endsWith("Gateway")) {
        return [];
      }

      const methods = methodsForType(file, declaration.name);
      if (
        hasGatewayExecutionFlowEvidence(file, declaration.name, methods) ||
        !hasGatewayRoleFitMisclassificationEvidence(file, methods, context)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureGatewaysRoleFitPolicy.ruleID,
          infrastructureRemediationMessage(
            `'${declaration.name}' is gateway-shaped but does not look like a real external boundary executor.`,
            "Keep execution in Infrastructure/Gateways, move preparation and normalization to Infrastructure/Translation, and move pure technical decisions to Infrastructure/Evaluators.",
          ),
          firstMatchingMethodCoordinate(methods, (method) =>
            isLikelyGatewayPreparationMethod(method, file, context),
          ) ?? declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureGatewaysInlineBoundaryConfigurationShapingPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_boundary_configuration_shaping";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseGatewayMethodPattern(
      file,
      InfrastructureGatewaysInlineBoundaryConfigurationShapingPolicy.ruleID,
      (method) => isBoundaryConfigurationShapingMethod(method, file, context),
      "Infrastructure/Gateways should consume normalized boundary configuration instead of shaping it inline.",
      "Move normalized boundary-configuration shaping to Infrastructure/Translation/Models and keep final boundary-facing carriers in Infrastructure/Translation/DTOs.",
    );
  }
}

export class InfrastructureGatewaysInlineBoundaryDefinitionShapingPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_boundary_definition_shaping";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseGatewayMethodPattern(
      file,
      InfrastructureGatewaysInlineBoundaryDefinitionShapingPolicy.ruleID,
      (method) => isBoundaryDefinitionShapingMethod(method, file, context),
      "Infrastructure/Gateways should execute boundaries rather than define request or operation shapes inline.",
      "Move request-definition shaping to Infrastructure/Translation/Models or Infrastructure/Translation/DTOs and keep only execution in the gateway.",
    );
  }
}

export class InfrastructureGatewaysInlineOutboundRequestTranslationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_outbound_request_translation";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureGatewayFile) {
      return [];
    }

    return concreteTopLevelDeclarations(file).flatMap((declaration) => {
      if (!declaration.name.endsWith("Gateway")) {
        return [];
      }

      const methods = methodsForType(file, declaration.name);
      if (!hasGatewayExecutionFlowEvidence(file, declaration.name, methods)) {
        return [];
      }

      const culprit = methods.find((method) =>
        isInlineOutboundRequestTranslationMethod(method, file, context),
      );
      if (!culprit) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureGatewaysInlineOutboundRequestTranslationPolicy.ruleID,
          infrastructureRemediationMessage(
            `'${declaration.name}' performs final outbound request translation inline.`,
            "Move final outbound request or protocol translation to Infrastructure/Translation/DTOs and keep gateway code focused on runtime execution.",
          ),
          culprit.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureGatewaysInlineNormalizationPreparationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_normalization_preparation";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseGatewayMethodPattern(
      file,
      InfrastructureGatewaysInlineNormalizationPreparationPolicy.ruleID,
      (method) =>
        isInlineNormalizationPreparationMethod(
          method,
          file,
          context,
          "gateway",
        ),
      "Infrastructure/Gateways should not keep normalization or preparation helpers inline once they become a distinct translation concern.",
      "Move normalization and preparation to Infrastructure/Translation/Models by default, use Infrastructure/Translation/DTOs only for clearly final boundary-facing output, and keep runtime control in the gateway.",
      true,
    );
  }
}

export class InfrastructureGatewaysInlineObviousBoundaryDecisionLogicPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_obvious_boundary_decision_logic";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseGatewayMethodPattern(
      file,
      InfrastructureGatewaysInlineObviousBoundaryDecisionLogicPolicy.ruleID,
      (method) => isObviousTechnicalDecisionMethod(method, file, context),
      "Infrastructure/Gateways should not keep pure typed technical decision logic inline.",
      "Move classifier, selector, or resolver logic to Infrastructure/Evaluators and keep the gateway responsible for executing the selected path.",
      true,
    );
  }
}

export class InfrastructureGatewaysInlineTypedBoundaryCompatibilityEvaluationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_typed_boundary_compatibility_evaluation";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseGatewayMethodPattern(
      file,
      InfrastructureGatewaysInlineTypedBoundaryCompatibilityEvaluationPolicy.ruleID,
      (method) =>
        isTypedBoundaryCompatibilityEvaluationMethod(method, file, context),
      "Infrastructure/Gateways should not keep typed compatibility or allowance evaluation inline.",
      "Move the pure compatibility decision to Infrastructure/Evaluators, keep failure mapping in the gateway, and move raw extraction to Infrastructure/Translation when present.",
      true,
    );
  }
}

export class InfrastructureGatewaysInlineTypedInteractionDispatchPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_typed_interaction_dispatch";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnoseGatewayMethodPattern(
      file,
      InfrastructureGatewaysInlineTypedInteractionDispatchPolicy.ruleID,
      (method) => isTypedInteractionDispatchMethod(method, file, context),
      "Infrastructure/Gateways should not keep typed interaction dispatch helpers inline.",
      "Move typed path-selection logic to Infrastructure/Evaluators, keep passive branch-local shaping in Translation, and keep only execution of the selected path in the gateway.",
      true,
    );
  }
}

export class InfrastructurePortAdaptersShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.port_adapters.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructurePortAdapterFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      if (declaration.kind === NominalKind.Protocol) {
        diagnostics.push(
          file.diagnostic(
            InfrastructurePortAdaptersShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/PortAdapters should expose concrete adapter implementations, but '${declaration.name}' is a protocol.`,
              `Move '${declaration.name}' to the inward seam that owns the abstraction and keep only concrete port adapters in ${file.repoRelativePath}.`,
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (
        INFRASTRUCTURE_PORT_ADAPTER_FORBIDDEN_SUFFIXES.some((suffix) =>
          declaration.name.endsWith(suffix),
        )
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructurePortAdaptersShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/PortAdapters should hold boundary adapters, but '${declaration.name}' is shaped like a different role.`,
              `Move '${declaration.name}' to the folder that matches its role or rename it to a concrete port-adapter type.`,
            ),
            declaration.coordinate,
          ),
        );
      }

      if (!declaration.name.endsWith("PortAdapter")) {
        diagnostics.push(
          file.diagnostic(
            InfrastructurePortAdaptersShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/PortAdapters should expose concrete adapter types ending in 'PortAdapter', but '${declaration.name}' does not.`,
              `Rename '${declaration.name}' to end with 'PortAdapter' or move it to the folder that matches its actual responsibility.`,
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    if (!file.topLevelDeclarations.some((declaration) => declaration.name.endsWith("PortAdapter"))) {
      diagnostics.push(
        file.diagnostic(
          InfrastructurePortAdaptersShapePolicy.ruleID,
          infrastructureRemediationMessage(
            "Infrastructure/PortAdapters files should expose at least one concrete type ending in 'PortAdapter'.",
            `Add a concrete port adapter implementation to ${file.repoRelativePath} or move the file to the correct infrastructure role.`,
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class InfrastructurePortAdaptersInlineTranslationSubsystemPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.port_adapters.inline_translation_subsystem";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructurePortAdapterFile) {
      return [];
    }

    return concreteTopLevelDeclarations(file).flatMap((declaration) => {
      if (!declaration.name.endsWith("PortAdapter")) {
        return [];
      }

      const culprit = methodsForType(file, declaration.name).find((method) =>
        hasTranslationSubsystemSurface(method, file, context),
      );
      if (!culprit) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructurePortAdaptersInlineTranslationSubsystemPolicy.ruleID,
          infrastructureRemediationMessage(
            `'${declaration.name}' keeps parsing or translation-subsystem work inline inside Infrastructure/PortAdapters.`,
            "Move parser, decoder, tokenizer, raw extraction, and other translation-subsystem work to Infrastructure/Translation and keep the port adapter focused on the seam.",
          ),
          culprit.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructurePortAdaptersInlineNormalizationPreparationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.port_adapters.inline_normalization_preparation";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnosePortAdapterMethodPattern(
      file,
      InfrastructurePortAdaptersInlineNormalizationPreparationPolicy.ruleID,
      (method) =>
        isInlineNormalizationPreparationMethod(
          method,
          file,
          context,
          "portAdapter",
        ),
      "Infrastructure/PortAdapters should not keep normalization or preparation helpers inline once that work becomes a separate translation concern.",
      "Move normalization and preparation to Infrastructure/Translation, and keep the adapter focused on the seam and any final surface it legitimately owns.",
    );
  }
}

export class InfrastructurePortAdaptersInlineObviousBoundaryDecisionLogicPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.port_adapters.inline_obvious_boundary_decision_logic";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnosePortAdapterMethodPattern(
      file,
      InfrastructurePortAdaptersInlineObviousBoundaryDecisionLogicPolicy.ruleID,
      (method) =>
        isObviousTechnicalDecisionMethod(method, file, context) &&
        !hasPortAdapterLegitimateFinalRenderOutputPattern(method, file),
      "Infrastructure/PortAdapters should not keep pure typed technical decision logic inline.",
      "Move classifier, selector, or resolver logic to Infrastructure/Evaluators and keep only legitimate final adapter behavior in the port adapter.",
    );
  }
}

export class InfrastructurePortAdaptersInlineTypedBoundaryCompatibilityEvaluationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.port_adapters.inline_typed_boundary_compatibility_evaluation";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnosePortAdapterMethodPattern(
      file,
      InfrastructurePortAdaptersInlineTypedBoundaryCompatibilityEvaluationPolicy.ruleID,
      (method) =>
        isTypedBoundaryCompatibilityEvaluationMethod(method, file, context) &&
        !hasPortAdapterLegitimateFinalRenderOutputPattern(method, file),
      "Infrastructure/PortAdapters should not keep typed boundary compatibility evaluation inline.",
      "Move the pure compatibility decision to Infrastructure/Evaluators, keep adapter-local rejection or failure mapping in the port adapter, and move raw extraction to Infrastructure/Translation when present.",
    );
  }
}

export class InfrastructurePortAdaptersInlineTypedInteractionDispatchPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.port_adapters.inline_typed_interaction_dispatch";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return diagnosePortAdapterMethodPattern(
      file,
      InfrastructurePortAdaptersInlineTypedInteractionDispatchPolicy.ruleID,
      (method) =>
        isTypedInteractionDispatchMethod(method, file, context) &&
        !hasPortAdapterLegitimateFinalRenderOutputPattern(method, file),
      "Infrastructure/PortAdapters should not keep typed interaction dispatch helpers inline.",
      "Move typed path-selection logic to Infrastructure/Evaluators, keep passive shaping in Translation, and keep only legitimate final adapter behavior in the port adapter.",
    );
  }
}

export class InfrastructureEvaluatorsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.evaluators.shape";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureEvaluatorFile) {
      return [];
    }

    const diagnostics = file.topLevelDeclarations.flatMap((declaration) => {
      if (declaration.kind !== NominalKind.Protocol) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureEvaluatorsShapePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Evaluators should expose concrete evaluator types rather than protocols like '${declaration.name}'.`,
            "Keep concrete classifier, selector, or resolver logic in Infrastructure/Evaluators and move abstractions to the layer that owns the seam.",
          ),
          declaration.coordinate,
        ),
      ];
    });

    if (hasEvaluatorDecisionSurface(file, context)) {
      return diagnostics;
    }

    diagnostics.push(
      file.diagnostic(
        InfrastructureEvaluatorsShapePolicy.ruleID,
        infrastructureRemediationMessage(
          "Infrastructure/Evaluators does not currently expose a behavior-first evaluator surface.",
          "Keep decision-shaped technical logic in Infrastructure/Evaluators, move translation to Infrastructure/Translation, and move execution to the owning gateway, repository, or port adapter.",
        ),
      ),
    );

    return diagnostics;
  }
}

export class InfrastructureEvaluatorsNoExecutionOrchestrationSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.evaluators.no_execution_orchestration_surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureEvaluatorFile) {
      return [];
    }

    const concreteTypeNames = concreteTopLevelTypeNames(file);
    return file.methodDeclarations.flatMap((declaration) => {
      if (
        !concreteTypeNames.has(declaration.enclosingTypeName) ||
        !hasExecutionLikeOperations(
          operationalUsesForMethod(file, declaration.enclosingTypeName, declaration.name),
        )
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureEvaluatorsNoExecutionOrchestrationSurfacePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Evaluators should not keep execution or orchestration in '${declaration.enclosingTypeName}.${declaration.name}'.`,
            "Move live boundary execution back to the owning gateway, repository, or port adapter and keep evaluators focused on decision logic.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureEvaluatorsNoTranslationSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.evaluators.no_translation_surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureEvaluatorFile) {
      return [];
    }

    const concreteTypeNames = concreteTopLevelTypeNames(file);
    return file.methodDeclarations.flatMap((declaration) => {
      if (
        !concreteTypeNames.has(declaration.enclosingTypeName) ||
        !hasTranslationLikeSignature(declaration, file)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureEvaluatorsNoTranslationSurfacePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Evaluators should not keep parsing or translation work in '${declaration.enclosingTypeName}.${declaration.name}'.`,
            "Move raw parsing, extraction, normalization, and request or response shaping to Infrastructure/Translation and keep only the decision core in Infrastructure/Evaluators.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureRoleFolderStructurePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.role_folder_structure";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    const invalidRoleFolder = invalidInfrastructureRoleFolder(file);
    if (!invalidRoleFolder) {
      return [];
    }

    return [
      file.diagnostic(
        InfrastructureRoleFolderStructurePolicy.ruleID,
        infrastructureStructuredRemediationMessage({
          summary: `Infrastructure contains unsupported first-level role folder '${invalidRoleFolder}', but Infrastructure should only contain canonical adapter and support roles.`,
          categories: [
            "arbitrary technical bucket introduced instead of a canonical infrastructure role",
            "mixed directory containing files that should be split across gateways, port adapters, translation, evaluators, or errors",
            "implementation detail folder created around tooling or mechanics rather than architectural responsibility",
            "misnamed directory that duplicates an existing infrastructure role under different terminology",
          ],
          signs: [
            "file path includes Infrastructure/<UnknownDirectory>/...",
            "the first-level directory under Infrastructure is not one of Repositories, Gateways, PortAdapters, Evaluators, Translation, or Errors",
            "the file is classified as Infrastructure but not as a canonical infrastructure role folder",
          ],
          architecturalNote:
            "Infrastructure is organized around explicit role folders so runtime execution, seam adapters, translation, technical decision logic, and error definitions each remain visible to the architecture. Arbitrary first-level folders hide responsibility, mix unrelated work, and bypass the role-specific linter rules that are meant to govern the files after they are placed correctly.",
          destination:
            "split the contents of the unsupported folder into the canonical Infrastructure roles: Repositories for concrete data-access adapters, Gateways for live boundary execution, PortAdapters for seam-backed integration adapters, Evaluators for technical decision logic, Translation/Models for intermediary shaping, Translation/DTOs for final boundary-facing carriers or DTO-side translation, and Errors for concrete infrastructure error types.",
          decomposition:
            "inspect each file in the unsupported folder by responsibility rather than by its current name; move runtime boundary execution to Gateways or Repositories, move seam-backed adapter implementations to PortAdapters, move technical decision-only logic to Evaluators, move intermediary normalization or parsing shapes to Translation/Models, move final boundary-facing carriers or DTO-side translators to Translation/DTOs, and move structured infrastructure error types to Errors; then rename files and primary types so they match the conventions of the destination role and rerun the linter so the role-specific infrastructure rules can validate the result.",
        }),
      ),
    ];
  }
}

export class InfrastructureEmptyDirectoryPolicy
  implements ArchitectureProjectPolicyProtocol
{
  static readonly ruleID = "infrastructure.empty_directory";

  evaluateProject(
    input: ArchitectureProjectPolicyInput,
  ): readonly ArchitectureDiagnostic[] {
    return input.emptyDirectoryPaths
      .filter((directoryPath) =>
        isInfrastructureDirectoryPath(directoryPath, input.configuration),
      )
      .map((directoryPath) => ({
        ruleID: InfrastructureEmptyDirectoryPolicy.ruleID,
        path: directoryPath,
        line: 1,
        column: 1,
        message: infrastructureStructuredRemediationMessage({
          summary:
            "Empty directories should not be left behind under Infrastructure because they hide whether a role was actually removed, moved, or only partially decomposed.",
          categories: [
            "leftover unsupported role folder after files were redistributed into canonical infrastructure roles",
            "empty canonical role folder kept after its owned files were moved elsewhere",
            "temporary decomposition folder committed after a refactor finished",
            "placeholder infrastructure container kept without restoring the files or child roles it is supposed to own",
          ],
          signs: [
            "the directory exists under Infrastructure",
            "the directory has no visible child files or subdirectories",
            "the linter cannot assign any infrastructure ownership because no remaining contents exist inside the folder",
          ],
          architecturalNote:
            "Infrastructure folders are only meaningful when they visibly own adapter code, translation shapes, decision helpers, errors, or canonical child roles. An empty folder carries no architectural responsibility, so leaving it behind obscures whether the refactor is complete and whether the intended role still exists at all.",
          destination:
            "delete the empty Infrastructure directory if it no longer owns anything, or restore the correctly owned files and canonical child structure if the directory is still meant to exist as a real Infrastructure role or container.",
          decomposition:
            "first decide whether the empty folder still represents a real Infrastructure responsibility; if it does not, remove it entirely; if it does, restore the concrete files or canonical child folders it should own, then verify each restored file belongs in Repositories, Gateways, PortAdapters, Evaluators, Translation/Models, Translation/DTOs, or Errors and rerun the linter so the normal role-specific rules validate the rebuilt structure.",
        }),
      }));
  }
}

export class InfrastructureTranslationStructurePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.translation.structure";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isLooseInfrastructureTranslationFile(file)) {
      return [];
    }

    return [
      file.diagnostic(
        InfrastructureTranslationStructurePolicy.ruleID,
        infrastructureStructuredRemediationMessage({
          summary:
            "Infrastructure/Translation should act as a role container only, but this file lives outside the canonical Models or DTOs subdirectories.",
          categories: [
            "uncategorized translation helper placed at the translation root",
            "intermediary shaping model left outside Infrastructure/Translation/Models",
            "final boundary-facing DTO carrier or translator left outside Infrastructure/Translation/DTOs",
            "translation barrel or convenience export file placed where concrete translation roles are expected instead",
          ],
          signs: [
            "file path includes Infrastructure/Translation",
            "file path does not continue through Models or DTOs",
            "the file cannot be classified as either an infrastructure translation model or translation DTO role",
          ],
          architecturalNote:
            "Infrastructure/Translation is a role container, not a concrete role. Concrete translation work must be classified as either intermediary shaping in Infrastructure/Translation/Models or final boundary-facing carrier and DTO-side translation work in Infrastructure/Translation/DTOs. Leaving files loose under Infrastructure/Translation hides that ownership boundary and prevents role-specific translation rules from applying consistently across projects.",
          destination:
            "move the file into Infrastructure/Translation/Models or Infrastructure/Translation/DTOs, or move it out of Infrastructure/Translation if it is actually a gateway, evaluator, or port-adapter concern.",
          decomposition:
            "inspect whether the file performs intermediary normalization, parsing, or request-definition shaping versus final boundary-facing DTO or carrier shaping; relocate the file to Models for intermediary shaping, relocate it to DTOs for final boundary-facing translation, or move it to the infrastructure role that truly owns the behavior; then rerun the linter to confirm the file is classified under a canonical translation role.",
        }),
      ),
    ];
  }
}

export class InfrastructureTranslationShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.translation.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      if (declaration.kind === NominalKind.Protocol) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureTranslationShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Translation should contain concrete translation shapes, but '${declaration.name}' is a protocol.`,
              "Move protocol seams to the layer that owns them and keep concrete translation types in Infrastructure/Translation.",
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (
        INFRASTRUCTURE_TRANSLATION_FORBIDDEN_SUFFIXES.some((suffix) =>
          declaration.name.endsWith(suffix),
        )
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureTranslationShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Translation should hold translation shapes, but '${declaration.name}' is a non-translation role.`,
              "Move the non-translation role to its owning folder and leave only translation-owned types in Infrastructure/Translation.",
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    return diagnostics;
  }
}

export class InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.translation.models.intermediary_shaping_surface";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationModelFile) {
      return [];
    }

    if (
      hasInwardTranslationSurface(file, context) ||
      hasParserModelTranslationSurface(file, context) ||
      hasConfigurationNormalizationSurface(file, context) ||
      hasIntermediaryRequestDefinitionTranslationSurface(file, context)
    ) {
      return [];
    }

    return [
      file.diagnostic(
        InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy.ruleID,
        infrastructureRemediationMessage(
          "Infrastructure/Translation/Models does not currently expose an intermediary-shaping surface.",
          "Keep intermediary normalization, parser-model shaping, and request-definition shaping in Infrastructure/Translation/Models and move final boundary-facing carriers to Infrastructure/Translation/DTOs.",
        ),
      ),
    ];
  }
}

export class InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.translation.models.no_final_transport_provider_shape_surface";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationModelFile) {
      return [];
    }

    return finalTransportProviderShapeDiagnostics(file, context).map(
      (culprit) =>
        file.diagnostic(
          InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Translation/Models keeps final provider or transport boundary shaping in '${culprit.name}'.`,
            "Move passive final request and response carriers plus adjacent DTO-side translators to Infrastructure/Translation/DTOs while keeping intermediary shaping in Infrastructure/Translation/Models.",
          ),
          culprit.coordinate,
        ),
    );
  }
}

export class InfrastructureTranslationModelsSplitRequestShapingPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.translation.models.split_request_shaping";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationModelFile) {
      return [];
    }

    return [...concreteTopLevelTypeNames(file)].flatMap((typeName) => {
      const methods = methodsForType(file, typeName).filter(
        (method) => !method.isPrivateOrFileprivate,
      );

      if (
        !hasConfigurationNormalizationResponsibility(methods, file, context) ||
        !hasIntermediaryRequestDefinitionShapingResponsibility(
          methods,
          file,
          context,
        )
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureTranslationModelsSplitRequestShapingPolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Translation/Models combines configuration normalization and intermediary request-definition shaping inside '${typeName}'.`,
            "Split normalized configuration and request-definition shaping into dedicated translation model types and move any final boundary-facing carriers to Infrastructure/Translation/DTOs.",
          ),
          coordinateForType(file, typeName),
        ),
      ];
    });
  }
}

export class InfrastructureTranslationDTOsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.translation.dtos.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationDTOFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      if (declaration.kind === NominalKind.Protocol) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureTranslationDTOsShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Translation/DTOs should expose passive DTO-side carriers and adjacent translators, but '${declaration.name}' is a protocol.`,
              "Keep passive DTO carriers and concrete DTO-side shaping helpers in Infrastructure/Translation/DTOs and move abstractions or execution logic out.",
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (
        INFRASTRUCTURE_DTO_FORBIDDEN_SUFFIXES.some((suffix) =>
          declaration.name.endsWith(suffix),
        )
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureTranslationDTOsShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Translation/DTOs should not host non-DTO roles like '${declaration.name}'.`,
              "Keep only passive DTO carriers and adjacent DTO-side translators in Infrastructure/Translation/DTOs and move other roles to their owning folders.",
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    if (!hasConcreteTypeWithSuffix(file, "DTO")) {
      diagnostics.push(
        file.diagnostic(
          InfrastructureTranslationDTOsShapePolicy.ruleID,
          infrastructureRemediationMessage(
            "Infrastructure/Translation/DTOs does not expose a concrete DTO carrier.",
            `Add a concrete DTO type to ${file.repoRelativePath} or move the file to the translation role it actually implements.`,
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class InfrastructureTranslationDTOsPassiveCarrierPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.translation.dtos.passive_carrier_surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationDTOFile) {
      return [];
    }

    const dtoTypeNames = new Set(
      concreteTopLevelDeclarations(file)
        .filter((declaration) => declaration.name.endsWith("DTO"))
        .map((declaration) => declaration.name),
    );
    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.methodDeclarations) {
      if (
        dtoTypeNames.has(declaration.enclosingTypeName) &&
        !declaration.isPrivateOrFileprivate
      ) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureTranslationDTOsPassiveCarrierPolicy.ruleID,
            infrastructureRemediationMessage(
              `DTO type '${declaration.enclosingTypeName}' should stay passive, but it owns behavior through '${declaration.name}'.`,
              "Keep the DTO carrier passive and move shaping helpers to adjacent DTO-side translators or builders.",
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    for (const declaration of file.computedPropertyDeclarations) {
      if (!dtoTypeNames.has(declaration.enclosingTypeName)) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          InfrastructureTranslationDTOsPassiveCarrierPolicy.ruleID,
          infrastructureRemediationMessage(
            `DTO type '${declaration.enclosingTypeName}' should stay passive, but it owns behavior through computed property '${declaration.name}'.`,
            "Keep passive fields on the DTO itself and move shaping logic to an adjacent DTO-side translator or builder.",
          ),
          declaration.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.translation.dtos.no_intermediary_or_normalization_surface";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationDTOFile) {
      return [];
    }

    const concreteTypeNames = concreteTopLevelTypeNames(file);
    return file.methodDeclarations.flatMap((declaration) => {
      if (
        !concreteTypeNames.has(declaration.enclosingTypeName) ||
        declaration.isPrivateOrFileprivate ||
        !hasDTOIntermediaryOrNormalizationViolation(declaration, file, context)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Translation/DTOs should not keep intermediary or normalization shaping in '${declaration.enclosingTypeName}.${declaration.name}'.`,
            "Keep DTOs passive and final-boundary-facing, and move normalized config or intermediary request-definition shaping to Infrastructure/Translation/Models.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.translation.dtos.no_execution_orchestration_surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationDTOFile) {
      return [];
    }

    const concreteTypeNames = concreteTopLevelTypeNames(file);
    return file.methodDeclarations.flatMap((declaration) => {
      if (
        !concreteTypeNames.has(declaration.enclosingTypeName) ||
        declaration.isPrivateOrFileprivate ||
        !hasDTOExecutionOrchestrationViolation(declaration, file)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Translation/DTOs should not keep execution or orchestration in '${declaration.enclosingTypeName}.${declaration.name}'.`,
            "Move execution and orchestration to Infrastructure/Gateways and keep DTO files limited to passive carriers plus shaping-only helpers.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureGatewaysRejectPrivateInwardTranslationHelpersPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.private_inward_translation_helpers";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureGatewayFile) {
      return [];
    }

    return file.methodDeclarations.flatMap((declaration) => {
      if (
        declaration.isPublicOrOpen ||
        !returnsInwardNormalizedType(declaration, context) ||
        !declaration.parameterTypeNames.some((typeName) =>
          isInwardTranslationSourceTypeName(
            typeName,
            file,
            declaration.enclosingTypeName,
            context,
          ),
        )
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureGatewaysRejectPrivateInwardTranslationHelpersPolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Gateways should orchestrate translation, not hide inward translation helper '${declaration.enclosingTypeName}.${declaration.name}'.`,
            "Move the boundary-crossing translation to Infrastructure/Translation/Models and expose it through an explicit directional method such as toDomain, toContract, or toInfrastructureError.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureApplicationContractBehaviorAttachmentPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.application_contract_behavior_attachment";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructure) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.constructorDeclarations) {
      const contract = infrastructureAttachedApplicationContractDeclaration(
        declaration.enclosingTypeName,
        context,
      );
      if (!contract) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          InfrastructureApplicationContractBehaviorAttachmentPolicy.ruleID,
          infrastructureRemediationMessage(
            `Constructor '${declaration.enclosingTypeName}(...)' attaches Infrastructure-owned behavior to Application contract '${contract.name}'.`,
            "Keep contract-owned meaning with the Application contract, move adapter-local shaping to Infrastructure/Translation, and keep execution in Infrastructure/Gateways or Infrastructure/PortAdapters.",
          ),
          declaration.coordinate,
        ),
      );
    }

    for (const declaration of file.methodDeclarations) {
      const contract = infrastructureAttachedApplicationContractDeclaration(
        declaration.enclosingTypeName,
        context,
      );
      if (!contract) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          InfrastructureApplicationContractBehaviorAttachmentPolicy.ruleID,
          infrastructureRemediationMessage(
            `Method '${declaration.name}' attaches Infrastructure-owned behavior to Application contract '${contract.name}'.`,
            "Keep contract-owned meaning with the Application contract, move adapter-local shaping to Infrastructure/Translation, and keep seam-backed application behavior in the Application layer.",
          ),
          declaration.coordinate,
        ),
      );
    }

    for (const declaration of file.computedPropertyDeclarations) {
      const contract = infrastructureAttachedApplicationContractDeclaration(
        declaration.enclosingTypeName,
        context,
      );
      if (!contract) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          InfrastructureApplicationContractBehaviorAttachmentPolicy.ruleID,
          infrastructureRemediationMessage(
            `Computed property '${declaration.name}' attaches Infrastructure-owned behavior to Application contract '${contract.name}'.`,
            "Keep contract-owned meaning with the Application contract, move adapter-local shaping to Infrastructure/Translation, and keep execution in Infrastructure/Gateways or Infrastructure/PortAdapters.",
          ),
          declaration.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class InfrastructureGatewaysNestedIntermediaryTranslationShapesPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.nested_intermediary_translation_shapes";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureGatewayFile) {
      return [];
    }

    const clusterShapeKeys = nestedGatewayNormalizationClusterShapeKeys(
      file,
      context,
    );

    return file.nestedNominalDeclarations.flatMap((declaration) => {
      if (!clusterShapeKeys.has(shapeKeyForNestedDeclaration(declaration))) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureGatewaysNestedIntermediaryTranslationShapesPolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Gateways should not declare nested intermediary translation shape '${declaration.enclosingTypeName}.${declaration.name}'.`,
            `Move '${declaration.name}' to Infrastructure/Translation/Models and let the gateway consume it through an explicit translation surface.`,
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureGatewaysNoNestedBoundaryShapingHelpersPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.no_nested_boundary_shaping_helpers";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureGatewayFile) {
      return [];
    }

    return file.nestedNominalDeclarations.flatMap((declaration) => {
      const classification = classifyNestedBoundaryShapingHelper(
        declaration,
        file,
        context,
      );
      if (!classification) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureGatewaysNoNestedBoundaryShapingHelpersPolicy.ruleID,
          infrastructureRemediationMessage(
            nestedBoundaryShapingHelperSummary(declaration, classification),
            nestedBoundaryShapingHelperDestination(classification),
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureGatewaysInlineRequestDefinitionShapingPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.gateways.inline_request_definition_shaping";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureGatewayFile) {
      return [];
    }

    return concreteTopLevelDeclarations(file).flatMap((declaration) => {
      if (!declaration.name.endsWith("Gateway")) {
        return [];
      }

      const methods = methodsForType(file, declaration.name);
      if (
        !gatewayUsesExtractedRequestShapingModel(
          file,
          declaration.name,
          methods,
          context,
        ) ||
        !hasInlineGatewayRequestShapingEvidence(file, methods, context) ||
        !hasGatewayExecutionFlowEvidence(file, declaration.name, methods)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureGatewaysInlineRequestDefinitionShapingPolicy.ruleID,
          infrastructureRemediationMessage(
            `'${declaration.name}' still rebuilds request-definition ingredients inline even though extracted translation shapes already exist.`,
            "Keep intermediary request-definition shaping in Infrastructure/Translation/Models, keep final provider or transport carriers in Infrastructure/Translation/DTOs, and keep execution in Infrastructure/Gateways.",
          ),
          firstMatchingMethodCoordinate(methods, (method) =>
            isBoundaryDefinitionShapingMethod(method, file, context),
          ) ?? declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureTranslationDirectionalNamingPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.translation.directional_naming";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureTranslationFile) {
      return [];
    }

    return file.methodDeclarations.flatMap((declaration) => {
      if (
        !isBoundaryCrossingTranslationMethod(declaration, file, context) ||
        ALLOWED_DIRECTIONAL_TRANSLATION_METHOD_NAMES.has(declaration.name)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureTranslationDirectionalNamingPolicy.ruleID,
          infrastructureRemediationMessage(
            `Boundary-crossing translation method '${declaration.name}' must use one of the exact directional names: toDomain, fromDomain, toContract, fromContract, toInfrastructureError, or fromInfrastructureError.`,
            `Rename '${declaration.name}' to the correct directional form in ${file.repoRelativePath}.`,
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureErrorsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.errors.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureErrorFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const concreteDeclarations = concreteTopLevelDeclarations(file);
    const fileBaseName = structuredErrorFileBaseName(file.repoRelativePath);

    if (concreteDeclarations.length > 1) {
      diagnostics.push(
        file.diagnostic(
          InfrastructureErrorsShapePolicy.ruleID,
          infrastructureRemediationMessage(
            "Infrastructure/Errors files should contain one structured error type per file.",
            `Split the extra concrete declarations in ${file.repoRelativePath} into dedicated Infrastructure/Errors files.`,
          ),
        ),
      );
    }

    for (const declaration of file.topLevelDeclarations) {
      if (declaration.kind !== NominalKind.Protocol) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          InfrastructureErrorsShapePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure/Errors should expose concrete structured error types, but '${declaration.name}' is a protocol.`,
            "Replace the protocol with a concrete structured error type or move the abstraction to the seam that owns it.",
          ),
          declaration.coordinate,
        ),
      );
    }

    const structuredErrorDeclarations = concreteDeclarations.filter((declaration) =>
      isStructuredInfrastructureErrorDeclaration(declaration),
    );

    if (structuredErrorDeclarations.length === 0) {
      diagnostics.push(
        file.diagnostic(
          InfrastructureErrorsShapePolicy.ruleID,
          infrastructureRemediationMessage(
            "Infrastructure/Errors files should expose a concrete structured error type with explicit infrastructure error naming.",
            "Add a concrete infrastructure error type with code, message, retryable, and details to this file.",
          ),
        ),
      );
      return diagnostics;
    }

    if (!structuredErrorDeclarations.some((declaration) => declaration.name === fileBaseName)) {
      diagnostics.push(
        file.diagnostic(
          InfrastructureErrorsShapePolicy.ruleID,
          infrastructureRemediationMessage(
            "Infrastructure/Errors files should be named after the structured error type they contain.",
            `Rename ${file.repoRelativePath} to match the structured error type declared inside it.`,
          ),
        ),
      );
    }

    for (const declaration of concreteDeclarations) {
      const matchesNaming =
        declaration.name.endsWith("InfrastructureError") ||
        declaration.name.endsWith("GatewayError") ||
        declaration.name.endsWith("Error");
      const isStructured = isStructuredInfrastructureErrorDeclaration(declaration);

      if (!matchesNaming && !isStructured) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureErrorsShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `Infrastructure/Errors should expose explicit infrastructure error types, but '${declaration.name}' does not look like one.`,
              `Rename '${declaration.name}' to an explicit infrastructure error type or move it to the folder that matches its real responsibility.`,
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (!declaration.inheritedTypeNames.includes("StructuredErrorProtocol")) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureErrorsShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `${declaration.name} must conform to StructuredErrorProtocol.`,
              `Add StructuredErrorProtocol conformance to '${declaration.name}'.`,
            ),
            declaration.coordinate,
          ),
        );
      }

      const missingMembers = [...STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES].filter(
        (memberName) => !declaration.memberNames.includes(memberName),
      );
      if (missingMembers.length > 0) {
        diagnostics.push(
          file.diagnostic(
            InfrastructureErrorsShapePolicy.ruleID,
            infrastructureRemediationMessage(
              `${declaration.name} should expose structured error members code, message, retryable, and details.`,
              `Add the missing members to '${declaration.name}': ${missingMembers.join(", ")}.`,
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    return diagnostics;
  }
}

export class InfrastructureErrorsPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.errors.placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      !file.classification.isInfrastructure ||
      file.classification.isInfrastructureErrorFile
    ) {
      return [];
    }

    return concreteTopLevelDeclarations(file).flatMap((declaration) => {
      if (!isStructuredInfrastructureErrorDeclaration(declaration)) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureErrorsPlacementPolicy.ruleID,
          infrastructureRemediationMessage(
            `Structured error type '${declaration.name}' must live in Infrastructure/Errors, not in ${file.repoRelativePath}.`,
            `Move '${declaration.name}' to Infrastructure/Errors and place it in a dedicated file named after the error type.`,
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class InfrastructureForbiddenPresentationDependencyPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.forbidden_presentation_dependency";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructure) {
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
        (candidate) => candidate.layer === ArchitectureLayer.Presentation,
      );
      if (!declaration || declaration.layer !== ArchitectureLayer.Presentation) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          InfrastructureForbiddenPresentationDependencyPolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure must not depend on Presentation type '${reference.name}'.`,
            "Replace the Presentation dependency with an inward contract or an Infrastructure-owned type.",
          ),
          reference.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class InfrastructureUseCaseOrServiceReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.usecase_or_service_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructure) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const occurrence of file.constructionOccurrences) {
      const typeName = canonicalReferenceTypeName(occurrence.typeName);
      const declaration = firstDeclarationWithRole(context, typeName, [
        RoleFolder.ApplicationUseCases,
        RoleFolder.ApplicationServices,
      ]);
      if (!declaration) {
        continue;
      }

      diagnostics.push(
        infrastructureOrchestrationDiagnostic({
          file,
          typeName,
          declaration,
          coordinate: occurrence.coordinate,
        }),
      );
    }

    const localNames = new Set(
      file.topLevelDeclarations.map((declaration) => declaration.name),
    );
    const seenTypeReferenceNames = new Set<string>();

    for (const reference of file.typeReferences) {
      const typeName = canonicalReferenceTypeName(reference.name);
      if (localNames.has(typeName) || seenTypeReferenceNames.has(typeName)) {
        continue;
      }
      seenTypeReferenceNames.add(typeName);

      const declaration = firstDeclarationWithRole(context, typeName, [
        RoleFolder.ApplicationUseCases,
      ]);
      if (!declaration) {
        continue;
      }

      diagnostics.push(
        infrastructureOrchestrationDiagnostic({
          file,
          typeName,
          declaration,
          coordinate: reference.coordinate,
        }),
      );
    }

    return diagnostics;
  }
}

export class InfrastructureAdapterOnAdapterCompositionPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "infrastructure.adapter_on_adapter_composition";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureAdapterRole) {
      return [];
    }

    const localNames = new Set([
      ...file.topLevelDeclarations.map((declaration) => declaration.name),
      ...file.nestedNominalDeclarations.map((declaration) => declaration.name),
    ]);
    const occurrencesByName = new Map<
      string,
      { readonly name: string; readonly coordinate: SourceCoordinate }[]
    >();

    for (const occurrence of iterateReferenceOccurrences(file)) {
      if (localNames.has(occurrence.name)) {
        continue;
      }

      occurrencesByName.set(occurrence.name, [
        ...(occurrencesByName.get(occurrence.name) ?? []),
        occurrence,
      ]);
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    for (const [name, occurrences] of occurrencesByName) {
      const declaration = context.declarations.find((candidate) => {
        if (candidate.name !== name) {
          return false;
        }

        if (candidate.roleFolder === RoleFolder.ApplicationStateTransitions) {
          return true;
        }

        return (
          isInfrastructureAdapterRole(candidate.roleFolder) &&
          isConcreteNominalKind(candidate.kind) &&
          candidate.repoRelativePath !== file.repoRelativePath
        );
      });

      if (!declaration) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          InfrastructureAdapterOnAdapterCompositionPolicy.ruleID,
          richRemediationMessage({
            summary: `Infrastructure adapter file '${file.repoRelativePath}' depends on concrete sibling Infrastructure adapter or Application StateTransition '${name}' declared in ${declaration.repoRelativePath}.`,
            categories: [
              "adapter-on-adapter composition bypassing the composition root",
              "injected port downcast to a concrete sibling implementation",
              "cross-adapter static registry coupling",
              "multi-store workflow orchestration hidden inside one adapter",
            ],
            signs: [
              "construction, stored property, cast, or static member access names a concrete Repository/PortAdapter/Gateway from another Infrastructure file",
              "the dependency is not expressed through an Application/Ports/Protocols or Domain/Protocols seam",
              "substituting either adapter in tests or wiring is impossible",
            ],
            architecturalNote:
              "Adapters implement one boundary each and depend only on inward contracts. When an adapter holds a concrete sibling, the pair becomes one unsubstitutable unit, the composition root loses authority over wiring, and behavior reached through the sibling silently diverges for any other conforming implementation.",
            destination:
              "Application/Ports/Protocols for a narrow seam covering exactly the operations the depending adapter needs; App/DependencyInjection for constructing both adapters and injecting the seam; an Application UseCase/Service if the coupling exists to sequence work across multiple stores.",
            decomposition: `Define or extend an inward port protocol for the operations '${name}' provides, inject that seam through the depending adapter's initializer, wire the concrete adapters in App/DependencyInjection, and lift multi-store sequencing into an Application use case before deleting the concrete reference.`,
          }),
          earliestCoordinate(occurrences),
        ),
      );
    }

    return diagnostics;
  }
}

export class InfrastructureCrossLayerProtocolConformancePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID =
    "infrastructure.cross_layer_protocol_conformance";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isInfrastructureAdapterRole) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        !isAdapterCandidate(declaration) ||
        conformsToInwardProtocol(declaration, context)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          InfrastructureCrossLayerProtocolConformancePolicy.ruleID,
          infrastructureRemediationMessage(
            `Infrastructure adapter '${declaration.name}' should conform to an inward protocol.`,
            `Conform '${declaration.name}' to a protocol from Application/Ports/Protocols or Domain/Protocols so the composition root can inject it through a stable seam.`,
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export function makeInfrastructureArchitecturePolicies(
  configuration: ArchitectureLinterConfiguration =
    DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
): readonly ArchitecturePolicyProtocol[] {
  return [
    new InfrastructureRepositoriesShapePolicy(),
    new InfrastructureRepositoriesRoleFitPolicy(),
    new InfrastructureRepositoriesInlineBusinessLiteralsPolicy(configuration),
    new InfrastructureGatewaysShapePolicy(),
    new InfrastructureGatewaysRoleFitPolicy(),
    new InfrastructurePortAdaptersShapePolicy(),
    new InfrastructurePortAdaptersInlineTranslationSubsystemPolicy(),
    new InfrastructurePortAdaptersInlineNormalizationPreparationPolicy(),
    new InfrastructurePortAdaptersInlineObviousBoundaryDecisionLogicPolicy(),
    new InfrastructurePortAdaptersInlineTypedBoundaryCompatibilityEvaluationPolicy(),
    new InfrastructurePortAdaptersInlineTypedInteractionDispatchPolicy(),
    new InfrastructureEvaluatorsShapePolicy(),
    new InfrastructureEvaluatorsNoExecutionOrchestrationSurfacePolicy(),
    new InfrastructureEvaluatorsNoTranslationSurfacePolicy(),
    new InfrastructureRoleFolderStructurePolicy(),
    new InfrastructureTranslationStructurePolicy(),
    new InfrastructureTranslationShapePolicy(),
    new InfrastructureTranslationModelsIntermediaryShapingSurfacePolicy(),
    new InfrastructureTranslationModelsNoFinalTransportProviderShapeSurfacePolicy(),
    new InfrastructureTranslationModelsSplitRequestShapingPolicy(),
    new InfrastructureTranslationDTOsShapePolicy(),
    new InfrastructureTranslationDTOsPassiveCarrierPolicy(),
    new InfrastructureTranslationDTOsNoIntermediaryOrNormalizationSurfacePolicy(),
    new InfrastructureTranslationDTOsNoExecutionOrchestrationSurfacePolicy(),
    new InfrastructureApplicationContractBehaviorAttachmentPolicy(),
    new InfrastructureGatewaysInlineBoundaryConfigurationShapingPolicy(),
    new InfrastructureGatewaysInlineBoundaryDefinitionShapingPolicy(),
    new InfrastructureGatewaysInlineOutboundRequestTranslationPolicy(),
    new InfrastructureGatewaysInlineNormalizationPreparationPolicy(),
    new InfrastructureGatewaysInlineObviousBoundaryDecisionLogicPolicy(),
    new InfrastructureGatewaysInlineTypedBoundaryCompatibilityEvaluationPolicy(),
    new InfrastructureGatewaysInlineTypedInteractionDispatchPolicy(),
    new InfrastructureGatewaysRejectPrivateInwardTranslationHelpersPolicy(),
    new InfrastructureGatewaysNestedIntermediaryTranslationShapesPolicy(),
    new InfrastructureGatewaysNoNestedBoundaryShapingHelpersPolicy(),
    new InfrastructureGatewaysInlineRequestDefinitionShapingPolicy(),
    new InfrastructureTranslationDirectionalNamingPolicy(),
    new InfrastructureErrorsShapePolicy(),
    new InfrastructureErrorsPlacementPolicy(),
    new InfrastructureForbiddenPresentationDependencyPolicy(),
    new InfrastructureUseCaseOrServiceReferencePolicy(),
    new InfrastructureAdapterOnAdapterCompositionPolicy(),
    new InfrastructureCrossLayerProtocolConformancePolicy(),
  ];
}

const INFRASTRUCTURE_BUSINESS_CATALOG_KEY_PATTERN =
  /^[a-z0-9_-]+(\.[a-z0-9_-]+){2,}$/;

function diagnoseGatewayMethodPattern(
  file: ArchitectureFile,
  ruleID: string,
  predicate: (method: ArchitectureMethodDeclaration) => boolean,
  summary: string,
  destination: string,
  requireExecutionFlow = false,
): readonly ArchitectureDiagnostic[] {
  if (!file.classification.isInfrastructureGatewayFile) {
    return [];
  }

  return concreteTopLevelDeclarations(file).flatMap((declaration) => {
    if (!declaration.name.endsWith("Gateway")) {
      return [];
    }

    const methods = methodsForType(file, declaration.name);
    if (
      requireExecutionFlow &&
      !hasGatewayExecutionFlowEvidence(file, declaration.name, methods)
    ) {
      return [];
    }

    const culprit = methods.find(predicate);
    if (!culprit) {
      return [];
    }

    return [file.diagnostic(ruleID, infrastructureRemediationMessage(summary, destination), culprit.coordinate)];
  });
}

function diagnosePortAdapterMethodPattern(
  file: ArchitectureFile,
  ruleID: string,
  predicate: (method: ArchitectureMethodDeclaration) => boolean,
  summary: string,
  destination: string,
): readonly ArchitectureDiagnostic[] {
  if (!file.classification.isInfrastructurePortAdapterFile) {
    return [];
  }

  return concreteTopLevelDeclarations(file).flatMap((declaration) => {
    if (!declaration.name.endsWith("PortAdapter")) {
      return [];
    }

    const culprit = methodsForType(file, declaration.name).find(predicate);
    if (!culprit) {
      return [];
    }

    return [file.diagnostic(ruleID, infrastructureRemediationMessage(summary, destination), culprit.coordinate)];
  });
}

/**
 * Lift the historic terse `infrastructureRemediationMessage(summary, destination)`
 * helper into the Swift-parity rich format (5 canonical markers). New
 * Stage 6 Infrastructure policies populate the markers directly through
 * `richRemediationMessage`; legacy call sites in this file delegate through
 * this helper. Sites that want hand-tailored markers use
 * `infrastructureStructuredRemediationMessage` directly.
 *
 * Acceptance criterion: PARITY.md §6.2.
 */
function infrastructureRemediationMessage(
  summary: string,
  destination: string,
): string {
  return richRemediationMessage({
    summary,
    categories: [
      "Infrastructure-layer boundary, role, or surface violation",
    ],
    signs: [
      "the file is classified under Infrastructure but does not satisfy the rule's expected shape, placement, or surface",
    ],
    architecturalNote:
      "Infrastructure hosts concrete boundary execution (Repositories, Gateways, PortAdapters, Evaluators), intermediary shaping (Translation/Models, Translation/DTOs), and structured errors. Role folders keep responsibility legible to consumers and to the linter.",
    destination,
    decomposition: `Follow the destination guidance: ${destination}`,
  });
}

function firstDeclarationWithRole(
  context: ProjectContext,
  typeName: string,
  roleFolders: readonly RoleFolder[],
): IndexedDeclaration | undefined {
  return context.declarations.find(
    (declaration) =>
      declaration.name === typeName && roleFolders.includes(declaration.roleFolder),
  );
}

function isInfrastructureAdapterRole(roleFolder: RoleFolder): boolean {
  return (
    roleFolder === RoleFolder.InfrastructureRepositories ||
    roleFolder === RoleFolder.InfrastructureGateways ||
    roleFolder === RoleFolder.InfrastructurePortAdapters
  );
}

function isConcreteNominalKind(kind: NominalKind): boolean {
  return (
    kind === NominalKind.Class ||
    kind === NominalKind.Struct ||
    kind === NominalKind.Actor
  );
}

function earliestCoordinate(
  occurrences: readonly { readonly coordinate: SourceCoordinate }[],
): SourceCoordinate {
  return (
    occurrences.map((occurrence) => occurrence.coordinate).sort(compareCoordinates)[0] ??
    { line: 1, column: 1 }
  );
}

function compareCoordinates(
  left: SourceCoordinate,
  right: SourceCoordinate,
): number {
  if (left.line !== right.line) {
    return left.line - right.line;
  }

  return left.column - right.column;
}

function infrastructureOrchestrationDiagnostic(input: {
  readonly file: ArchitectureFile;
  readonly typeName: string;
  readonly declaration: IndexedDeclaration;
  readonly coordinate: SourceCoordinate;
}): ArchitectureDiagnostic {
  return input.file.diagnostic(
    InfrastructureUseCaseOrServiceReferencePolicy.ruleID,
    richRemediationMessage({
      summary: `Infrastructure file '${input.file.repoRelativePath}' references Application orchestration type '${input.typeName}' from ${input.declaration.repoRelativePath}.`,
      categories: [
        "Application UseCase or Service referenced from Infrastructure",
        "UseCase or Service construction embedded in an adapter",
        "workflow orchestration leaking into concrete boundary code",
      ],
      signs: [
        "Infrastructure file constructs a type declared under Application/UseCases or Application/Services",
        "Infrastructure type reference resolves to an Application/UseCases declaration",
        `the matched orchestration declaration is '${input.typeName}'`,
      ],
      architecturalNote:
        "Infrastructure implements outward details behind inward seams. UseCases and Services orchestrate application workflows and are wired by the App composition root, so Infrastructure must not reach back into them.",
      destination:
        "App/DependencyInjection for construction and wiring; Application/Services or Application/UseCases for orchestration logic; Infrastructure keeps only concrete boundary work behind inward port protocols.",
      decomposition: `Move '${input.typeName}' construction or dependency ownership out of ${input.file.repoRelativePath}. If Infrastructure needs to notify or fetch something, depend on an inward Application/Ports/Protocols or Domain/Protocols interface and wire the concrete collaborator in App/DependencyInjection. If the code is actually orchestrating workflow steps, move that behavior into Application/Services or Application/UseCases and keep Infrastructure focused on the boundary operation.`,
    }),
    input.coordinate,
  );
}

function isRepositoryBoundaryLeakRoleFolder(roleFolder: RoleFolder): boolean {
  return (
    roleFolder === RoleFolder.InfrastructureTranslationDTOs ||
    roleFolder === RoleFolder.InfrastructureTranslationModels ||
    roleFolder === RoleFolder.PresentationDTOs
  );
}

function hasRepositoryInwardProtocolConformance(
  declaration: {
    readonly inheritedTypeNames: readonly string[];
  },
  context: ProjectContext,
): boolean {
  return declaration.inheritedTypeNames.some((inheritedTypeName) =>
    context.declarations.some(
      (inheritedDeclaration) =>
        inheritedDeclaration.name === inheritedTypeName &&
        inheritedDeclaration.kind === NominalKind.Protocol &&
        (inheritedDeclaration.roleFolder === RoleFolder.ApplicationPortsProtocols ||
          inheritedDeclaration.roleFolder === RoleFolder.DomainProtocols),
    ),
  );
}

function hasRepositoryDataAccessEvidence(
  file: ArchitectureFile,
  repositoryTypeName: string,
  methods: readonly {
    readonly name: string;
    readonly isPrivateOrFileprivate: boolean;
    readonly parameterTypeNames: readonly string[];
    readonly returnTypeNames: readonly string[];
  }[],
  context: ProjectContext,
): boolean {
  const nonPrivateMethods = methods.filter(
    (method) => !method.isPrivateOrFileprivate,
  );

  if (nonPrivateMethods.some((method) => isRepositoryDataAccessVerb(method.name))) {
    return true;
  }

  if (methodReferencesRepositoryDataSource(file, repositoryTypeName, nonPrivateMethods)) {
    return true;
  }

  if (hasRepositoryDataSourceDependency(file, repositoryTypeName)) {
    return nonPrivateMethods.some(
      (method) =>
        methodHasDomainOrApplicationBoundary(method, context) &&
        !isTranslationOnlyVerb(method.name) &&
        !isGatewayExecutionVerb(method.name) &&
        !isEvaluatorVerb(method.name) &&
        !isRepositoryReportingOrCalculationOnlyVerb(method.name),
    );
  }

  return false;
}

function hasRepositoryMisclassificationEvidence(
  file: ArchitectureFile,
  declaration: {
    readonly name: string;
  },
  methods: readonly {
    readonly name: string;
    readonly isPrivateOrFileprivate: boolean;
    readonly parameterTypeNames: readonly string[];
    readonly returnTypeNames: readonly string[];
  }[],
  context: ProjectContext,
): boolean {
  if (
    file.topLevelDeclarations.some(
      (topLevelDeclaration) =>
        topLevelDeclaration.name !== declaration.name &&
        topLevelDeclaration.kind !== NominalKind.Protocol &&
        topLevelDeclaration.kind !== NominalKind.Enum &&
        isRepositorySupportTypeName(topLevelDeclaration.name),
    )
  ) {
    return true;
  }

  if (hasRepositoryPublicSurfaceLeak(file, declaration.name, context)) {
    return true;
  }

  return methods.some((method) => {
    if (method.isPrivateOrFileprivate) {
      return false;
    }

    return (
      isTranslationOnlyVerb(method.name) ||
      isGatewayExecutionVerb(method.name) ||
      isEvaluatorVerb(method.name) ||
      isRepositoryReportingOrCalculationOnlyVerb(method.name) ||
      method.parameterTypeNames.some((typeName) =>
        isRepositoryMisclassificationTypeName(typeName, file, context),
      ) ||
      method.returnTypeNames.some((typeName) =>
        isRepositoryMisclassificationTypeName(typeName, file, context),
      )
    );
  });
}

function hasRepositoryPublicSurfaceLeak(
  file: ArchitectureFile,
  repositoryTypeName: string,
  context: ProjectContext,
): boolean {
  return file.methodDeclarations.some((method) => {
    if (
      method.enclosingTypeName !== repositoryTypeName ||
      !method.isPublicOrOpen
    ) {
      return false;
    }

    return [...method.parameterTypeNames, ...method.returnTypeNames].some(
      (typeName) => isRepositoryMisclassificationTypeName(typeName, file, context),
    );
  });
}

function isRepositoryDataAccessVerb(name: string): boolean {
  return startsWithAnyLowercased(name, [
    "fetch",
    "find",
    "get",
    "list",
    "load",
    "query",
    "search",
    "save",
    "insert",
    "update",
    "upsert",
    "delete",
    "remove",
    "count",
    "exists",
    "record",
    "persist",
    "sync",
    "cache",
  ]);
}

function isTranslationOnlyVerb(name: string): boolean {
  return startsWithAnyLowercased(name, [
    "map",
    "translate",
    "build",
    "parse",
    "normalize",
    "convert",
    "makedto",
    "todto",
    "fromdto",
    "shape",
  ]);
}

function isGatewayExecutionVerb(name: string): boolean {
  return startsWithAnyLowercased(name, [
    "send",
    "post",
    "put",
    "patch",
    "request",
    "executerequest",
    "stream",
    "subscribe",
    "connect",
    "upload",
    "download",
    "dispatchremote",
  ]);
}

function isEvaluatorVerb(name: string): boolean {
  return startsWithAnyLowercased(name, [
    "evaluate",
    "classify",
    "select",
    "resolvecompatibility",
    "decide",
    "allow",
    "reject",
  ]);
}

function isRepositoryDataSourceDependencyName(name: string): boolean {
  const lowercasedName = name.toLowerCase();
  if (lowercasedName === "db") {
    return true;
  }

  return [
    "database",
    "store",
    "storage",
    "client",
    "supabase",
    "convex",
    "api",
    "persistence",
    "cache",
    "session",
    "connection",
    "collection",
    "table",
    "modelcontext",
  ].some((keyword) => lowercasedName.includes(keyword));
}

function isRepositorySupportTypeName(name: string): boolean {
  const lowercasedName = name.toLowerCase();
  return [
    "dto",
    "response",
    "request",
    "model",
    "mapper",
    "builder",
    "parser",
    "payload",
    "record",
    "row",
    "document",
    "snapshot",
    "projection",
    "helper",
    "evaluator",
    "gateway",
    "adapter",
  ].some((keyword) => lowercasedName.includes(keyword));
}

function isRepositoryReportingOrCalculationOnlyVerb(name: string): boolean {
  return startsWithAnyLowercased(name, ["format", "report", "calculate"]);
}

function hasRepositoryDataSourceDependency(
  file: ArchitectureFile,
  repositoryTypeName: string,
): boolean {
  return file.storedMemberDeclarations.some(
    (declaration) =>
      declaration.enclosingTypeName === repositoryTypeName &&
      (isRepositoryDataSourceDependencyName(declaration.name) ||
        declaration.typeNames.some(isRepositoryDataSourceDependencyName)),
  );
}

function methodReferencesRepositoryDataSource(
  file: ArchitectureFile,
  repositoryTypeName: string,
  methods: readonly { readonly name: string }[],
): boolean {
  const dataSourceMemberNames = new Set(
    file.storedMemberDeclarations
      .filter(
        (declaration) =>
          declaration.enclosingTypeName === repositoryTypeName &&
          (isRepositoryDataSourceDependencyName(declaration.name) ||
            declaration.typeNames.some(isRepositoryDataSourceDependencyName)),
      )
      .map((declaration) => declaration.name),
  );
  if (dataSourceMemberNames.size === 0) {
    return false;
  }

  const methodNames = new Set(methods.map((method) => method.name));
  return file.operationalUseOccurrences.some(
    (occurrence) =>
      occurrence.enclosingTypeName === repositoryTypeName &&
      methodNames.has(occurrence.enclosingMethodName) &&
      dataSourceMemberNames.has(occurrence.baseName) &&
      isRepositoryDataAccessVerb(occurrence.memberName),
  );
}

function methodHasDomainOrApplicationBoundary(
  method: {
    readonly parameterTypeNames: readonly string[];
    readonly returnTypeNames: readonly string[];
  },
  context: ProjectContext,
): boolean {
  return [...method.parameterTypeNames, ...method.returnTypeNames].some(
    (typeName) =>
      context.resolvedDeclarations(typeName).some(
        (declaration) =>
          declaration.layer === ArchitectureLayer.Domain ||
          declaration.layer === ArchitectureLayer.Application,
      ),
  );
}

function isRepositoryMisclassificationTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return (
    context.resolvedDeclarations(typeName).some((declaration) =>
      isRepositoryBoundaryLeakRoleFolder(declaration.roleFolder),
    ) ||
    isLocalRepositorySupportType(typeName, file)
  );
}

function repositoryLeakSourceDescription(
  declaration: ReturnType<typeof repositoryBoundaryLeakDeclaration>,
): string {
  if (declaration) {
    return `from ${declaration.repoRelativePath}`;
  }

  return "declared in the same repository file";
}

function repositoryBoundaryLeakDeclaration(
  typeName: string,
  context: ProjectContext,
) {
  return context
    .resolvedDeclarations(typeName)
    .find((declaration) =>
      isRepositoryBoundaryLeakRoleFolder(declaration.roleFolder),
    );
}

function isLocalRepositorySupportType(
  typeName: string,
  file: ArchitectureFile,
): boolean {
  return file.topLevelDeclarations.some(
    (declaration) =>
      declaration.name === typeName &&
      declaration.kind !== NominalKind.Protocol &&
      declaration.kind !== NominalKind.Enum &&
      isRepositorySupportTypeName(declaration.name),
  );
}

function startsWithAnyLowercased(
  name: string,
  prefixes: readonly string[],
): boolean {
  const lowercasedName = name.toLowerCase();
  return prefixes.some(
    (prefix) => lowercasedName === prefix || lowercasedName.startsWith(prefix),
  );
}

function infrastructureStructuredRemediationMessage(input: {
  readonly summary: string;
  readonly categories: readonly string[];
  readonly signs: readonly string[];
  readonly architecturalNote: string;
  readonly destination: string;
  readonly decomposition: string;
}): string {
  return `${input.summary} Likely categories: ${input.categories.join("; ")}; signs: ${input.signs.join("; ")}; architectural note: ${input.architecturalNote}; destination: ${input.destination}; explicit decomposition guidance: ${input.decomposition}`;
}

function isLooseInfrastructureTranslationFile(file: ArchitectureFile): boolean {
  if (
    file.classification.layer !== ArchitectureLayer.Infrastructure ||
    file.classification.isInfrastructureTranslationFile
  ) {
    return false;
  }

  const pathComponents = file.classification.pathComponents.map((component) =>
    normalizedInfrastructureSegment(component),
  );
  const infrastructureIndex = pathComponents.findIndex(
    (component) => component === "infrastructure",
  );
  if (infrastructureIndex < 0) {
    return false;
  }

  const translationIndex = infrastructureIndex + 1;
  return pathComponents[translationIndex] === "translation";
}

function invalidInfrastructureRoleFolder(file: ArchitectureFile): string | null {
  if (
    file.classification.layer !== ArchitectureLayer.Infrastructure ||
    file.classification.roleFolder !== RoleFolder.None
  ) {
    return null;
  }

  const pathComponents = file.classification.pathComponents;
  const normalizedPathComponents = pathComponents.map((component) =>
    normalizedInfrastructureSegment(component),
  );
  const infrastructureIndex = normalizedPathComponents.findIndex(
    (component) => component === "infrastructure",
  );
  if (infrastructureIndex < 0) {
    return null;
  }

  const candidate = pathComponents[infrastructureIndex + 1];
  if (!candidate) {
    return null;
  }

  return ALLOWED_INFRASTRUCTURE_ROLE_FOLDERS.has(
    normalizedInfrastructureSegment(candidate),
  )
    ? null
    : candidate;
}

function isInfrastructureDirectoryPath(
  directoryPath: string,
  configuration: {
    readonly layerDirectoryNames: {
      readonly infrastructure: string;
    };
  },
): boolean {
  const [topLevelEntry] = directoryPath.split("/");
  if (!topLevelEntry) {
    return false;
  }

  return (
    normalizedInfrastructureSegment(topLevelEntry) ===
    normalizedInfrastructureSegment(configuration.layerDirectoryNames.infrastructure)
  );
}

function normalizedInfrastructureSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function concreteTopLevelDeclarations(
  file: ArchitectureFile,
): readonly ArchitectureTopLevelDeclaration[] {
  return file.topLevelDeclarations.filter(
    (declaration) => declaration.kind !== NominalKind.Protocol,
  );
}

function concreteTopLevelTypeNames(file: ArchitectureFile): Set<string> {
  return new Set(concreteTopLevelDeclarations(file).map((declaration) => declaration.name));
}

function hasConcreteTypeWithSuffix(
  file: ArchitectureFile,
  suffix: string,
): boolean {
  return file.topLevelDeclarations.some((declaration) => {
    switch (declaration.kind) {
      case NominalKind.Class:
      case NominalKind.Struct:
      case NominalKind.Actor:
        return declaration.name.endsWith(suffix);
      default:
        return false;
    }
  });
}

function methodsForType(
  file: ArchitectureFile,
  enclosingTypeName: string,
): readonly ArchitectureMethodDeclaration[] {
  return file.methodDeclarations.filter(
    (declaration) => declaration.enclosingTypeName === enclosingTypeName,
  );
}

function operationalUsesForMethod(
  file: ArchitectureFile,
  enclosingTypeName: string,
  methodName: string,
): readonly ArchitectureOperationalUseOccurrence[] {
  return file.operationalUseOccurrences.filter(
    (occurrence) =>
      occurrence.enclosingTypeName === enclosingTypeName &&
      occurrence.enclosingMethodName === methodName,
  );
}

function coordinateForType(
  file: ArchitectureFile,
  typeName: string,
): SourceCoordinate {
  return (
    file.topLevelDeclarations.find((declaration) => declaration.name === typeName)
      ?.coordinate ?? { line: 1, column: 1 }
  );
}

function firstMatchingMethodCoordinate(
  methods: readonly ArchitectureMethodDeclaration[],
  predicate: (method: ArchitectureMethodDeclaration) => boolean,
): SourceCoordinate | undefined {
  return methods.find(predicate)?.coordinate;
}

function isAdapterCandidate(declaration: ArchitectureTopLevelDeclaration): boolean {
  if (
    declaration.kind === NominalKind.Protocol ||
    declaration.kind === NominalKind.Enum
  ) {
    return false;
  }

  return INFRASTRUCTURE_ADAPTER_SUFFIXES.some((suffix) =>
    declaration.name.endsWith(suffix),
  );
}

function conformsToInwardProtocol(
  declaration: ArchitectureTopLevelDeclaration,
  context: ProjectContext,
): boolean {
  return declaration.inheritedTypeNames.some((typeName) => {
    const inheritedDeclaration = context.uniqueDeclaration(typeName);
    if (!inheritedDeclaration) {
      return false;
    }

    return (
      inheritedDeclaration.roleFolder === RoleFolder.ApplicationPortsProtocols ||
      inheritedDeclaration.roleFolder === RoleFolder.DomainProtocols
    );
  });
}

function isApplicationContractDeclaration(
  declaration: IndexedDeclaration,
): boolean {
  return (
    declaration.roleFolder === RoleFolder.ApplicationContractsCommands ||
    declaration.roleFolder === RoleFolder.ApplicationContractsPorts ||
    declaration.roleFolder === RoleFolder.ApplicationContractsWorkflow
  );
}

function isInfrastructureErrorDeclaration(
  declaration: IndexedDeclaration,
): boolean {
  return declaration.roleFolder === RoleFolder.InfrastructureErrors;
}

function returnsInwardNormalizedType(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  if (!declaration.hasExplicitReturnType || declaration.returnsVoidLike) {
    return false;
  }

  return declaration.returnTypeNames.some((typeName) => {
    const indexedDeclaration = context.uniqueDeclaration(typeName);
    return Boolean(
      indexedDeclaration &&
        (indexedDeclaration.layer === ArchitectureLayer.Domain ||
          isApplicationContractDeclaration(indexedDeclaration) ||
          isInfrastructureErrorDeclaration(indexedDeclaration)),
    );
  });
}

function acceptsInwardNormalizedType(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  return declaration.parameterTypeNames.some((typeName) => {
    const indexedDeclaration = context.uniqueDeclaration(typeName);
    return Boolean(
      indexedDeclaration &&
        (indexedDeclaration.layer === ArchitectureLayer.Domain ||
          isApplicationContractDeclaration(indexedDeclaration) ||
          isInfrastructureErrorDeclaration(indexedDeclaration)),
    );
  });
}

function isBoundaryCrossingTranslationMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const concreteTypes = concreteTopLevelTypeNames(file);
  if (!concreteTypes.has(declaration.enclosingTypeName)) {
    return false;
  }

  if (
    !declaration.enclosingTypeName.endsWith("Model") &&
    !declaration.enclosingTypeName.endsWith("DTO")
  ) {
    return false;
  }

  return (
    returnsInwardNormalizedType(declaration, context) ||
    acceptsInwardNormalizedType(declaration, context)
  );
}

function isInwardTranslationSourceTypeName(
  typeName: string,
  file: ArchitectureFile,
  enclosingTypeName: string,
  context: ProjectContext,
): boolean {
  const nestedDeclaration = file.nestedNominalDeclarations.find(
    (declaration) =>
      declaration.enclosingTypeName === enclosingTypeName &&
      declaration.name === typeName &&
      declaration.kind !== NominalKind.Protocol,
  );
  if (nestedDeclaration) {
    return isLikelyNestedIntermediaryShape(nestedDeclaration);
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration || indexedDeclaration.layer !== ArchitectureLayer.Infrastructure) {
    return false;
  }

  return (
    indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels ||
    (indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationDTOs &&
      indexedDeclaration.name.endsWith("ResponseDTO"))
  );
}

function hasGatewayExecutionFlowEvidence(
  file: ArchitectureFile,
  gatewayTypeName: string,
  methods: readonly ArchitectureMethodDeclaration[],
): boolean {
  if (methods.some((method) => isExecutionLikeMethod(method, file))) {
    return true;
  }

  return file.storedMemberDeclarations.some(
    (declaration) =>
      declaration.enclosingTypeName === gatewayTypeName &&
      declaration.typeNames.some((typeName) =>
        GATEWAY_EXECUTION_MEMBER_TYPE_FRAGMENTS.some((fragment) =>
          typeName.toLowerCase().includes(fragment),
        ),
      ),
  );
}

function hasGatewayRoleFitMisclassificationEvidence(
  file: ArchitectureFile,
  methods: readonly ArchitectureMethodDeclaration[],
  context: ProjectContext,
): boolean {
  return (
    methods.some((method) => isLikelyGatewayPreparationMethod(method, file, context)) ||
    hasConfigurationNormalizationResponsibility(methods, file, context) ||
    hasIntermediaryRequestDefinitionShapingResponsibility(methods, file, context)
  );
}

function isLikelyGatewayPreparationMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (!declaration.hasExplicitReturnType || declaration.returnsVoidLike) {
    return false;
  }

  const lowerName = declaration.name.toLowerCase();
  if (
    !GATEWAY_PREPARATION_NAME_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    )
  ) {
    return false;
  }

  return (
    returnsPreparedBoundaryShape(declaration, file, context) ||
    acceptsRequestDefinitionTranslationInput(declaration, context) ||
    acceptsInwardProjectionInput(declaration, context) ||
    hasConfigurationNormalizationResponsibility([declaration], file, context)
  );
}

function isBoundaryConfigurationShapingMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  if (
    !BOUNDARY_CONFIGURATION_NAME_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    )
  ) {
    return false;
  }

  return (
    declaration.parameterTypeNames.some((typeName) =>
      isLikelyBoundaryConfigurationSourceTypeName(typeName, context),
    ) ||
    declaration.returnTypeNames.some((typeName) =>
      isLikelyBoundaryConfigurationCarrierTypeName(typeName) ||
      isConfigurationTranslationCarrierTypeName(typeName, file, context),
    ) ||
    hasGatewayBoundaryConfigurationOperationEvidence(declaration, file)
  );
}

function isBoundaryDefinitionShapingMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  const hasNameEvidence = BOUNDARY_DEFINITION_NAME_FRAGMENTS.some((fragment) =>
    lowerName.includes(fragment),
  );
  const hasInputEvidence =
    acceptsGatewayBoundaryDefinitionSourceInput(declaration, context) ||
    hasGatewayRequestDefinitionIngredientEvidence(declaration, context);
  const hasOutputEvidence =
    returnsBoundaryDefinitionShape(declaration, file, context) ||
    declaration.returnTypeNames.some((typeName) =>
      isLikelyBoundaryDefinitionCarrierTypeName(typeName),
    );

  return (hasNameEvidence && (hasInputEvidence || hasOutputEvidence)) || (hasInputEvidence && hasOutputEvidence);
}

function isInlineOutboundRequestTranslationMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const operationalUses = operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  );

  if (!hasImmediateTransportHandoff(operationalUses)) {
    return false;
  }

  return (
    operationalUses.some((occurrence) =>
      isDirectOutboundTranslationConstruction(occurrence, file, context),
    ) ||
    declaration.returnTypeNames.some((typeName) =>
      isGatewayOutboundTranslationCarrierTypeName(typeName, context),
    )
  );
}

function hasImmediateTransportHandoff(
  operationalUses: readonly ArchitectureOperationalUseOccurrence[],
): boolean {
  return operationalUses.some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      IMMEDIATE_TRANSPORT_EXECUTION_CALL_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      ) ||
      IMMEDIATE_TRANSPORT_EXECUTION_CALL_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      )
    );
  });
}

function isDirectOutboundTranslationConstruction(
  occurrence: ArchitectureOperationalUseOccurrence,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (occurrence.memberName !== "new") {
    return false;
  }

  return isGatewayOutboundTranslationCarrierTypeName(
    occurrence.baseName,
    context,
  ) || isFinalProviderTransportBoundaryShapeTypeName(occurrence.baseName, file, context);
}

function isGatewayOutboundTranslationCarrierTypeName(
  typeName: string,
  context: ProjectContext,
): boolean {
  if (GATEWAY_TRANSPORT_CARRIER_TYPE_NAMES.has(typeName)) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  return indexedDeclaration?.roleFolder === RoleFolder.InfrastructureTranslationDTOs;
}

function isInlineNormalizationPreparationMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
  owner: "gateway" | "portAdapter",
): boolean {
  if (
    !declaration.isPrivateOrFileprivate ||
    !declaration.hasExplicitReturnType ||
    declaration.returnsVoidLike ||
    !hasInlineNormalizationPreparationInputCluster(declaration, file, context) ||
    !returnsInlineNormalizationPreparationOutput(declaration, file, context) ||
    !hasInlineNormalizationPreparationRoleCluster(declaration, file, context) ||
    returnsInlineNormalizationPreparationDecisionOutput(declaration) ||
    hasInlineNormalizationPreparationParserSubsystemSignals(
      declaration,
      file,
      context,
    ) ||
    hasInlineNormalizationPreparationExecutionSignals(declaration, file) ||
    isObviousTechnicalDecisionMethod(declaration, file, context) ||
    isTypedBoundaryCompatibilityEvaluationMethod(declaration, file, context)
  ) {
    return false;
  }

  const returnsPrimitiveLikeOutput = declaration.returnTypeNames.every(
    (typeName) =>
      isPrimitiveOrRawTechnicalTypeName(typeName) ||
      CONTAINER_TYPE_NAMES.has(typeName),
  );
  if (
    returnsPrimitiveLikeOutput &&
    !hasInlineNormalizationPreparationBoundaryContextEvidence(
      declaration,
      file,
      context,
    )
  ) {
    return false;
  }

  if (owner === "gateway") {
    return !hasGatewayNormalizationPreparationControlSignals(declaration, file);
  }

  return !hasPortAdapterLegitimateFinalRenderOutputPattern(declaration, file);
}

function isObviousTechnicalDecisionMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    !declaration.hasExplicitReturnType ||
    declaration.returnsVoidLike ||
    !hasAlreadyShapedTypedTechnicalInput(declaration, file, context) ||
    !returnsTypedTechnicalDecision(declaration, file, context) ||
    hasRawExtractionOrTranslationSignature(declaration, file)
  ) {
    return false;
  }

  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).every(isAllowedDecisionSupportOperation);
}

function isTypedBoundaryCompatibilityEvaluationMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return (
    hasTypedBoundaryCompatibilityInputCluster(declaration, file, context) &&
    hasCompatibilityEvaluationStructure(declaration, file, context) &&
    hasStrongCompatibilityFailureMappingSignal(declaration, file, context) &&
    !hasDisqualifyingCompatibilityOperations(declaration, file)
  );
}

function isTypedInteractionDispatchMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    !declaration.isPrivateOrFileprivate ||
    isExcludedDecisionControlMethod(declaration) ||
    isObviousTechnicalDecisionMethod(declaration, file, context) ||
    isTypedBoundaryCompatibilityEvaluationMethod(declaration, file, context) ||
    !hasTypedInteractionDispatchInput(declaration, file, context) ||
    hasGatewayInteractionDispatchControlPattern(declaration, file)
  ) {
    return false;
  }

  return hasInlineTypedInteractionDispatchStructure(declaration, file);
}

function hasTranslationSubsystemSurface(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (declaration.isPublicOrOpen) {
    return false;
  }

  return (
    hasTranslationLikeSignature(declaration, file) ||
    returnsParserModelTranslationType(declaration, file, context) ||
    acceptsRawSyntaxInput(declaration) ||
    acceptsInwardProjectionInput(declaration, context)
  );
}

function hasEvaluatorDecisionSurface(
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const concreteTypeNames = concreteTopLevelTypeNames(file);
  return file.methodDeclarations.some(
    (declaration) =>
      concreteTypeNames.has(declaration.enclosingTypeName) &&
      isObviousTechnicalDecisionMethod(declaration, file, context),
  );
}

function hasTranslationLikeSignature(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  if (hasRawExtractionOrTranslationSignature(declaration, file)) {
    return true;
  }

  const lowerName = declaration.name.toLowerCase();
  return TRANSLATION_SUBSYSTEM_NAME_FRAGMENTS.some((fragment) =>
    lowerName.includes(fragment),
  );
}

function hasInwardTranslationSurface(
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const concreteTypeNames = concreteTopLevelTypeNames(file);
  return file.methodDeclarations.some(
    (declaration) =>
      concreteTypeNames.has(declaration.enclosingTypeName) &&
      !declaration.isPrivateOrFileprivate &&
      returnsInwardNormalizedType(declaration, context),
  );
}

function hasParserModelTranslationSurface(
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const concreteTypeNames = concreteTopLevelTypeNames(file);
  const parserTypesInFile = new Set(
    concreteTopLevelDeclarations(file)
      .filter((declaration) =>
        isParserModelTranslationTypeName(declaration.name, file, context),
      )
      .map((declaration) => declaration.name),
  );
  if (parserTypesInFile.size === 0) {
    return false;
  }

  return file.methodDeclarations.some(
    (declaration) =>
      concreteTypeNames.has(declaration.enclosingTypeName) &&
      !declaration.isPrivateOrFileprivate &&
      returnsParserModelTranslationType(declaration, file, context) &&
      (acceptsRawSyntaxInput(declaration) ||
        acceptsInwardProjectionInput(declaration, context)),
  );
}

function hasConfigurationNormalizationSurface(
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const concreteTypeNames = concreteTopLevelTypeNames(file);
  return file.methodDeclarations.some(
    (declaration) =>
      concreteTypeNames.has(declaration.enclosingTypeName) &&
      !declaration.isPrivateOrFileprivate &&
      hasConfigurationNormalizationResponsibility([declaration], file, context),
  );
}

function hasIntermediaryRequestDefinitionTranslationSurface(
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (hasNonPrivateTransportOrExecutionSurface(file)) {
    return false;
  }

  const concreteTypeNames = concreteTopLevelTypeNames(file);
  return file.methodDeclarations.some(
    (declaration) =>
      concreteTypeNames.has(declaration.enclosingTypeName) &&
      !declaration.isPrivateOrFileprivate &&
      declaration.hasExplicitReturnType &&
      !declaration.returnsVoidLike &&
      returnsIntermediaryRequestDefinitionTranslationType(
        declaration,
        file,
        context,
      ) &&
      acceptsRequestDefinitionTranslationInput(declaration, context),
  );
}

function hasConfigurationNormalizationResponsibility(
  methods: readonly ArchitectureMethodDeclaration[],
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return methods.some((declaration) => {
    const lowerName = declaration.name.toLowerCase();
    const referencesConfigInput = declaration.parameterTypeNames.some((typeName) =>
      isConfigurationInputTypeName(typeName, context),
    );
    const returnsConfigCarrier = declaration.returnTypeNames.some((typeName) =>
      isConfigurationTranslationCarrierTypeName(typeName, file, context),
    );

    if (!referencesConfigInput && !lowerName.includes("config")) {
      return false;
    }

    return (
      returnsConfigCarrier ||
      (declaration.hasExplicitReturnType &&
        !declaration.returnsVoidLike &&
        lowerName.includes("normalize")) ||
      lowerName === "fromcontract"
    );
  });
}

function hasIntermediaryRequestDefinitionShapingResponsibility(
  methods: readonly ArchitectureMethodDeclaration[],
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return methods.some((declaration) => {
    const lowerName = declaration.name.toLowerCase();
    const returnsRequestDefinitionLikeType =
      returnsIntermediaryRequestDefinitionTranslationType(
        declaration,
        file,
        context,
      );
    const acceptsNormalizedConfig = declaration.parameterTypeNames.some(
      (typeName) =>
        isConfigurationTranslationCarrierTypeName(typeName, file, context),
    );

    if (
      !returnsRequestDefinitionLikeType &&
      !lowerName.includes("requestdefinition")
    ) {
      return false;
    }

    return (
      acceptsNormalizedConfig ||
      hasGatewayRequestDefinitionIngredientEvidence(declaration, context) ||
      lowerName.includes("query") ||
      lowerName.includes("request")
    );
  });
}

function returnsIntermediaryRequestDefinitionTranslationType(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.returnTypeNames.some((typeName) => {
    if (
      file.topLevelDeclarations.some(
        (candidate) =>
          candidate.kind !== NominalKind.Protocol &&
          candidate.name === typeName &&
          isLikelyIntermediaryRequestDefinitionTranslationTypeName(typeName),
      )
    ) {
      return true;
    }

    const indexedDeclaration = context.uniqueDeclaration(typeName);
    return Boolean(
      indexedDeclaration &&
        indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels &&
        isLikelyIntermediaryRequestDefinitionTranslationTypeName(typeName),
    );
  });
}

function returnsRequestDefinitionTranslationType(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.returnTypeNames.some((typeName) => {
    if (
      file.topLevelDeclarations.some(
        (candidate) =>
          candidate.kind !== NominalKind.Protocol &&
          candidate.name === typeName &&
          isLikelyBoundaryDefinitionTranslationTypeName(typeName),
      )
    ) {
      return true;
    }

    const indexedDeclaration = context.uniqueDeclaration(typeName);
    if (!indexedDeclaration) {
      return false;
    }

    return (
      indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationDTOs ||
      (indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels &&
        isLikelyBoundaryDefinitionTranslationTypeName(typeName))
    );
  });
}

function acceptsRequestDefinitionTranslationInput(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  const stringCount = declaration.parameterTypeNames.filter(
    (typeName) => typeName === "String",
  ).length;
  const hasModelOrContractInput = declaration.parameterTypeNames.some(
    (typeName) => {
      const indexedDeclaration = context.uniqueDeclaration(typeName);
      return Boolean(
        indexedDeclaration &&
          (indexedDeclaration.roleFolder ===
            RoleFolder.InfrastructureTranslationModels ||
            indexedDeclaration.roleFolder ===
              RoleFolder.InfrastructureTranslationDTOs ||
            isApplicationContractDeclaration(indexedDeclaration)),
      );
    },
  );

  return stringCount >= 2 || (stringCount >= 1 && hasModelOrContractInput);
}

function hasGatewayRequestDefinitionIngredientEvidence(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  const stringCount = declaration.parameterTypeNames.filter(
    (typeName) => typeName === "string",
  ).length;
  const hasPayloadCarrier = declaration.parameterTypeNames.some((typeName) => {
    if (typeName === "Request") {
      return false;
    }

    const indexedDeclaration = context.uniqueDeclaration(typeName);
    return Boolean(
      indexedDeclaration &&
        (indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationDTOs ||
          indexedDeclaration.roleFolder ===
            RoleFolder.InfrastructureTranslationModels),
    );
  });

  return stringCount >= 2 || (stringCount >= 1 && hasPayloadCarrier);
}

function gatewayUsesExtractedRequestShapingModel(
  file: ArchitectureFile,
  gatewayTypeName: string,
  methods: readonly ArchitectureMethodDeclaration[],
  context: ProjectContext,
): boolean {
  if (
    methods.some(
      (declaration) =>
        declaration.parameterTypeNames.some((typeName) =>
          isExtractedRequestShapingTranslationModelTypeName(typeName, context),
        ) ||
        declaration.returnTypeNames.some((typeName) =>
          isExtractedRequestShapingTranslationModelTypeName(typeName, context),
        ),
    )
  ) {
    return true;
  }

  const gatewayMemberTypeNames = new Set(
    file.storedMemberDeclarations
      .filter((declaration) => declaration.enclosingTypeName === gatewayTypeName)
      .flatMap((declaration) => declaration.typeNames),
  );
  if (
    [...gatewayMemberTypeNames].some((typeName) =>
      isExtractedRequestShapingTranslationModelTypeName(typeName, context),
    )
  ) {
    return true;
  }

  return file.typeReferences.some((reference) =>
    isExtractedRequestShapingTranslationModelTypeName(reference.name, context),
  );
}

function hasInlineGatewayRequestShapingEvidence(
  file: ArchitectureFile,
  methods: readonly ArchitectureMethodDeclaration[],
  context: ProjectContext,
): boolean {
  return methods.some((method) =>
    isBoundaryDefinitionShapingMethod(method, file, context),
  );
}

function hasNonPrivateTransportOrExecutionSurface(file: ArchitectureFile): boolean {
  return file.methodDeclarations.some(
    (declaration) =>
      !declaration.isPrivateOrFileprivate && isExecutionLikeMethod(declaration, file),
  );
}

function finalTransportProviderShapeDiagnostics(
  file: ArchitectureFile,
  context: ProjectContext,
): readonly {
  name: string;
  coordinate: SourceCoordinate;
}[] {
  const diagnostics: { name: string; coordinate: SourceCoordinate }[] = [];
  const seen = new Set<string>();

  for (const declaration of concreteTopLevelDeclarations(file)) {
    if (
      declaration.name.endsWith("DTO") ||
      declaration.name.endsWith("Request") ||
      declaration.name.endsWith("Response")
    ) {
      if (!seen.has(declaration.name)) {
        diagnostics.push({
          name: declaration.name,
          coordinate: declaration.coordinate,
        });
        seen.add(declaration.name);
      }
      continue;
    }

    const methods = methodsForType(file, declaration.name);
    const culprit = methods.find((method) =>
      returnsFinalProviderTransportBoundaryShape(method, file, context),
    );
    if (culprit && !seen.has(`${declaration.name}:${culprit.name}`)) {
      diagnostics.push({
        name: culprit.name,
        coordinate: culprit.coordinate,
      });
      seen.add(`${declaration.name}:${culprit.name}`);
    }
  }

  return diagnostics;
}

function hasDTOIntermediaryOrNormalizationViolation(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  return (
    INLINE_NORMALIZATION_PREPARATION_NAME_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    ) ||
    hasConfigurationNormalizationResponsibility([declaration], file, context) ||
    hasIntermediaryRequestDefinitionShapingResponsibility(
      [declaration],
      file,
      context,
    )
  );
}

function hasDTOExecutionOrchestrationViolation(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  return hasExecutionLikeOperations(
    operationalUsesForMethod(file, declaration.enclosingTypeName, declaration.name),
  );
}

function infrastructureAttachedApplicationContractDeclaration(
  typeName: string,
  context: ProjectContext,
): IndexedDeclaration | undefined {
  const declaration = context.uniqueDeclaration(typeName);
  if (!declaration || !isApplicationContractDeclaration(declaration)) {
    return undefined;
  }

  return declaration;
}

function nestedGatewayNormalizationClusterShapeKeys(
  file: ArchitectureFile,
  context: ProjectContext,
): Set<string> {
  const nestedDeclarations = file.nestedNominalDeclarations.filter(
    (declaration) =>
      declaration.kind !== NominalKind.Protocol &&
      isLikelyNestedIntermediaryShape(declaration),
  );
  if (nestedDeclarations.length === 0) {
    return new Set();
  }

  const clusterShapeKeys = new Set(
    nestedDeclarations
      .filter((declaration) =>
        directlyParticipatesInInwardNormalization(declaration, file, context),
      )
      .map(shapeKeyForNestedDeclaration),
  );
  if (clusterShapeKeys.size === 0) {
    return new Set();
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const declaration of nestedDeclarations) {
      const key = shapeKeyForNestedDeclaration(declaration);
      if (clusterShapeKeys.has(key)) {
        continue;
      }

      if (participatesInStagedNormalizationPipeline(declaration, file, clusterShapeKeys)) {
        clusterShapeKeys.add(key);
        changed = true;
      }
    }
  }

  return clusterShapeKeys;
}

function directlyParticipatesInInwardNormalization(
  declaration: ArchitectureNestedNominalDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return file.methodDeclarations.some((method) => {
    if (method.enclosingTypeName !== declaration.enclosingTypeName) {
      return false;
    }

    const referencesNestedShape =
      method.parameterTypeNames.includes(declaration.name) ||
      method.returnTypeNames.includes(declaration.name);
    if (!referencesNestedShape) {
      return false;
    }

    return (
      returnsInwardNormalizedType(method, context) ||
      acceptsInwardNormalizedType(method, context) ||
      returnsExtractedInwardTranslationSourceType(method, context)
    );
  });
}

function participatesInStagedNormalizationPipeline(
  declaration: ArchitectureNestedNominalDeclaration,
  file: ArchitectureFile,
  clusterShapeKeys: Set<string>,
): boolean {
  const methods = methodsForType(file, declaration.enclosingTypeName);
  const methodsReturningDeclaration = methods.filter((method) =>
    method.returnTypeNames.includes(declaration.name),
  );
  if (methodsReturningDeclaration.length === 0) {
    return false;
  }

  const returningMethodNames = new Set(
    methodsReturningDeclaration.map((method) => method.name),
  );

  return methods.some((method) => {
    const operationalUses = operationalUsesForMethod(
      file,
      method.enclosingTypeName,
      method.name,
    );
    const usesExistingClusterShape = operationalUses.some((occurrence) =>
      clusterShapeKeys.has(shapeKey(occurrence.baseName, method.enclosingTypeName)),
    );
    if (!usesExistingClusterShape) {
      return false;
    }

    return (
      method.returnTypeNames.includes(declaration.name) ||
      operationalUses.some((occurrence) => returningMethodNames.has(occurrence.baseName))
    );
  });
}

function classifyNestedBoundaryShapingHelper(
  declaration: ArchitectureNestedNominalDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): "intermediary" | "finalBoundary" | "mixed" | undefined {
  const nestedMethods = file.methodDeclarations.filter(
    (method) => method.enclosingTypeName === declaration.name,
  );
  const hasIntermediaryShaping =
    hasConfigurationNormalizationResponsibility(nestedMethods, file, context) ||
    hasIntermediaryRequestDefinitionShapingResponsibility(
      nestedMethods,
      file,
      context,
    ) ||
    declaration.memberNames.some((memberName) =>
      NESTED_INTERMEDIARY_MEMBER_NAME_FRAGMENTS.some((fragment) =>
        memberName.toLowerCase().includes(fragment),
      ),
    );
  const hasFinalBoundaryShaping =
    nestedMethods.some(
      (method) =>
        returnsFinalProviderTransportBoundaryShape(method, file, context) ||
        method.parameterTypeNames.some((typeName) =>
          isFinalProviderTransportBoundaryShapeTypeName(typeName, file, context),
        ),
    ) ||
    declaration.memberNames.some((memberName) =>
      NESTED_FINAL_BOUNDARY_MEMBER_NAME_FRAGMENTS.some((fragment) =>
        memberName.toLowerCase().includes(fragment),
      ),
    );

  if (hasIntermediaryShaping && hasFinalBoundaryShaping) {
    return "mixed";
  }
  if (hasIntermediaryShaping) {
    return "intermediary";
  }
  if (hasFinalBoundaryShaping) {
    return "finalBoundary";
  }
  return undefined;
}

function nestedBoundaryShapingHelperSummary(
  declaration: ArchitectureNestedNominalDeclaration,
  classification: "intermediary" | "finalBoundary" | "mixed",
): string {
  switch (classification) {
    case "intermediary":
      return `Infrastructure/Gateways should not keep nested intermediary boundary-shaping helper '${declaration.enclosingTypeName}.${declaration.name}'.`;
    case "finalBoundary":
      return `Infrastructure/Gateways should not keep nested final boundary-shaping helper '${declaration.enclosingTypeName}.${declaration.name}'.`;
    case "mixed":
      return `Infrastructure/Gateways should not keep nested helper '${declaration.enclosingTypeName}.${declaration.name}' mixing intermediary and final boundary shaping.`;
  }
}

function nestedBoundaryShapingHelperDestination(
  classification: "intermediary" | "finalBoundary" | "mixed",
): string {
  switch (classification) {
    case "intermediary":
      return "Move intermediary shaping to Infrastructure/Translation/Models and keep only orchestration in the gateway.";
    case "finalBoundary":
      return "Move final boundary-facing carriers and DTO-side translators to Infrastructure/Translation/DTOs and keep only orchestration in the gateway.";
    case "mixed":
      return "Split intermediary shaping into Infrastructure/Translation/Models, split final boundary-facing shaping into Infrastructure/Translation/DTOs, and keep only orchestration in the gateway.";
  }
}

function shapeKeyForNestedDeclaration(
  declaration: ArchitectureNestedNominalDeclaration,
): string {
  return shapeKey(declaration.name, declaration.enclosingTypeName);
}

function shapeKey(name: string, enclosingTypeName: string): string {
  return `${enclosingTypeName}.${name}`;
}

function returnsExtractedInwardTranslationSourceType(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  return declaration.returnTypeNames.some((typeName) => {
    const indexedDeclaration = context.uniqueDeclaration(typeName);
    if (!indexedDeclaration) {
      return false;
    }

    return (
      indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels ||
      (indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationDTOs &&
        indexedDeclaration.name.endsWith("ResponseDTO"))
    );
  });
}

function returnsPreparedBoundaryShape(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return (
    returnsBoundaryDefinitionShape(declaration, file, context) ||
    declaration.returnTypeNames.some((typeName) =>
      isLikelyBoundaryConfigurationCarrierTypeName(typeName),
    )
  );
}

function acceptsRawSyntaxInput(declaration: ArchitectureMethodDeclaration): boolean {
  return declaration.parameterTypeNames.some((typeName) =>
    PRIMITIVE_OR_RAW_TECHNICAL_TYPE_NAMES.has(typeName),
  );
}

function acceptsInwardProjectionInput(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  return declaration.parameterTypeNames.some((typeName) => {
    const indexedDeclaration = context.uniqueDeclaration(typeName);
    return Boolean(
      indexedDeclaration &&
        (indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels ||
          indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationDTOs),
    );
  });
}

function returnsParserModelTranslationType(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.returnTypeNames.some((typeName) =>
    isParserModelTranslationTypeName(typeName, file, context),
  );
}

function isParserModelTranslationTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const lowerTypeName = typeName.toLowerCase();
  if (
    PARSER_TRANSLATION_SHAPE_KEYWORDS.some((fragment) =>
      lowerTypeName.includes(fragment.toLowerCase()),
    ) &&
    PARSER_MODEL_CARRIER_KEYWORDS.some((fragment) =>
      lowerTypeName.includes(fragment.toLowerCase()),
    )
  ) {
    return true;
  }

  if (
    file.topLevelDeclarations.some(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol && declaration.name === typeName,
    )
  ) {
    return (
      PARSER_TRANSLATION_SHAPE_KEYWORDS.some((fragment) =>
        lowerTypeName.includes(fragment.toLowerCase()),
      ) ||
      PARSER_MODEL_CARRIER_KEYWORDS.some((fragment) =>
        lowerTypeName.includes(fragment.toLowerCase()),
      )
    );
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  return Boolean(
    indexedDeclaration &&
      indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels &&
      (PARSER_TRANSLATION_SHAPE_KEYWORDS.some((fragment) =>
        lowerTypeName.includes(fragment.toLowerCase()),
      ) ||
        PARSER_MODEL_CARRIER_KEYWORDS.some((fragment) =>
          lowerTypeName.includes(fragment.toLowerCase()),
        )),
  );
}

function isConfigurationInputTypeName(
  typeName: string,
  context: ProjectContext,
): boolean {
  if (typeName.toLowerCase().includes("config")) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  return Boolean(
    indexedDeclaration &&
      isApplicationContractDeclaration(indexedDeclaration) &&
      indexedDeclaration.name.toLowerCase().includes("config"),
  );
}

function isConfigurationTranslationCarrierTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (isLikelyBoundaryConfigurationCarrierTypeName(typeName)) {
    return true;
  }

  if (
    file.topLevelDeclarations.some(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol && declaration.name === typeName,
    )
  ) {
    return typeName.toLowerCase().includes("config");
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  return Boolean(
    indexedDeclaration &&
      indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels &&
      indexedDeclaration.name.toLowerCase().includes("config"),
  );
}

function isLikelyBoundaryConfigurationSourceTypeName(
  typeName: string,
  context: ProjectContext,
): boolean {
  if (BOUNDARY_CONFIGURATION_SOURCE_FRAGMENTS.some((fragment) => typeName.toLowerCase().includes(fragment))) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration) {
    return false;
  }

  return (
    isApplicationContractDeclaration(indexedDeclaration) ||
    indexedDeclaration.layer === ArchitectureLayer.Domain
  );
}

function isLikelyBoundaryConfigurationCarrierTypeName(typeName: string): boolean {
  return BOUNDARY_CONFIGURATION_CARRIER_FRAGMENTS.some((fragment) =>
    typeName.toLowerCase().includes(fragment),
  );
}

function acceptsGatewayBoundaryDefinitionSourceInput(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  const stringCount = declaration.parameterTypeNames.filter(
    (typeName) => typeName === "String",
  ).length;
  const hasConfigurationInput = declaration.parameterTypeNames.some((typeName) =>
    isLikelyBoundaryConfigurationSourceTypeName(typeName, context),
  );
  const hasInwardBusinessInput = declaration.parameterTypeNames.some((typeName) => {
    const indexedDeclaration = context.uniqueDeclaration(typeName);
    if (!indexedDeclaration) {
      return false;
    }

    if (
      indexedDeclaration.layer !== ArchitectureLayer.Domain &&
      !isApplicationContractDeclaration(indexedDeclaration)
    ) {
      return false;
    }

    return (
      !isLikelyBoundaryDefinitionCarrierTypeName(indexedDeclaration.name) &&
      !isLikelyBoundaryConfigurationCarrierTypeName(indexedDeclaration.name)
    );
  });

  return (
    (hasConfigurationInput && (stringCount >= 1 || hasInwardBusinessInput)) ||
    (stringCount >= 2 && hasInwardBusinessInput) ||
    stringCount >= 3
  );
}

function returnsBoundaryDefinitionShape(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    declaration.returnTypeNames.includes("Request") ||
    declaration.returnTypeNames.includes("Response") ||
    declaration.returnTypeNames.includes("HTTPResponse")
  ) {
    return true;
  }

  if (returnsRequestDefinitionTranslationType(declaration, file, context)) {
    return true;
  }

  return declaration.returnTypeNames.some((typeName) => {
    if (isLikelyBoundaryDefinitionCarrierTypeName(typeName)) {
      return true;
    }

    const indexedDeclaration = context.uniqueDeclaration(typeName);
    if (!indexedDeclaration) {
      return false;
    }

    return (
      (isApplicationContractDeclaration(indexedDeclaration) ||
        indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationModels ||
        indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationDTOs) &&
      isLikelyBoundaryDefinitionCarrierTypeName(indexedDeclaration.name)
    );
  });
}

function hasGatewayBoundaryConfigurationOperationEvidence(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  const operationNames = new Set(
    operationalUsesForMethod(file, declaration.enclosingTypeName, declaration.name).map(
      (occurrence) => occurrence.baseName,
    ),
  );

  return [...operationNames].some((operationName) =>
    BOUNDARY_CONFIGURATION_OPERATION_NAMES.has(operationName),
  );
}

function returnsFinalProviderTransportBoundaryShape(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.returnTypeNames.some((typeName) =>
    isFinalProviderTransportBoundaryShapeTypeName(typeName, file, context),
  );
}

function isFinalProviderTransportBoundaryShapeTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    typeName === "Request" ||
    typeName === "Response" ||
    typeName === "HTTPResponse" ||
    isLikelyFinalProviderTransportCarrierTypeName(typeName)
  ) {
    return true;
  }

  if (
    file.topLevelDeclarations.some(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol && declaration.name === typeName,
    )
  ) {
    return typeName.endsWith("DTO");
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  return Boolean(
    indexedDeclaration &&
      indexedDeclaration.roleFolder === RoleFolder.InfrastructureTranslationDTOs,
  );
}

function isLikelyFinalProviderTransportCarrierTypeName(typeName: string): boolean {
  const lowerName = typeName.toLowerCase();
  return (
    lowerName.endsWith("dto") ||
    lowerName.includes("request") ||
    lowerName.includes("response") ||
    lowerName.includes("payload") ||
    lowerName.includes("envelope")
  );
}

function hasPortAdapterLegitimateFinalRenderOutputPattern(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  if (
    !declaration.returnTypeNames.some((typeName) =>
      PORT_ADAPTER_RENDER_OUTPUT_TYPE_NAMES.has(typeName),
    )
  ) {
    return false;
  }

  const lowerName = declaration.name.toLowerCase();
  const operationalUses = operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  );
  const hasRenderIntentEvidence =
    PORT_ADAPTER_RENDER_INTENT_NAME_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    ) ||
    operationalUses.some((occurrence) => {
      const baseName = occurrence.baseName.toLowerCase();
      const memberName = occurrence.memberName.toLowerCase();
      return (
        PORT_ADAPTER_RENDER_INTENT_NAME_FRAGMENTS.some((fragment) =>
          baseName.includes(fragment),
        ) ||
        PORT_ADAPTER_RENDER_INTENT_NAME_FRAGMENTS.some((fragment) =>
          memberName.includes(fragment),
        )
      );
    });

  if (!hasRenderIntentEvidence) {
    return false;
  }

  if (hasExecutionLikeOperations(operationalUses)) {
    return false;
  }

  return (
    hasRenderIntentEvidence || hasMultipleBranchArms(operationalUses)
  );
}

function hasAlreadyShapedTypedTechnicalInput(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.parameterTypeNames.some((typeName) =>
    isAlreadyShapedTypedTechnicalTypeName(typeName, file, context),
  );
}

function hasTypedInteractionDispatchInput(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.parameterTypeNames.some((typeName) =>
    isTypedInteractionDispatchInputTypeName(typeName, file, context),
  );
}

function hasTypedBoundaryCompatibilityInputCluster(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const compatibilityInputCount = declaration.parameterTypeNames.filter(
    (typeName) =>
      isTypedBoundaryCompatibilityInputTypeName(typeName, file, context),
  ).length;
  return compatibilityInputCount >= 2;
}

function returnsTypedTechnicalDecision(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.returnTypeNames.some((typeName) =>
    isTypedTechnicalDecisionTypeName(typeName, file, context),
  );
}

function isTypedBoundaryCompatibilityInputTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    isPrimitiveOrRawTechnicalTypeName(typeName) ||
    CONTAINER_TYPE_NAMES.has(typeName)
  ) {
    return false;
  }

  if (hasLocalConcreteTechnicalTypeNamed(typeName, file)) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration) {
    return false;
  }

  return COMPATIBILITY_INPUT_ROLE_FOLDERS.has(indexedDeclaration.roleFolder);
}

function isTypedInteractionDispatchInputTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    isPrimitiveOrRawTechnicalTypeName(typeName) ||
    CONTAINER_TYPE_NAMES.has(typeName)
  ) {
    return false;
  }

  if (hasLocalConcreteTechnicalTypeNamed(typeName, file)) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration) {
    return false;
  }

  return DISPATCH_INPUT_ROLE_FOLDERS.has(indexedDeclaration.roleFolder);
}

function isAlreadyShapedTypedTechnicalTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    isPrimitiveOrRawTechnicalTypeName(typeName) ||
    CONTAINER_TYPE_NAMES.has(typeName)
  ) {
    return false;
  }

  if (hasLocalConcreteTechnicalTypeNamed(typeName, file)) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration) {
    return false;
  }

  return SHAPED_TECHNICAL_ROLE_FOLDERS.has(indexedDeclaration.roleFolder);
}

function isTypedTechnicalDecisionTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    isPrimitiveOrRawTechnicalTypeName(typeName) ||
    CONTAINER_TYPE_NAMES.has(typeName)
  ) {
    return false;
  }

  if (hasLocalConcreteTechnicalTypeNamed(typeName, file)) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration) {
    return false;
  }

  return SHAPED_TECHNICAL_ROLE_FOLDERS.has(indexedDeclaration.roleFolder);
}

function hasCompatibilityEvaluationStructure(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const compatibilityInputCount = declaration.parameterTypeNames.filter(
    (typeName) =>
      isTypedBoundaryCompatibilityInputTypeName(typeName, file, context),
  ).length;
  const operationalUses = operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  );
  const compatibilityComparisonCount = operationalUses.reduce(
    (count, occurrence) => {
      const memberName = occurrence.memberName.toLowerCase();
      return count + (COMPATIBILITY_EVALUATION_OPERATION_NAMES.has(memberName) ? 1 : 0);
    },
    0,
  );

  return compatibilityInputCount >= 2 && compatibilityComparisonCount >= 1;
}

function hasStrongCompatibilityFailureMappingSignal(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const operationalUses = operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  );
  const constructsInfrastructureError = operationalUses.some((occurrence) =>
    isInfrastructureErrorTypeName(occurrence.baseName, file, context),
  );
  const returnsTypedFailure = declaration.returnTypeNames.some((typeName) => {
    const lowerName = typeName.toLowerCase();
    if (
      isPrimitiveOrRawTechnicalTypeName(typeName) ||
      CONTAINER_TYPE_NAMES.has(typeName)
    ) {
      return false;
    }

    return (
      lowerName.includes("failure") ||
      lowerName.includes("outcome") ||
      lowerName.includes("result")
    );
  });

  return constructsInfrastructureError || returnsTypedFailure;
}

function hasDisqualifyingCompatibilityOperations(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  if (
    EXCLUDED_GATEWAY_DECISION_CONTROL_NAME_FRAGMENTS.some((fragment) =>
      declaration.name.toLowerCase().includes(fragment),
    )
  ) {
    return true;
  }

  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      DISALLOWED_GATEWAY_COMPATIBILITY_OPERATION_NAMES.has(memberName) ||
      DISALLOWED_GATEWAY_COMPATIBILITY_OPERATION_NAMES.has(baseName) ||
      GATEWAY_COMPATIBILITY_CONTROL_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      ) ||
      GATEWAY_COMPATIBILITY_CONTROL_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      )
    );
  });
}

function hasInlineNormalizationPreparationInputCluster(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.parameterTypeNames.some((typeName) =>
    isInlineNormalizationPreparationInputTypeName(typeName, file, context),
  );
}

function returnsInlineNormalizationPreparationOutput(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return declaration.returnTypeNames.some((typeName) =>
    isInlineNormalizationPreparationOutputTypeName(typeName, file, context),
  );
}

function hasInlineNormalizationPreparationRoleCluster(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const signalCount = inlineNormalizationPreparationOperationSignalCount(
    declaration,
    file,
  );
  const hasNameEvidence = hasInlineNormalizationPreparationNameEvidence(declaration);
  const hasPassiveShapeConstruction =
    hasInlineNormalizationPreparationPassiveShapeConstruction(
      declaration,
      file,
      context,
    );

  return (
    signalCount >= 2 ||
    (signalCount >= 1 && hasPassiveShapeConstruction) ||
    (signalCount >= 1 &&
      hasNameEvidence &&
      hasInlineNormalizationPreparationBoundaryContextEvidence(
        declaration,
        file,
        context,
      ))
  );
}

function hasInlineTypedInteractionDispatchStructure(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  const branchOperationalUses = operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).filter(
    (occurrence) =>
      occurrence.branchGroupIndex !== undefined &&
      occurrence.branchArmIndex !== undefined,
  );

  const branchArmsWithBoundaryWorkByGroup = new Map<number, Set<number>>();
  for (const occurrence of branchOperationalUses) {
    if (
      occurrence.branchGroupIndex === undefined ||
      occurrence.branchArmIndex === undefined ||
      !isBranchLocalBoundaryWorkOccurrence(occurrence)
    ) {
      continue;
    }

    const branchArms =
      branchArmsWithBoundaryWorkByGroup.get(occurrence.branchGroupIndex) ??
      new Set<number>();
    branchArms.add(occurrence.branchArmIndex);
    branchArmsWithBoundaryWorkByGroup.set(occurrence.branchGroupIndex, branchArms);
  }

  return [...branchArmsWithBoundaryWorkByGroup.values()].some(
    (branchArms) => branchArms.size >= 2,
  );
}

function hasMultipleBranchArms(
  operationalUses: readonly ArchitectureOperationalUseOccurrence[],
): boolean {
  const branchArmsByGroup = new Map<number, Set<number>>();
  for (const occurrence of operationalUses) {
    if (
      occurrence.branchGroupIndex === undefined ||
      occurrence.branchArmIndex === undefined
    ) {
      continue;
    }

    const branchArms =
      branchArmsByGroup.get(occurrence.branchGroupIndex) ?? new Set<number>();
    branchArms.add(occurrence.branchArmIndex);
    branchArmsByGroup.set(occurrence.branchGroupIndex, branchArms);
  }

  return [...branchArmsByGroup.values()].some(
    (branchArms) => branchArms.size >= 2,
  );
}

function hasGatewayInteractionDispatchControlPattern(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  if (
    GATEWAY_INTERACTION_DISPATCH_CONTROL_NAME_FRAGMENTS.some((fragment) =>
      declaration.name.toLowerCase().includes(fragment),
    )
  ) {
    return true;
  }

  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      GATEWAY_INTERACTION_DISPATCH_CONTROL_NAME_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      ) ||
      GATEWAY_INTERACTION_DISPATCH_CONTROL_NAME_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      )
    );
  });
}

function isBranchLocalBoundaryWorkOccurrence(
  occurrence: ArchitectureOperationalUseOccurrence,
): boolean {
  const baseName = occurrence.baseName.toLowerCase();
  const memberName = occurrence.memberName.toLowerCase();
  return (
    IMMEDIATE_TRANSPORT_EXECUTION_CALL_FRAGMENTS.some((fragment) =>
      baseName.includes(fragment),
    ) ||
    IMMEDIATE_TRANSPORT_EXECUTION_CALL_FRAGMENTS.some((fragment) =>
      memberName.includes(fragment),
    ) ||
    GATEWAY_BOUNDARY_EXECUTION_METHOD_NAME_FRAGMENTS.some((fragment) =>
      baseName.includes(fragment),
    ) ||
    GATEWAY_BOUNDARY_EXECUTION_METHOD_NAME_FRAGMENTS.some((fragment) =>
      memberName.includes(fragment),
    ) ||
    BRANCH_BOUNDARY_WORK_OPERATION_NAME_FRAGMENTS.some((fragment) =>
      baseName.includes(fragment),
    ) ||
    BRANCH_BOUNDARY_WORK_OPERATION_NAME_FRAGMENTS.some((fragment) =>
      memberName.includes(fragment),
    )
  );
}

function hasRawExtractionOrTranslationSignature(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  if (
    RAW_EXTRACTION_OR_TRANSLATION_NAME_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    )
  ) {
    return true;
  }

  if (
    declaration.parameterTypeNames.some((typeName) =>
      isPrimitiveOrRawTechnicalTypeName(typeName),
    )
  ) {
    return true;
  }

  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      RAW_EXTRACTION_OR_TRANSLATION_NAME_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      ) ||
      RAW_EXTRACTION_OR_TRANSLATION_NAME_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      )
    );
  });
}

function isInlineNormalizationPreparationInputTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    isPrimitiveOrRawTechnicalTypeName(typeName) ||
    CONTAINER_TYPE_NAMES.has(typeName)
  ) {
    return true;
  }

  if (!isInlineNormalizationPreparationBoundaryContextTypeName(typeName, file, context)) {
    return false;
  }

  if (hasLocalConcreteTechnicalTypeNamed(typeName, file)) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  return Boolean(
    indexedDeclaration &&
      indexedDeclaration.layer !== ArchitectureLayer.Domain &&
      indexedDeclaration.roleFolder !== RoleFolder.InfrastructureEvaluators,
  );
}

function isInlineNormalizationPreparationOutputTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    isPrimitiveOrRawTechnicalTypeName(typeName) ||
    CONTAINER_TYPE_NAMES.has(typeName)
  ) {
    return true;
  }

  if (isFinalProviderTransportBoundaryShapeTypeName(typeName, file, context)) {
    return true;
  }

  if (hasLocalConcreteTechnicalTypeNamed(typeName, file)) {
    const lowerName = typeName.toLowerCase();
    return (
      INLINE_NORMALIZATION_PREPARATION_OUTPUT_TYPE_NAME_FRAGMENTS.some(
        (fragment) => lowerName.includes(fragment),
      ) && !returnsInlineNormalizationPreparationDecisionOutputTypeName(typeName)
    );
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration) {
    return false;
  }

  switch (indexedDeclaration.roleFolder) {
    case RoleFolder.InfrastructureTranslationModels:
    case RoleFolder.InfrastructureTranslationDTOs:
      return true;
    default: {
      const lowerName = indexedDeclaration.name.toLowerCase();
      return (
        INLINE_NORMALIZATION_PREPARATION_OUTPUT_TYPE_NAME_FRAGMENTS.some(
          (fragment) => lowerName.includes(fragment),
        ) && !returnsInlineNormalizationPreparationDecisionOutputTypeName(indexedDeclaration.name)
      );
    }
  }
}

function hasInlineNormalizationPreparationNameEvidence(
  declaration: ArchitectureMethodDeclaration,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  return INLINE_NORMALIZATION_PREPARATION_NAME_FRAGMENTS.some((fragment) =>
    lowerName.includes(fragment),
  );
}

function inlineNormalizationPreparationOperationSignalCount(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): number {
  const operationalUses = operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  );
  const matchedSignals = new Set<string>();

  for (const occurrence of operationalUses) {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();

    if (INLINE_NORMALIZATION_PREPARATION_OPERATION_NAMES.has(memberName)) {
      matchedSignals.add(`member:${memberName}`);
    }
    if (INLINE_NORMALIZATION_PREPARATION_OPERATION_NAMES.has(baseName)) {
      matchedSignals.add(`base:${baseName}`);
    }

    const memberFragment = INLINE_NORMALIZATION_PREPARATION_OPERATION_FRAGMENTS.find(
      (fragment) => memberName.includes(fragment),
    );
    if (memberFragment) {
      matchedSignals.add(`fragment-member:${memberFragment}`);
    }

    const baseFragment = INLINE_NORMALIZATION_PREPARATION_OPERATION_FRAGMENTS.find(
      (fragment) => baseName.includes(fragment),
    );
    if (baseFragment) {
      matchedSignals.add(`fragment-base:${baseFragment}`);
    }
  }

  return matchedSignals.size;
}

function hasInlineNormalizationPreparationPassiveShapeConstruction(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).some((occurrence) =>
    isInlineNormalizationPreparationPassiveShapeOccurrence(
      occurrence,
      file,
      context,
    ),
  );
}

function isInlineNormalizationPreparationPassiveShapeOccurrence(
  occurrence: ArchitectureOperationalUseOccurrence,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (occurrence.memberName !== "new") {
    return false;
  }

  return isInlineNormalizationPreparationOutputTypeName(
    occurrence.baseName,
    file,
    context,
  );
}

function hasInlineNormalizationPreparationBoundaryContextEvidence(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (hasInlineNormalizationPreparationNameEvidence(declaration)) {
    return true;
  }

  if (
    declaration.parameterTypeNames.some((typeName) =>
      isInlineNormalizationPreparationBoundaryContextTypeName(typeName, file, context),
    ) ||
    declaration.returnTypeNames.some((typeName) =>
      isInlineNormalizationPreparationBoundaryContextTypeName(typeName, file, context),
    )
  ) {
    return true;
  }

  return (
    operationalUsesForMethod(
      file,
      declaration.enclosingTypeName,
      declaration.name,
    ).some((occurrence) => {
      const baseName = occurrence.baseName.toLowerCase();
      const memberName = occurrence.memberName.toLowerCase();
      return (
        INLINE_NORMALIZATION_PREPARATION_BOUNDARY_CONTEXT_FRAGMENTS.some(
          (fragment) => baseName.includes(fragment),
        ) ||
        INLINE_NORMALIZATION_PREPARATION_BOUNDARY_CONTEXT_FRAGMENTS.some(
          (fragment) => memberName.includes(fragment),
        )
      );
    }) ||
    hasInlineNormalizationPreparationPassiveShapeConstruction(
      declaration,
      file,
      context,
    )
  );
}

function isInlineNormalizationPreparationBoundaryContextTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const lowerName = typeName.toLowerCase();
  if (
    INLINE_NORMALIZATION_PREPARATION_BOUNDARY_CONTEXT_FRAGMENTS.some(
      (fragment) => lowerName.includes(fragment),
    )
  ) {
    return true;
  }

  if (isFinalProviderTransportBoundaryShapeTypeName(typeName, file, context)) {
    return true;
  }

  if (hasLocalConcreteTechnicalTypeNamed(typeName, file)) {
    return false;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  if (!indexedDeclaration) {
    return false;
  }

  switch (indexedDeclaration.roleFolder) {
    case RoleFolder.InfrastructureTranslationModels:
    case RoleFolder.InfrastructureTranslationDTOs:
      return true;
    default:
      return INLINE_NORMALIZATION_PREPARATION_BOUNDARY_CONTEXT_FRAGMENTS.some(
        (fragment) => indexedDeclaration.name.toLowerCase().includes(fragment),
      );
  }
}

function returnsInlineNormalizationPreparationDecisionOutput(
  declaration: ArchitectureMethodDeclaration,
): boolean {
  return declaration.returnTypeNames.some(
    returnsInlineNormalizationPreparationDecisionOutputTypeName,
  );
}

function returnsInlineNormalizationPreparationDecisionOutputTypeName(
  typeName: string,
): boolean {
  if (typeName === "Bool") {
    return true;
  }

  const lowerName = typeName.toLowerCase();
  return INLINE_NORMALIZATION_PREPARATION_DECISION_OUTPUT_FRAGMENTS.some(
    (fragment) => lowerName.includes(fragment),
  );
}

function hasInlineNormalizationPreparationParserSubsystemSignals(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  if (
    INLINE_NORMALIZATION_PREPARATION_PARSER_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    )
  ) {
    return true;
  }

  if (returnsParserModelTranslationType(declaration, file, context)) {
    return true;
  }

  if (
    declaration.parameterTypeNames.some((typeName) =>
      isParserModelTranslationTypeName(typeName, file, context),
    )
  ) {
    return true;
  }

  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      INLINE_NORMALIZATION_PREPARATION_PARSER_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      ) ||
      INLINE_NORMALIZATION_PREPARATION_PARSER_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      )
    );
  });
}

function hasInlineNormalizationPreparationExecutionSignals(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  if (
    INLINE_NORMALIZATION_PREPARATION_EXECUTION_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    )
  ) {
    return true;
  }

  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      INLINE_NORMALIZATION_PREPARATION_EXECUTION_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      ) ||
      INLINE_NORMALIZATION_PREPARATION_EXECUTION_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      ) ||
      IMMEDIATE_TRANSPORT_EXECUTION_CALL_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      ) ||
      IMMEDIATE_TRANSPORT_EXECUTION_CALL_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      )
    );
  });
}

function hasGatewayNormalizationPreparationControlSignals(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  if (
    INLINE_NORMALIZATION_PREPARATION_GATEWAY_CONTROL_FRAGMENTS.some(
      (fragment) => lowerName.includes(fragment),
    )
  ) {
    return true;
  }

  return operationalUsesForMethod(
    file,
    declaration.enclosingTypeName,
    declaration.name,
  ).some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      INLINE_NORMALIZATION_PREPARATION_GATEWAY_CONTROL_FRAGMENTS.some(
        (fragment) => baseName.includes(fragment),
      ) ||
      INLINE_NORMALIZATION_PREPARATION_GATEWAY_CONTROL_FRAGMENTS.some(
        (fragment) => memberName.includes(fragment),
      )
    );
  });
}

function isExcludedDecisionControlMethod(
  declaration: ArchitectureMethodDeclaration,
): boolean {
  return EXCLUDED_GATEWAY_DECISION_CONTROL_NAME_FRAGMENTS.some((fragment) =>
    declaration.name.toLowerCase().includes(fragment),
  );
}

function isAllowedDecisionSupportOperation(
  occurrence: ArchitectureOperationalUseOccurrence,
): boolean {
  const baseName = occurrence.baseName.toLowerCase();
  const memberName = occurrence.memberName.toLowerCase();

  if (
    EXECUTION_LIKE_OPERATION_NAME_FRAGMENTS.some((fragment) =>
      baseName.includes(fragment),
    ) ||
    EXECUTION_LIKE_OPERATION_NAME_FRAGMENTS.some((fragment) =>
      memberName.includes(fragment),
    ) ||
    RAW_EXTRACTION_OR_TRANSLATION_NAME_FRAGMENTS.some((fragment) =>
      baseName.includes(fragment),
    ) ||
    RAW_EXTRACTION_OR_TRANSLATION_NAME_FRAGMENTS.some((fragment) =>
      memberName.includes(fragment),
    ) ||
    EXCLUDED_GATEWAY_DECISION_CONTROL_NAME_FRAGMENTS.some((fragment) =>
      baseName.includes(fragment),
    ) ||
    EXCLUDED_GATEWAY_DECISION_CONTROL_NAME_FRAGMENTS.some((fragment) =>
      memberName.includes(fragment),
    )
  ) {
    return false;
  }

  return ALLOWED_DECISION_SUPPORT_OPERATION_NAMES.has(memberName);
}

function isPrimitiveOrRawTechnicalTypeName(typeName: string): boolean {
  return PRIMITIVE_OR_RAW_TECHNICAL_TYPE_NAMES.has(typeName);
}

function hasLocalConcreteTechnicalTypeNamed(
  typeName: string,
  file: ArchitectureFile,
): boolean {
  return (
    file.topLevelDeclarations.some(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol && declaration.name === typeName,
    ) ||
    file.nestedNominalDeclarations.some(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol && declaration.name === typeName,
    )
  );
}

function isInfrastructureErrorTypeName(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  if (
    file.topLevelDeclarations.some(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol &&
        declaration.name === typeName &&
        (declaration.name.endsWith("Error") ||
          declaration.inheritedTypeNames.includes("StructuredErrorProtocol") ||
          declaration.inheritedTypeNames.includes("Error") ||
          declaration.inheritedTypeNames.includes("LocalizedError")),
    )
  ) {
    return true;
  }

  const indexedDeclaration = context.uniqueDeclaration(typeName);
  return Boolean(indexedDeclaration && isInfrastructureErrorDeclaration(indexedDeclaration));
}

function returnsInlineNormalizationPreparationDecisionOutputTypeNames(
  declaration: ArchitectureMethodDeclaration,
): readonly string[] {
  return declaration.returnTypeNames.filter(
    returnsInlineNormalizationPreparationDecisionOutputTypeName,
  );
}

function hasExecutionLikeOperations(
  operationalUses: readonly ArchitectureOperationalUseOccurrence[],
): boolean {
  return operationalUses.some((occurrence) => {
    const baseName = occurrence.baseName.toLowerCase();
    const memberName = occurrence.memberName.toLowerCase();
    return (
      EXECUTION_LIKE_OPERATION_NAME_FRAGMENTS.some((fragment) =>
        baseName.includes(fragment),
      ) ||
      EXECUTION_LIKE_OPERATION_NAME_FRAGMENTS.some((fragment) =>
        memberName.includes(fragment),
      )
    );
  });
}

function isExecutionLikeMethod(
  declaration: ArchitectureMethodDeclaration,
  file: ArchitectureFile,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  if (
    EXECUTION_LIKE_OPERATION_NAME_FRAGMENTS.some((fragment) =>
      lowerName.includes(fragment),
    )
  ) {
    return true;
  }

  return hasExecutionLikeOperations(
    operationalUsesForMethod(file, declaration.enclosingTypeName, declaration.name),
  );
}

function isLikelyIntermediaryRequestDefinitionTranslationTypeName(
  name: string,
): boolean {
  const lowerName = name.toLowerCase();
  return REQUEST_DEFINITION_SHAPE_SUFFIXES.some((suffix) =>
    lowerName.endsWith(suffix.toLowerCase()),
  );
}

function isLikelyBoundaryDefinitionTranslationTypeName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.endsWith("request") ||
    lowerName.endsWith("response") ||
    lowerName.endsWith("payload") ||
    lowerName.endsWith("envelope") ||
    lowerName.endsWith("dto")
  );
}

function isLikelyBoundaryDefinitionCarrierTypeName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return (
    lowerName.includes("request") ||
    lowerName.includes("response") ||
    lowerName.includes("query") ||
    lowerName.includes("payload") ||
    lowerName.includes("operation") ||
    lowerName.endsWith("dto")
  );
}

function isExtractedRequestShapingTranslationModelTypeName(
  name: string,
  context: ProjectContext,
): boolean {
  const indexedDeclaration = context.uniqueDeclaration(name);
  if (!indexedDeclaration) {
    return false;
  }

  if (
    indexedDeclaration.roleFolder !== RoleFolder.InfrastructureTranslationModels &&
    indexedDeclaration.roleFolder !== RoleFolder.InfrastructureTranslationDTOs
  ) {
    return false;
  }

  return (
    isLikelyIntermediaryRequestDefinitionTranslationTypeName(indexedDeclaration.name) ||
    isLikelyBoundaryDefinitionTranslationTypeName(indexedDeclaration.name) ||
    indexedDeclaration.name.toLowerCase().includes("config")
  );
}

function isLikelyNestedIntermediaryShape(
  declaration: ArchitectureNestedNominalDeclaration,
): boolean {
  const lowerName = declaration.name.toLowerCase();
  return NESTED_INTERMEDIARY_TYPE_NAME_FRAGMENTS.some((fragment) =>
    lowerName.includes(fragment),
  );
}

function structuredErrorFileBaseName(repoRelativePath: string): string {
  const fileName = repoRelativePath.split("/").at(-1) ?? repoRelativePath;
  return fileName.replace(/\.[^.]+$/, "");
}

function isStructuredInfrastructureErrorDeclaration(
  declaration: ArchitectureTopLevelDeclaration,
): boolean {
  return (
    declaration.name.endsWith("InfrastructureError") ||
    declaration.name.endsWith("GatewayError") ||
    declaration.name.endsWith("Error") ||
    declaration.inheritedTypeNames.includes("StructuredErrorProtocol") ||
    declaration.inheritedTypeNames.includes("Error") ||
    declaration.inheritedTypeNames.includes("LocalizedError") ||
    [...STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES].every((memberName) =>
      declaration.memberNames.includes(memberName),
    )
  );
}

const ALLOWED_DIRECTIONAL_TRANSLATION_METHOD_NAMES = new Set([
  "toDomain",
  "fromDomain",
  "toContract",
  "fromContract",
  "toInfrastructureError",
  "fromInfrastructureError",
]);

const STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES = new Set([
  "code",
  "message",
  "retryable",
  "details",
]);

const INFRASTRUCTURE_GATEWAY_FORBIDDEN_SUFFIXES = [
  "Repository",
  "UseCase",
  "UseCases",
  "Policy",
  "Controller",
  "Route",
  "ViewModel",
  "PortAdapter",
  "Service",
];

const INFRASTRUCTURE_PORT_ADAPTER_FORBIDDEN_SUFFIXES = [
  "Repository",
  "Gateway",
  "UseCase",
  "UseCases",
  "Policy",
  "Controller",
  "Route",
  "ViewModel",
  "Service",
];

const INFRASTRUCTURE_TRANSLATION_FORBIDDEN_SUFFIXES = [
  "Repository",
  "Gateway",
  "PortAdapter",
  "UseCase",
  "UseCases",
  "Policy",
  "Controller",
  "Route",
  "ViewModel",
  "Service",
];

const INFRASTRUCTURE_DTO_FORBIDDEN_SUFFIXES = [
  "Gateway",
  "Repository",
  "PortAdapter",
  "UseCase",
  "Policy",
  "Service",
  "Controller",
  "Route",
  "ViewModel",
];

const INFRASTRUCTURE_ADAPTER_SUFFIXES = [
  "Repository",
  "Gateway",
  "PortAdapter",
];

const GATEWAY_PREPARATION_NAME_FRAGMENTS = [
  "prepare",
  "normalized",
  "normalize",
  "request",
  "query",
  "variables",
  "config",
  "configuration",
  "payload",
  "build",
  "make",
];

const BOUNDARY_CONFIGURATION_NAME_FRAGMENTS = [
  "config",
  "configuration",
  "headers",
  "parameters",
  "options",
];

const BOUNDARY_DEFINITION_NAME_FRAGMENTS = [
  "request",
  "query",
  "variables",
  "operation",
  "buildrequest",
  "makerequest",
];

const BOUNDARY_CONFIGURATION_SOURCE_FRAGMENTS = [
  "config",
  "configuration",
  "settings",
  "options",
  "environment",
];

const BOUNDARY_CONFIGURATION_CARRIER_FRAGMENTS = [
  "config",
  "configuration",
  "headers",
  "options",
  "settings",
];

const EXECUTION_LIKE_OPERATION_NAME_FRAGMENTS = [
  "send",
  "fetch",
  "execute",
  "stream",
  "write",
  "post",
  "put",
  "delete",
  "patch",
  "request",
  "load",
  "save",
  "connect",
  "publish",
  "subscribe",
  "listen",
  "wait",
  "paginate",
];

const GATEWAY_EXECUTION_MEMBER_TYPE_FRAGMENTS = [
  "client",
  "session",
  "connection",
  "transport",
  "gateway",
];

const IMMEDIATE_TRANSPORT_EXECUTION_CALL_FRAGMENTS = [
  "send",
  "execute",
  "request",
  "fetch",
  "write",
  "stream",
  "perform",
];

const GATEWAY_TRANSPORT_CARRIER_TYPE_NAMES = new Set([
  "Request",
  "HTTPRequest",
  "GraphQLRequest",
  "Response",
  "HTTPResponse",
]);

const PRIMITIVE_OR_RAW_TECHNICAL_TYPE_NAMES = new Set([
  "string",
  "number",
  "boolean",
  "bigint",
  "Date",
  "URL",
  "Request",
  "Response",
  "Headers",
  "Buffer",
  "unknown",
]);

const CONTAINER_TYPE_NAMES = new Set([
  "Array",
  "Dictionary",
  "Set",
  "Optional",
  "Result",
]);

const RAW_EXTRACTION_OR_TRANSLATION_NAME_FRAGMENTS = [
  "parse",
  "decode",
  "encode",
  "extract",
  "token",
  "lexer",
  "parser",
  "mapraw",
  "fromraw",
  "deserialize",
  "serialize",
];

const TRANSLATION_SUBSYSTEM_NAME_FRAGMENTS = [
  "parse",
  "decode",
  "encode",
  "extract",
  "translate",
  "mapper",
  "projection",
  "projection",
];

const PORT_ADAPTER_RENDER_INTENT_NAME_FRAGMENTS = [
  "render",
  "present",
  "response",
  "output",
  "format",
];

const PORT_ADAPTER_RENDER_OUTPUT_TYPE_NAMES = new Set([
  "string",
  "Buffer",
  "ResponseDTO",
  "Response",
  "HTTPResponse",
]);

const INLINE_NORMALIZATION_PREPARATION_NAME_FRAGMENTS = [
  "normalize",
  "normalized",
  "prepare",
  "coerce",
  "default",
  "context",
  "startup",
  "launch",
  "shape",
];

const INLINE_NORMALIZATION_PREPARATION_OPERATION_NAMES = new Set([
  "map",
  "compactMap",
  "flatMap",
  "merge",
  "joined",
  "split",
  "sorted",
  "lowercased",
  "uppercased",
  "trimmingCharacters",
  "replacingOccurrences",
  "filter",
]);

const INLINE_NORMALIZATION_PREPARATION_OPERATION_FRAGMENTS = [
  "normalize",
  "default",
  "fallback",
  "trim",
  "merge",
  "join",
  "split",
  "config",
  "header",
  "query",
];

const INLINE_NORMALIZATION_PREPARATION_BOUNDARY_CONTEXT_FRAGMENTS = [
  "config",
  "configuration",
  "request",
  "response",
  "payload",
  "query",
  "header",
  "context",
  "environment",
];

const INLINE_NORMALIZATION_PREPARATION_OUTPUT_TYPE_NAME_FRAGMENTS = [
  "model",
  "payload",
  "record",
  "config",
  "request",
  "response",
  "dto",
  "context",
];

const INLINE_NORMALIZATION_PREPARATION_DECISION_OUTPUT_FRAGMENTS = [
  "decision",
  "selection",
  "classification",
  "result",
  "outcome",
  "bool",
];

const INLINE_NORMALIZATION_PREPARATION_PARSER_FRAGMENTS = [
  "parse",
  "token",
  "lexer",
  "decode",
  "deserialize",
];

const INLINE_NORMALIZATION_PREPARATION_EXECUTION_FRAGMENTS = [
  "send",
  "fetch",
  "execute",
  "request",
  "stream",
  "write",
];

const INLINE_NORMALIZATION_PREPARATION_GATEWAY_CONTROL_FRAGMENTS = [
  "retry",
  "backoff",
  "wait",
  "paginate",
  "stream",
  "loop",
];

const EXCLUDED_GATEWAY_DECISION_CONTROL_NAME_FRAGMENTS = [
  "retry",
  "backoff",
  "schedule",
  "loop",
  "paginate",
  "stream",
  "continue",
];

const ALLOWED_DECISION_SUPPORT_OPERATION_NAMES = new Set([
  "contains",
  "isEmpty",
  "count",
  "allSatisfy",
  "first",
  "last",
  "map",
  "compactMap",
  "flatMap",
  "filter",
  "contains",
  "containsKey",
  "containsValue",
  "lowercased",
  "uppercased",
  "hasPrefix",
  "hasSuffix",
  "starts",
  "ends",
  "isCompatible",
  "matches",
  "supports",
  "allows",
]);

const COMPATIBILITY_INPUT_ROLE_FOLDERS = new Set<RoleFolder>([
  RoleFolder.ApplicationContractsCommands,
  RoleFolder.ApplicationContractsPorts,
  RoleFolder.ApplicationContractsWorkflow,
  RoleFolder.InfrastructureTranslationModels,
  RoleFolder.InfrastructureTranslationDTOs,
  RoleFolder.InfrastructureEvaluators,
]);

const DISPATCH_INPUT_ROLE_FOLDERS = new Set<RoleFolder>([
  RoleFolder.ApplicationContractsCommands,
  RoleFolder.ApplicationContractsPorts,
  RoleFolder.ApplicationContractsWorkflow,
  RoleFolder.InfrastructureTranslationModels,
  RoleFolder.InfrastructureTranslationDTOs,
  RoleFolder.InfrastructureEvaluators,
  RoleFolder.InfrastructureErrors,
]);

const SHAPED_TECHNICAL_ROLE_FOLDERS = new Set<RoleFolder>([
  RoleFolder.InfrastructureTranslationModels,
  RoleFolder.InfrastructureTranslationDTOs,
  RoleFolder.InfrastructureEvaluators,
  RoleFolder.InfrastructureErrors,
]);

const ALLOWED_INFRASTRUCTURE_ROLE_FOLDERS = new Set([
  "repositories",
  "gateways",
  "portadapters",
  "evaluators",
  "translation",
  "errors",
]);

const COMPATIBILITY_EVALUATION_OPERATION_NAMES = new Set([
  "contains",
  "hasPrefix",
  "hasSuffix",
  "matches",
  "supports",
  "allows",
  "isCompatible",
  "intersects",
]);

const DISALLOWED_GATEWAY_COMPATIBILITY_OPERATION_NAMES = new Set([
  "execute",
  "send",
  "fetch",
  "request",
  "stream",
  "write",
]);

const GATEWAY_COMPATIBILITY_CONTROL_FRAGMENTS = [
  "retry",
  "wait",
  "stream",
  "loop",
  "paginate",
];

const GATEWAY_INTERACTION_DISPATCH_CONTROL_NAME_FRAGMENTS = [
  "retry",
  "paginate",
  "stream",
  "loop",
  "while",
  "until",
];

const GATEWAY_BOUNDARY_EXECUTION_METHOD_NAME_FRAGMENTS = [
  "execute",
  "send",
  "fetch",
  "request",
  "stream",
  "write",
  "publish",
];

const BRANCH_BOUNDARY_WORK_OPERATION_NAME_FRAGMENTS = [
  "execute",
  "send",
  "fetch",
  "request",
  "response",
  "render",
  "publish",
];

const PARSER_TRANSLATION_SHAPE_KEYWORDS = ["Parser", "Lexer", "Tokenizer"];
const PARSER_MODEL_CARRIER_KEYWORDS = [
  "Node",
  "Expression",
  "Token",
  "AST",
  "Context",
  "Value",
];

const BOUNDARY_CONFIGURATION_OPERATION_NAMES = new Set([
  "headers",
  "query",
  "parameters",
  "options",
  "configuration",
  "config",
]);

const REQUEST_DEFINITION_SHAPE_SUFFIXES = [
  "RequestDefinition",
  "OperationDefinition",
  "RequestModel",
  "QueryModel",
];

const NESTED_INTERMEDIARY_TYPE_NAME_FRAGMENTS = [
  "model",
  "payload",
  "record",
  "context",
  "config",
  "requestdefinition",
  "operationdefinition",
];

const NESTED_INTERMEDIARY_MEMBER_NAME_FRAGMENTS = [
  "normalize",
  "config",
  "configuration",
  "requestdefinition",
  "startup",
  "launch",
  "context",
];

const NESTED_FINAL_BOUNDARY_MEMBER_NAME_FRAGMENTS = [
  "makerequest",
  "buildrequest",
  "tourlrequest",
  "requestbody",
  "requestheaders",
  "responseenvelope",
];
