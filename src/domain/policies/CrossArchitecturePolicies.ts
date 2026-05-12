import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";
import { richRemediationMessage } from "./shared/RichRemediationMessage.ts";
import { endsWithTechnicalSeamSuffix } from "./shared/TechnicalSeamSuffixes.ts";

/**
 * `domain.dependency_resolution` — Domain files must not resolve dependencies
 * directly (service locators, dependency containers, singleton registries,
 * static dependency access, framework DI helpers, decorator-mediated
 * injection). Mirrors the Swift `DomainDependencyResolutionPolicy`; consumes
 * the `dependencyResolutionOccurrences` analyzer surface that Stage 2 added.
 */
export class DomainDependencyResolutionPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.dependency_resolution";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomain) {
      return [];
    }

    return file.dependencyResolutionOccurrences.map((occurrence) =>
      file.diagnostic(
        DomainDependencyResolutionPolicy.ruleID,
        domainDependencyResolutionMessage(file, occurrence),
        occurrence.coordinate,
      ),
    );
  }
}

/**
 * `architecture.service_role_placement` — top-level types whose name ends in
 * `Service` must live under `Application/Services` (or be classified as that
 * role); anywhere else is a misplacement. Skips test files. Mirrors the Swift
 * `ArchitectureServiceRolePlacementPolicy`.
 */
export class ArchitectureServiceRolePlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "architecture.service_role_placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.isTestFile) {
      return [];
    }
    if (file.classification.isApplicationServiceFile) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (!declaration.name.endsWith("Service")) {
        return [];
      }

      return [
        file.diagnostic(
          ArchitectureServiceRolePlacementPolicy.ruleID,
          serviceRolePlacementMessage(file, declaration.name),
          declaration.coordinate,
        ),
      ];
    });
  }
}

/**
 * `architecture.technical_seam_protocol_placement` — top-level
 * interface/protocol/type declarations whose name ends in a recognized
 * technical-seam suffix (`*Protocol`/`*Interface`/`*Port` variants for
 * Repository/Gateway/Client/Adapter/Provider/Port) must live under
 * `Application/Ports/Protocols` (Port-family suffixes) or `Domain/Protocols`
 * (Repository-family suffixes). All other placements are violations. Mirrors
 * the Swift `TechnicalSeamProtocolPlacementPolicy`, widened per `PARITY.md`
 * §4 T4 to accept `*Interface` and `*Port` family suffixes alongside the
 * Swift `*Protocol` form.
 */
export class TechnicalSeamProtocolPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "architecture.technical_seam_protocol_placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return file.topLevelDeclarations.flatMap((declaration) => {
      if (declaration.kind !== NominalKind.Protocol) {
        return [];
      }
      if (!endsWithTechnicalSeamSuffix(declaration.name)) {
        return [];
      }
      if (isValidTechnicalSeamPlacement(file, declaration.name)) {
        return [];
      }

      return [
        file.diagnostic(
          TechnicalSeamProtocolPlacementPolicy.ruleID,
          technicalSeamPlacementMessage(file, declaration.name),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export function makeCrossArchitecturePolicies(): readonly ArchitecturePolicyProtocol[] {
  return [
    new DomainDependencyResolutionPolicy(),
    new ArchitectureServiceRolePlacementPolicy(),
    new TechnicalSeamProtocolPlacementPolicy(),
  ];
}

const PORT_FAMILY_SUFFIXES = ["PortProtocol", "PortInterface", "Port"] as const;
const REPOSITORY_FAMILY_SUFFIXES = [
  "RepositoryProtocol",
  "RepositoryInterface",
  "RepositoryPort",
] as const;

function isValidTechnicalSeamPlacement(
  file: ArchitectureFile,
  declarationName: string,
): boolean {
  if (file.classification.roleFolder === RoleFolder.ApplicationPortsProtocols) {
    return PORT_FAMILY_SUFFIXES.some((suffix) => declarationName.endsWith(suffix));
  }
  if (file.classification.roleFolder === RoleFolder.DomainProtocols) {
    return REPOSITORY_FAMILY_SUFFIXES.some((suffix) =>
      declarationName.endsWith(suffix),
    );
  }
  return false;
}

function domainDependencyResolutionMessage(
  file: ArchitectureFile,
  occurrence: {
    readonly baseName: string;
    readonly memberName?: string;
    readonly coordinate: unknown;
  },
): string {
  const isDecorator = occurrence.memberName === undefined;
  const accessSummary = isDecorator
    ? `Offending dependency injection decorator: @${occurrence.baseName}.`
    : `Offending dependency access: ${occurrence.baseName}.${occurrence.memberName}.`;

  return richRemediationMessage({
    summary: `Domain file '${file.repoRelativePath}' resolves dependencies directly. ${accessSummary}`,
    categories: [
      "service locator or dependency container resolution",
      "static dependency registry access",
      "singleton dependency access on a Domain-owned type",
      isDecorator
        ? "decorator-mediated injection into a Domain class"
        : "framework DI helper invoked from Domain",
    ],
    signs: [
      "Container, ServiceLocator, DependencyContainer, Resolver, Registry, Injector, AppGraph, Dependencies, or DependencyValues is accessed inside a Domain file",
      "a static member such as .shared, .default, .live, .resolve, .get, .register, .make appears on a dependency-shaped type",
      "@Inject, @Injected, @Dependency, or @Provided is applied to a Domain class, value object, or member",
    ],
    architecturalNote:
      "Domain depends only on Domain and broadly allowed language built-ins; dependency containers and service locators are outer-layer wiring concerns.",
    destination:
      "App/DependencyInjection for resolution and Domain/Protocols or Application/Ports/Protocols for seams outside pure Domain behavior.",
    decomposition:
      "move dependency resolution to App/DependencyInjection, keep pure Domain behavior in Domain, and inject any needed collaborators through an appropriate inward protocol or interface outside Domain entities and value objects.",
  });
}

function serviceRolePlacementMessage(
  file: ArchitectureFile,
  declarationName: string,
): string {
  return richRemediationMessage({
    summary: `Top-level type '${declarationName}' ends in Service outside Application/Services at ${file.repoRelativePath}.`,
    categories: [
      "application workflow orchestrator placed outside Application/Services",
      "concrete boundary implementation mislabeled as a Service",
      "Presentation state, formatting, or pure Domain behavior mislabeled as a Service",
    ],
    signs: [
      "type sequences UseCases, makes workflow decisions, or coordinates operations",
      "IO, network, storage, vendor, runtime, fetch, Express, React/JSX, or browser behavior is labeled with a Service suffix",
      "Domain calculation, value-object behavior, or Presentation render/format state is labeled with a Service suffix",
    ],
    architecturalNote:
      "Application/Services is the only bucket that hosts the Service suffix; the suffix should immediately communicate workflow orchestration.",
    destination:
      "Application/Services for UseCase orchestration, Infrastructure for concrete IO with Repository/Gateway/Client/Adapter/Provider naming, Presentation for presentation state and formatting, or existing Domain role folders for pure Domain behavior.",
    decomposition: `If '${declarationName}' orchestrates UseCases, move it to Application/Services. If it performs concrete IO/network/storage/vendor behavior, move it to Infrastructure as a Repository, Gateway, Client, Adapter, or Provider per the existing naming conventions. If it holds presentation state or formatting, move it under Presentation. If it expresses pure Domain behavior, rename it according to existing Domain policy/value-type conventions rather than Service.`,
  });
}

function technicalSeamPlacementMessage(
  file: ArchitectureFile,
  declarationName: string,
): string {
  return richRemediationMessage({
    summary: `Technical seam '${declarationName}' is declared in ${file.repoRelativePath}.`,
    categories: [
      "application-facing seam declared in an outer layer",
      "technical seam declared in Domain when it belongs in Application/Ports/Protocols",
      "concrete Infrastructure implementation declaring its own outward-owned seam beside the implementation",
    ],
    signs: [
      "an interface or protocol-shaped declaration ending in RepositoryProtocol/Interface/Port, GatewayProtocol/Interface/Port, ClientProtocol/Interface/Port, AdapterProtocol/Interface/Port, ProviderProtocol/Interface/Port, PortProtocol, PortInterface, or Port appears outside its allowed inner protocol folder",
      "Infrastructure declares its own seam next to a concrete repository, gateway, client, adapter, or provider implementation rather than conforming to an inner-layer interface",
    ],
    architecturalNote:
      "Application seams are owned inward so UseCases can invoke them and Infrastructure can implement them; pure Domain abstractions remain valid in Domain/Protocols only when their name uses the Repository family (RepositoryProtocol/Interface/Port).",
    destination:
      "Application/Ports/Protocols for Port-family seams or Domain/Protocols for Repository-family seams.",
    decomposition: `Move '${declarationName}' to Application/Ports/Protocols when it represents an Application-facing port (PortProtocol/PortInterface/Port family), or to Domain/Protocols when it expresses a pure Domain repository abstraction (RepositoryProtocol/Interface/Port family); make Infrastructure conform to the inner-layer interface instead of declaring its own seam.`,
  });
}
