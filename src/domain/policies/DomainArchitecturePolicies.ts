import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import {
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  type ArchitectureLinterConfiguration,
} from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { SourceCoordinate } from "../ValueObjects/SourceCoordinate.ts";
import type { ArchitectureTopLevelDeclaration } from "../ValueObjects/ArchitectureTopLevelDeclaration.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";
import {
  richRemediationMessage,
  type RichRemediationMessageInput,
} from "./shared/RichRemediationMessage.ts";

export class DomainForbiddenImportPolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "domain.forbidden_import";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomain) {
      return [];
    }

    return file.imports.flatMap((importOccurrence) => {
      if (!DOMAIN_POLICY_FORBIDDEN_APIS.platformModules.has(importOccurrence.moduleName)) {
        return [];
      }

      return [
        file.diagnostic(
          DomainForbiddenImportPolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain file '${file.repoRelativePath}' imports the forbidden module '${importOccurrence.moduleName}'.`,
            categories: [
              "platform or framework import in Domain",
              "Node/browser/runtime API leaking into pure Domain code",
              "view-layer or transport-layer dependency embedded in Domain",
            ],
            signs: [
              `import statement names '${importOccurrence.moduleName}'`,
              "Domain file depends on node:fs, node:path, react, express, or an equivalent outer-layer module",
            ],
            architecturalNote:
              "Domain depends only on Domain and broadly allowed language built-ins; framework and platform modules belong in outer layers.",
            destination:
              "Presentation for view/render concerns, Infrastructure for IO/persistence/network/vendor concerns, or App for composition and runtime wiring.",
            decomposition: `Move the behavior that needs '${importOccurrence.moduleName}' out of ${file.repoRelativePath} into an outer-layer collaborator and depend on it through a Domain/Protocols or Application/Ports/Protocols interface.`,
          }),
          importOccurrence.coordinate,
        ),
      ];
    });
  }
}

export class DomainOuterLayerReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.outer_layer_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomain) {
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
        (candidate) => candidate.layer !== ArchitectureLayer.Domain,
      );
      if (!declaration) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          DomainOuterLayerReferencePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain file '${file.repoRelativePath}' references outer-layer type '${reference.name}' from ${declaration.repoRelativePath}.`,
            categories: [
              "outer-layer type leaked into Domain",
              "Application/Infrastructure/Presentation/App declaration referenced by a Domain entity, value object, or policy",
              "platform or transport type embedded in a Domain surface",
            ],
            signs: [
              `type reference '${reference.name}' resolves to a declaration in the ${describeLayer(declaration.layer)} layer`,
              "Domain code names a UseCase, Service, Controller, Gateway, DTO, View, or composition-root type directly",
            ],
            architecturalNote:
              "Domain depends only on Domain; outer-layer types are seen indirectly through inward-facing Domain/Protocols or Application/Ports/Protocols interfaces, never as direct dependencies.",
            destination:
              "Domain for the abstraction Domain actually needs; outer-layer concrete types remain in their owning layer.",
            decomposition: `Replace '${reference.name}' in ${file.repoRelativePath} with a Domain-owned value object, entity, policy, or Domain/Protocols interface, and let the outer-layer collaborator implement that interface from its own layer.`,
          }),
          reference.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class DomainDurableStructurePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.durable_structure";
  private readonly allowedTopLevelFolders = new Set([
    "Entities",
    "ValueObjects",
    "Policies",
    "Protocols",
    "Errors",
  ]);

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomain) {
      return [];
    }

    const domainIndex = file.classification.pathComponents.indexOf("Domain");
    if (domainIndex < 0) {
      return [];
    }

    const nextIndex = domainIndex + 1;
    if (nextIndex >= file.classification.pathComponents.length) {
      return [
        file.diagnostic(
          DomainDurableStructurePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain file '${file.repoRelativePath}' is not placed under a durable Domain role folder.`,
            categories: [
              "Domain file with no canonical role folder",
              "Domain source at the Domain root instead of a role-specific subfolder",
            ],
            signs: [
              "file path stops at Domain/ without continuing into a role folder",
              "the linter cannot assign a Domain role because no Entities/ValueObjects/Policies/Protocols/Errors child exists in the path",
            ],
            architecturalNote:
              "Domain is organized around explicit role folders so policies, entities, value objects, protocols, and errors stay visible to the architecture and to role-specific lint rules.",
            destination:
              "Domain/Entities for entities, Domain/ValueObjects for value types, Domain/Policies for pure decision logic, Domain/Protocols for inward interfaces, or Domain/Errors for structured error types.",
            decomposition: `Place ${file.repoRelativePath} under exactly one of Domain/Entities, Domain/ValueObjects, Domain/Policies, Domain/Protocols, or Domain/Errors based on its responsibility, and rename the file to match its canonical role.`,
          }),
        ),
      ];
    }

    const topLevelFolder = file.classification.pathComponents[nextIndex];
    if (topLevelFolder.endsWith(".ts")) {
      return [
        file.diagnostic(
          DomainDurableStructurePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain file '${file.repoRelativePath}' is placed directly under Domain/ instead of a durable Domain role folder.`,
            categories: [
              "Domain file living at the Domain/ root rather than a role subfolder",
              "missing role folder for an otherwise valid Domain file",
            ],
            signs: [
              "the segment immediately after Domain/ is a .ts file rather than a role folder name",
              "the linter cannot apply role-specific Domain rules because the file has no role classification",
            ],
            architecturalNote:
              "Domain role folders are how Domain types declare their responsibility; files at the Domain root hide that responsibility and bypass the role-specific lint rules.",
            destination:
              "Domain/Entities, Domain/ValueObjects, Domain/Policies, Domain/Protocols, or Domain/Errors.",
            decomposition: `Move ${file.repoRelativePath} under Domain/Entities, Domain/ValueObjects, Domain/Policies, Domain/Protocols, or Domain/Errors based on its responsibility, then rerun the linter so the role-specific Domain rules can validate the new location.`,
          }),
        ),
      ];
    }

    if (this.allowedTopLevelFolders.has(topLevelFolder)) {
      return [];
    }

    return [
      file.diagnostic(
        DomainDurableStructurePolicy.ruleID,
        domainRemediationMessage({
          summary: `Domain file '${file.repoRelativePath}' is placed under non-durable folder 'Domain/${topLevelFolder}'.`,
          categories: [
            "arbitrary Domain subfolder introduced instead of a canonical role",
            "ad-hoc taxonomy folder created around tooling or implementation detail",
            "misnamed folder duplicating an existing Domain role under different terminology",
          ],
          signs: [
            `the path segment immediately after Domain/ is '${topLevelFolder}', which is not one of Entities, ValueObjects, Policies, Protocols, or Errors`,
            "the file cannot be classified into a canonical Domain role",
          ],
          architecturalNote:
            "Only the five canonical Domain role folders are durable; arbitrary subfolders fragment ownership, hide responsibility, and bypass role-specific Domain rules.",
          destination:
            "Domain/Entities, Domain/ValueObjects, Domain/Policies, Domain/Protocols, or Domain/Errors.",
          decomposition: `Decide whether ${file.repoRelativePath} expresses an entity, value object, policy, inward protocol, or structured error and move it into the matching durable Domain folder; if the folder 'Domain/${topLevelFolder}' is no longer needed, remove it.`,
        }),
      ),
    ];
  }
}

export class DomainPolicyPurityPolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "domain.policy_forbidden_api";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isPolicyFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenNames = new Set<string>();

    for (const occurrence of file.identifierOccurrences) {
      if (
        !DOMAIN_POLICY_FORBIDDEN_APIS.platformTypes.has(occurrence.name) ||
        seenNames.has(occurrence.name)
      ) {
        continue;
      }

      seenNames.add(occurrence.name);
      diagnostics.push(
        file.diagnostic(
          DomainPolicyPurityPolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain policy file '${file.repoRelativePath}' references platform or I/O identifier '${occurrence.name}'.`,
            categories: [
              "platform/IO identifier used inside a Domain policy",
              "browser/Node runtime API embedded in pure Domain decision logic",
              "transport, storage, or environment access in a Domain policy",
            ],
            signs: [
              `identifier '${occurrence.name}' appears in a file under Domain/Policies`,
              "Domain policy references process, fetch, Buffer, window, document, localStorage, or an equivalent platform symbol",
            ],
            architecturalNote:
              "Domain policies are pure decision logic; platform and IO concerns belong in outer layers and are consumed through Domain/Protocols or Application/Ports/Protocols interfaces.",
            destination:
              "Infrastructure or App for platform/IO behavior; Domain/Protocols for the abstraction Domain policies depend on.",
            decomposition: `Move the behavior that uses '${occurrence.name}' out of ${file.repoRelativePath} into an Infrastructure or App collaborator and inject its inward interface into the policy through Domain/Protocols or Application/Ports/Protocols.`,
          }),
          occurrence.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class DomainPolicyShapePolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "domain.policy_shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.roleFolder !== RoleFolder.DomainPolicies) {
      return [];
    }

    const diagnostics = file.topLevelDeclarations.flatMap((declaration) => {
      if (declaration.kind !== NominalKind.Protocol) {
        return [];
      }

      return [
        file.diagnostic(
          DomainPolicyShapePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain/Policies file '${file.repoRelativePath}' declares protocol/interface '${declaration.name}' instead of a concrete policy.`,
            categories: [
              "abstraction declared in a Domain role that owns concrete decision logic",
              "missing inward protocol placement",
              "Domain/Policies file polluted with an interface declaration",
            ],
            signs: [
              `top-level interface '${declaration.name}' is declared under Domain/Policies`,
              "the file expresses an abstraction but lives in the concrete-policy role folder",
            ],
            architecturalNote:
              "Domain/Policies hosts concrete, pure decision logic; the inward abstractions Domain depends on live in Domain/Protocols.",
            destination: "Domain/Protocols for inward abstractions.",
            decomposition: `Move '${declaration.name}' from ${file.repoRelativePath} into Domain/Protocols, and keep ${file.repoRelativePath} for concrete policy types only.`,
          }),
          declaration.coordinate,
        ),
      ];
    });

    if (
      !file.topLevelDeclarations.some((declaration) =>
        declaration.name.endsWith("Policy"),
      )
    ) {
      diagnostics.push(
        file.diagnostic(
          DomainPolicyShapePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain/Policies file '${file.repoRelativePath}' does not expose a policy-shaped top-level type.`,
            categories: [
              "Domain/Policies file with no Policy-suffixed declaration",
              "decision logic with ambiguous role naming",
            ],
            signs: [
              "no top-level type in the file ends with 'Policy'",
              "the file is classified under Domain/Policies but its purpose is not immediately obvious from any declaration name",
            ],
            architecturalNote:
              "Domain/Policies files announce their responsibility through a Policy-suffixed declaration so collaborators and lint rules can identify them by name.",
            destination:
              "Domain/Policies with at least one *Policy declaration, or another Domain role folder if the file is not a policy after all.",
            decomposition: `Add or rename a top-level type in ${file.repoRelativePath} so its name ends with 'Policy'; if the file is not actually a policy, move it under the Domain role folder that matches its real responsibility (Domain/Entities, Domain/ValueObjects, Domain/Protocols, or Domain/Errors).`,
          }),
        ),
      );
    }

    return diagnostics;
  }
}

export class DomainPoliciesSinglePolicySurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.policies.single_policy_surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.roleFolder !== RoleFolder.DomainPolicies) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        declaration.kind === NominalKind.Protocol ||
        declaration.name.endsWith("Policy")
      ) {
        return [];
      }

      return [
        file.diagnostic(
          DomainPoliciesSinglePolicySurfacePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain/Policies file '${file.repoRelativePath}' declares non-policy top-level type '${declaration.name}'.`,
            categories: [
              "mutable runtime or process state riding along in a policy file",
              "decision-output value type misfiled outside Domain/ValueObjects",
              "platform or workflow taxonomy parked beside the policy that consumes it",
              "test instrumentation promoted into Domain",
              "private file-scoped computation helper declared beside the policy instead of nested within it",
            ],
            signs: [
              "a top-level declaration does not end with 'Policy'",
              "the file's Policy-suffixed namesake satisfies the policy shape rule while this declaration is never examined",
              "the type carries var state, mutating members, provenance or fixture vocabulary, or enum taxonomies consumed by outer layers",
            ],
            architecturalNote:
              "Domain/Policies holds stateless business deciders -- one concrete policy surface per file keeps the rules layer auditable, while runtime guards belong to the runtime that holds them, value and decision shapes belong in Domain/ValueObjects, and provider taxonomies belong in Application contracts.",
            destination:
              "Domain/ValueObjects for pure decision-output and input value types; App/Runtime as a private nested type of the consuming runtime for process-lifetime guards and memoizers; Application/Contracts/Workflow for availability and status taxonomies; the test target for fixture and benchmark types; nested inside the policy type for private computation helpers.",
            decomposition: `If '${declaration.name}' is a private computation helper, nest it inside the policy type; if it is a pure value the policy returns or consumes, move it to a matching Domain/ValueObjects file; if it carries mutable process state, move it into the runtime that uses it; if it is a provider or status taxonomy, move it to Application/Contracts; then update references and re-run the linter.`,
          }),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class DomainDeliveryVocabularyPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.delivery_vocabulary";
  private readonly deniedFragments: readonly string[];
  private readonly allowedIdentifiers: ReadonlySet<string>;

  constructor(
    configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {
    this.deniedFragments = [
      ...DOMAIN_DELIVERY_VOCABULARY_DENIED_FRAGMENTS,
      ...configuration.domainVocabularyDeniedFragments,
    ].map((fragment) => fragment.toLowerCase());
    this.allowedIdentifiers = new Set(
      configuration.domainVocabularyAllowedIdentifiers.map((identifier) =>
        identifier.toLowerCase(),
      ),
    );
  }

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomain) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenFragments = new Set<string>();
    const lowerIdentifiers = new Set(
      file.identifierOccurrences.map((occurrence) =>
        occurrence.name.toLowerCase(),
      ),
    );

    for (const occurrence of file.identifierOccurrences) {
      const lowerName = occurrence.name.toLowerCase();
      if (this.allowedIdentifiers.has(lowerName)) {
        continue;
      }

      const fragment = this.deniedFragments.find((candidate) =>
        lowerName.includes(candidate),
      );
      if (!fragment || seenFragments.has(fragment)) {
        continue;
      }

      seenFragments.add(fragment);
      diagnostics.push(
        domainDeliveryVocabularyDiagnostic(
          file,
          occurrence.name,
          fragment,
          occurrence.coordinate,
        ),
      );
    }

    if (
      lowerIdentifiers.has("provisional") &&
      lowerIdentifiers.has("ephemeral") &&
      !seenFragments.has("unauthorizationstatus")
    ) {
      diagnostics.push(
        domainDeliveryVocabularyDiagnostic(
          file,
          "provisional+ephemeral",
          "unauthorizationstatus",
          { line: 1, column: 1 },
        ),
      );
    }

    return diagnostics;
  }
}

export class DomainOuterArtifactStringLiteralsPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.outer_artifact_string_literals";
  private readonly fragments: readonly string[];

  constructor(
    configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {
    this.fragments = [
      ...DOMAIN_OUTER_ARTIFACT_STRING_LITERAL_FRAGMENTS,
      ...configuration.domainOuterArtifactFragments,
      ...configuration.storageNamespacePrefixes,
    ].map((fragment) => fragment.toLowerCase());
  }

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomain || file.classification.isDomainErrorFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenFragments = new Set<string>();
    const seenValues = new Set<string>();

    for (const occurrence of file.stringLiteralOccurrences) {
      const value = occurrence.value;
      const lowerValue = value.toLowerCase();
      const fragment = this.fragments.find((candidate) =>
        lowerValue.includes(candidate),
      );

      if (fragment) {
        if (seenFragments.has(fragment)) {
          continue;
        }

        seenFragments.add(fragment);
        diagnostics.push(
          domainOuterArtifactDiagnostic(file, value, occurrence.coordinate),
        );
        continue;
      }

      if (
        !DOMAIN_OUTER_ARTIFACT_DOTTED_KEY_PATTERN.test(value) ||
        seenValues.has(value)
      ) {
        continue;
      }

      seenValues.add(value);
      diagnostics.push(
        domainOuterArtifactDiagnostic(file, value, occurrence.coordinate),
      );
    }

    return diagnostics;
  }
}

export class DomainProtocolNamingPolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "domain.protocol_naming";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.roleFolder !== RoleFolder.DomainProtocols) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        declaration.kind !== NominalKind.Protocol ||
        isRepositoryProtocolName(declaration.name) ||
        declaration.name.endsWith("Protocol")
      ) {
        return [];
      }

      return [
        file.diagnostic(
          DomainProtocolNamingPolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain/Protocols file '${file.repoRelativePath}' declares interface '${declaration.name}' without a role-revealing 'Protocol' or repository-protocol suffix.`,
            categories: [
              "inward abstraction with ambiguous role naming",
              "Domain/Protocols interface missing the 'Protocol' suffix that signals its role",
            ],
            signs: [
              `interface '${declaration.name}' is declared under Domain/Protocols`,
              "the name does not end with 'Protocol' and is not a recognized repository-protocol family suffix",
            ],
            architecturalNote:
              "Domain capability interfaces communicate their role through their name; outer-layer implementers and lint rules locate them by the 'Protocol' suffix.",
            destination:
              "Domain/Protocols for capability interfaces; the name should end with 'Protocol' (e.g. NotifierProtocol) or a recognized repository-protocol suffix (e.g. OrdersRepositoryProtocol).",
            decomposition: `Rename '${declaration.name}' in ${file.repoRelativePath} to end with 'Protocol', or, if the declaration is not actually a capability interface, move it to the Domain role folder whose naming rules match its real role.`,
          }),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class DomainErrorsShapePolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "domain.errors.shape";
  static readonly surfaceRuleID = "domain.errors.surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomainErrorFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const concreteDeclarations = file.topLevelDeclarations.filter(
      (declaration) => declaration.kind !== NominalKind.Protocol,
    );
    const fileBaseName = structuredErrorFileBaseName(file.repoRelativePath);

    if (concreteDeclarations.length > 1) {
      diagnostics.push(
        file.diagnostic(
          DomainErrorsShapePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain/Errors file '${file.repoRelativePath}' declares more than one concrete top-level type.`,
            categories: [
              "multiple structured error types in a single file",
              "Domain/Errors file mixing more than one error responsibility",
            ],
            signs: [
              `${concreteDeclarations.length} concrete top-level declarations live in ${file.repoRelativePath}`,
              "Domain/Errors files normally own exactly one structured error type",
            ],
            architecturalNote:
              "Domain/Errors keeps one structured error type per file so the file name documents the error type and lint rules can match file ↔ type one-to-one.",
            destination:
              "Domain/Errors with exactly one structured error type per file.",
            decomposition: `Split ${file.repoRelativePath} so each structured error type lives in its own file under Domain/Errors, renaming each file to match its single error type.`,
          }),
        ),
      );
    }

    diagnostics.push(
      ...file.topLevelDeclarations.flatMap((declaration) => {
        if (declaration.kind !== NominalKind.Protocol) {
          return [];
        }

        return [
          file.diagnostic(
            DomainErrorsShapePolicy.ruleID,
            domainRemediationMessage({
              summary: `Domain/Errors file '${file.repoRelativePath}' declares protocol/interface '${declaration.name}' instead of a concrete structured error type.`,
              categories: [
                "abstraction declared in a Domain role that owns concrete error types",
                "interface placed under Domain/Errors instead of Domain/Protocols",
              ],
              signs: [
                `top-level interface '${declaration.name}' is declared under Domain/Errors`,
                "the file expresses an abstraction but lives in the concrete-error role folder",
              ],
              architecturalNote:
                "Domain/Errors hosts concrete structured error types; inward abstractions like StructuredErrorProtocol live in Domain/Protocols.",
              destination:
                "Domain/Protocols for inward error-shape abstractions, or replace '${declaration.name}' with a concrete structured error type in Domain/Errors.",
              decomposition: `Either replace '${declaration.name}' with a concrete structured error type in ${file.repoRelativePath}, or move the interface to Domain/Protocols and keep Domain/Errors for concrete error types only.`,
            }),
            declaration.coordinate,
          ),
        ];
      }),
    );

    const structuredErrorDeclarations = concreteDeclarations.filter((declaration) =>
      isStructuredDomainErrorDeclaration(declaration),
    );

    if (structuredErrorDeclarations.length === 0) {
      diagnostics.push(
        file.diagnostic(
          DomainErrorsShapePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain/Errors file '${file.repoRelativePath}' does not expose a structured error type.`,
            categories: [
              "Domain/Errors file with no recognized structured error declaration",
              "concrete error declaration with unexpected naming",
              "structured error without the required member set",
            ],
            signs: [
              "no top-level type in the file is named SharedDomainError, <Feature>Error, or <Feature>DomainError",
              "no declaration inherits StructuredErrorProtocol/Error/LocalizedError",
              "no declaration exposes the required structured-error members (code, message, retryable, details)",
            ],
            architecturalNote:
              "Domain/Errors files announce their error type through both name and member shape so consumers and lint rules can identify the structured error contract.",
            destination:
              "Domain/Errors containing a structured error declared with conventional naming and the canonical member set.",
            decomposition: `Define a structured error type in ${file.repoRelativePath} named SharedDomainError, <Feature>Error, or <Feature>DomainError, conforming to StructuredErrorProtocol and exposing code, message, retryable, and details members.`,
          }),
        ),
      );
      diagnostics.push(
        ...structuredErrorSurfaceDiagnostics(
          file,
          DomainErrorsShapePolicy.surfaceRuleID,
          "Domain/Errors",
          STRUCTURED_ERROR_FORBIDDEN_SURFACE_TERMS,
        ),
      );
      return diagnostics;
    }

    if (!structuredErrorDeclarations.some((declaration) => declaration.name === fileBaseName)) {
      diagnostics.push(
        file.diagnostic(
          DomainErrorsShapePolicy.ruleID,
          domainRemediationMessage({
            summary: `Domain/Errors file '${file.repoRelativePath}' name does not match any structured error type it declares.`,
            categories: [
              "file/type name mismatch in Domain/Errors",
              "ambiguous error file naming",
            ],
            signs: [
              `file base name '${fileBaseName}' does not match any structured error type declared in the file`,
              "file ↔ type one-to-one convention is broken inside Domain/Errors",
            ],
            architecturalNote:
              "Domain/Errors uses file ↔ type one-to-one naming so the file name documents the error type and lint rules can locate the type by file path alone.",
            destination:
              "Domain/Errors with the file name and primary structured error type name matching.",
            decomposition: `Rename ${file.repoRelativePath} to match the structured error type it declares, or rename the type to match the file base name.`,
          }),
        ),
      );
    }

    for (const declaration of concreteDeclarations) {
      const namingMatches =
        declaration.name === "SharedDomainError" ||
        declaration.name.endsWith("DomainError") ||
        declaration.name.endsWith("Error");
      const isStructuredError =
        namingMatches ||
        declaration.inheritedTypeNames.includes("StructuredErrorProtocol") ||
        declaration.inheritedTypeNames.includes("Error") ||
        declaration.inheritedTypeNames.includes("LocalizedError") ||
        isSubset(
          STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES,
          new Set(declaration.memberNames),
        );

      if (!namingMatches && !isStructuredError) {
        diagnostics.push(
          file.diagnostic(
            DomainErrorsShapePolicy.ruleID,
            domainRemediationMessage({
              summary: `Domain/Errors file '${file.repoRelativePath}' declares '${declaration.name}', which does not follow the structured-error naming convention.`,
              categories: [
                "structured error with ambiguous naming",
                "non-error type placed under Domain/Errors",
              ],
              signs: [
                `declaration '${declaration.name}' is neither SharedDomainError, <Feature>Error, nor <Feature>DomainError`,
                "the declaration does not inherit StructuredErrorProtocol/Error/LocalizedError",
                "Domain/Errors hosts the type but its name does not announce that it is an error",
              ],
              architecturalNote:
                "Domain/Errors is reserved for structured error types whose name communicates the role; other types belong in other Domain role folders.",
              destination:
                "Domain/Errors only for structured errors named SharedDomainError, <Feature>Error, or <Feature>DomainError; other Domain role folders for non-error types.",
              decomposition: `Rename '${declaration.name}' in ${file.repoRelativePath} to follow the structured-error naming convention, or move it to the Domain role folder whose naming rules match its real role.`,
            }),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (!declaration.inheritedTypeNames.includes("StructuredErrorProtocol")) {
        diagnostics.push(
          file.diagnostic(
            DomainErrorsShapePolicy.ruleID,
            domainRemediationMessage({
              summary: `Structured error '${declaration.name}' in ${file.repoRelativePath} does not conform to StructuredErrorProtocol.`,
              categories: [
                "structured error missing the canonical inward conformance",
                "Domain error declared without the shared protocol contract",
              ],
              signs: [
                `'${declaration.name}' looks like a structured Domain error but does not list StructuredErrorProtocol in its inherited types`,
                "consumers cannot rely on the shared structured-error contract for '${declaration.name}'",
              ],
              architecturalNote:
                "Structured Domain errors conform to StructuredErrorProtocol so consumers can read the canonical members through a single inward interface.",
              destination:
                "Domain/Errors with each structured error implementing StructuredErrorProtocol.",
              decomposition: `Add StructuredErrorProtocol conformance to '${declaration.name}' in ${file.repoRelativePath} (extends/implements clause), and ensure the canonical members are exposed.`,
            }),
            declaration.coordinate,
          ),
        );
      }

      const memberNames = new Set(declaration.memberNames);
      const missingMemberNames = [...STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES].filter(
        (memberName) => !memberNames.has(memberName),
      );
      if (missingMemberNames.length > 0) {
        diagnostics.push(
          file.diagnostic(
            DomainErrorsShapePolicy.ruleID,
            domainRemediationMessage({
              summary: `Structured error '${declaration.name}' in ${file.repoRelativePath} is missing required members: ${missingMemberNames.join(", ")}.`,
              categories: [
                "incomplete structured error surface",
                "missing canonical structured-error members",
              ],
              signs: [
                `'${declaration.name}' does not declare: ${missingMemberNames.join(", ")}`,
                "consumers cannot rely on the canonical structured-error member set for this error",
              ],
              architecturalNote:
                "Structured Domain errors expose code, message, retryable, and details so collaborators have a stable contract for diagnostics and retries.",
              destination:
                "Domain/Errors with each structured error declaring the full canonical member set.",
              decomposition: `Add the missing members to '${declaration.name}' in ${file.repoRelativePath}: ${missingMemberNames.join(", ")}.`,
            }),
            declaration.coordinate,
          ),
        );
      }
    }

    diagnostics.push(
      ...structuredErrorSurfaceDiagnostics(
        file,
        DomainErrorsShapePolicy.surfaceRuleID,
        "Domain/Errors",
        STRUCTURED_ERROR_FORBIDDEN_SURFACE_TERMS,
      ),
    );

    return diagnostics;
  }
}

export class DomainErrorsPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.errors.placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isDomain || file.classification.isDomainErrorFile) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        declaration.kind === NominalKind.Protocol ||
        !isStructuredDomainErrorDeclaration(declaration)
      ) {
        return [];
      }

      return [
        file.diagnostic(
          DomainErrorsPlacementPolicy.ruleID,
          domainRemediationMessage({
            summary: `Structured Domain error '${declaration.name}' is declared in ${file.repoRelativePath} instead of Domain/Errors.`,
            categories: [
              "structured error declared outside Domain/Errors",
              "Domain error mixed into Entities, ValueObjects, Policies, or Protocols",
            ],
            signs: [
              `'${declaration.name}' matches the structured-error shape (naming or inherited types) but lives outside Domain/Errors`,
              "Domain/Errors should host every structured error so consumers and lint rules can locate them by path",
            ],
            architecturalNote:
              "Domain organizes structured errors in a dedicated role folder so error ownership and lint coverage stay obvious.",
            destination:
              "Domain/Errors with one file per structured error type.",
            decomposition: `Move '${declaration.name}' from ${file.repoRelativePath} into Domain/Errors, with a file name that matches the structured error type.`,
          }),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class RepositoryProtocolPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "domain.repository_protocol_placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        declaration.kind !== NominalKind.Protocol ||
        !isRepositoryLikeName(declaration.name)
      ) {
        return [];
      }

      if (
        file.classification.isDomain &&
        file.classification.roleFolder === RoleFolder.DomainProtocols
      ) {
        return [];
      }

      return [
        file.diagnostic(
          RepositoryProtocolPlacementPolicy.ruleID,
          domainRemediationMessage({
            summary: `Repository protocol '${declaration.name}' is declared in ${file.repoRelativePath} instead of Domain/Protocols.`,
            categories: [
              "repository protocol declared outside Domain/Protocols",
              "inward repository abstraction misplaced in Application, Infrastructure, or Presentation",
            ],
            signs: [
              `interface '${declaration.name}' ends with 'Repository' or 'RepositoryProtocol' but the file is not under Domain/Protocols`,
              "the repository abstraction is co-located with concrete implementations or with unrelated layers",
            ],
            architecturalNote:
              "Repository abstractions belong inward in Domain/Protocols so UseCases can depend on them and Infrastructure can conform from the outside.",
            destination:
              "Domain/Protocols for repository abstractions.",
            decomposition: `Move '${declaration.name}' from ${file.repoRelativePath} into Domain/Protocols, and make Infrastructure repository implementations conform to it from there.`,
          }),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export function makeDomainArchitecturePolicies(
  configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
): readonly ArchitecturePolicyProtocol[] {
  return [
    new DomainForbiddenImportPolicy(),
    new DomainOuterLayerReferencePolicy(),
    new DomainDurableStructurePolicy(),
    new DomainPolicyPurityPolicy(),
    new DomainPolicyShapePolicy(),
    new DomainPoliciesSinglePolicySurfacePolicy(),
    new DomainDeliveryVocabularyPolicy(configuration),
    new DomainOuterArtifactStringLiteralsPolicy(configuration),
    new DomainProtocolNamingPolicy(),
    new DomainErrorsShapePolicy(),
    new DomainErrorsPlacementPolicy(),
    new RepositoryProtocolPlacementPolicy(),
  ];
}

const DOMAIN_DELIVERY_VOCABULARY_DENIED_FRAGMENTS = [
  "backgroundrefresh",
  "runtimestate",
  "relaunch",
  "prewarm",
  "contextwindow",
  "debounce",
  "launchguard",
  "fixture",
  "fake",
  "mock",
  "testharness",
  "storybook",
  "playwright",
  "cypress",
  "vitest",
  "jest",
  "confetti",
  "presentationstyle",
  "systemimagename",
  "viewmodel",
  "reactnode",
  "jsxelement",
  "componentprops",
  "renderstate",
  "cssclass",
  "appleintelligence",
  "firebase",
  "supabase",
  "stripe",
  "cloudflare",
  "s3bucket",
  "localstorage",
  "sessionstorage",
  "indexeddb",
  "serviceworker",
  "webworker",
  "websocket",
  "postmessage",
  "domnode",
  "htmlelement",
  "hydrationstate",
  "runtimecache",
] as const;

const DOMAIN_OUTER_ARTIFACT_STRING_LITERAL_FRAGMENTS = [
  "storage key",
  "launch argument",
  "debug description",
  "diagnostic",
  "route.",
  "os backup",
  "app group",
  "privacy nutrition label",
  "cloud account",
] as const;

const DOMAIN_OUTER_ARTIFACT_DOTTED_KEY_PATTERN =
  /^[a-z0-9_-]+(\.[a-z0-9_-]+){2,}$/;

const DOMAIN_POLICY_FORBIDDEN_APIS = {
  platformModules: new Set(["node:fs", "node:path", "react", "express"]),
  platformTypes: new Set([
    "process",
    "fetch",
    "Buffer",
    "window",
    "document",
    "localStorage",
  ]),
};

const STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES = new Set([
  "code",
  "message",
  "retryable",
  "details",
]);

const STRUCTURED_ERROR_FORBIDDEN_SURFACE_TERMS = new Set([
  "codex",
  "github",
  "gitlab",
  "jira",
  "linear",
  "openai",
  "workflow.md",
]);

function domainRemediationMessage(input: RichRemediationMessageInput): string {
  return richRemediationMessage(input);
}

function describeLayer(layer: ArchitectureLayer): string {
  switch (layer) {
    case ArchitectureLayer.Application:
      return "Application";
    case ArchitectureLayer.Infrastructure:
      return "Infrastructure";
    case ArchitectureLayer.Presentation:
      return "Presentation";
    case ArchitectureLayer.App:
      return "App";
    case ArchitectureLayer.Domain:
      return "Domain";
    default:
      return String(layer);
  }
}

function structuredErrorFileBaseName(repoRelativePath: string): string {
  const fileName = repoRelativePath.split("/").at(-1) ?? repoRelativePath;
  return fileName.endsWith(".ts")
    ? fileName.replace(/\.[^.]+$/, "")
    : fileName;
}

function isStructuredDomainErrorDeclaration(
  declaration: ArchitectureTopLevelDeclaration,
): boolean {
  return (
    declaration.name === "SharedDomainError" ||
    declaration.name.endsWith("DomainError") ||
    declaration.name.endsWith("Error") ||
    declaration.inheritedTypeNames.includes("StructuredErrorProtocol") ||
    declaration.inheritedTypeNames.includes("Error") ||
    declaration.inheritedTypeNames.includes("LocalizedError") ||
    isSubset(
      STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES,
      new Set(declaration.memberNames),
    )
  );
}

function structuredErrorSurfaceDiagnostics(
  file: ArchitectureFile,
  ruleID: string,
  rolePath: string,
  forbiddenTerms: ReadonlySet<string>,
): readonly ArchitectureDiagnostic[] {
  const hasStructuredErrorType = file.topLevelDeclarations.some(
    (declaration) =>
      declaration.kind !== NominalKind.Protocol &&
      (declaration.inheritedTypeNames.includes("StructuredErrorProtocol") ||
        declaration.inheritedTypeNames.includes("Error") ||
        declaration.inheritedTypeNames.includes("LocalizedError") ||
        isSubset(
          STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES,
          new Set(declaration.memberNames),
        )),
  );
  if (!hasStructuredErrorType) {
    return [];
  }

  const diagnostics: ArchitectureDiagnostic[] = [];
  const seenTerms = new Set<string>();

  for (const occurrence of file.identifierOccurrences) {
    const normalizedName = occurrence.name.toLowerCase();
    if (!forbiddenTerms.has(normalizedName) || seenTerms.has(normalizedName)) {
      continue;
    }
    seenTerms.add(normalizedName);
    diagnostics.push(
      file.diagnostic(
        ruleID,
        `${rolePath} structured errors must stay transport agnostic and must not use provider or other boundary vocabulary; remove '${occurrence.name}'.`,
        occurrence.coordinate,
      ),
    );
  }

  for (const occurrence of file.stringLiteralOccurrences) {
    const normalizedValue = occurrence.value.toLowerCase();
    const matchedTerm = [...forbiddenTerms].find((term) =>
      normalizedValue.includes(term),
    );
    if (!matchedTerm || seenTerms.has(matchedTerm)) {
      continue;
    }
    seenTerms.add(matchedTerm);
    diagnostics.push(
      file.diagnostic(
        ruleID,
        `${rolePath} structured errors must stay transport agnostic and must not use provider or other boundary vocabulary; remove '${matchedTerm}'.`,
        occurrence.coordinate,
      ),
    );
  }

  return diagnostics;
}

function isRepositoryLikeName(name: string): boolean {
  return isRepositoryProtocolName(name) || name.endsWith("Repository");
}

function isRepositoryProtocolName(name: string): boolean {
  return name.endsWith("RepositoryProtocol");
}

function isSubset<T>(subset: ReadonlySet<T>, superset: ReadonlySet<T>): boolean {
  return [...subset].every((value) => superset.has(value));
}

function domainDeliveryVocabularyDiagnostic(
  file: ArchitectureFile,
  identifier: string,
  fragment: string,
  coordinate: SourceCoordinate,
): ArchitectureDiagnostic {
  return file.diagnostic(
    DomainDeliveryVocabularyPolicy.ruleID,
    domainRemediationMessage({
      summary: `Domain file '${file.repoRelativePath}' uses delivery-mechanism vocabulary '${identifier}' (matched fragment '${fragment}').`,
      categories: [
        "scheduler, browser, or runtime concept modeled in Domain",
        "platform or vendor SDK taxonomy mirrored into a Domain type",
        "test-harness or QA instrumentation vocabulary in the enterprise-rules layer",
        "UI rendering decision encoded as Domain data",
      ],
      signs: [
        "identifier matches a known delivery, platform, vendor, presentation, runtime, fixture, or test-harness fragment",
        "the file can be import-clean while still leaking outer-layer meaning through names",
      ],
      architecturalNote:
        "Dependency direction of meaning matters as much as compile-time direction: when a browser API, runtime, vendor SDK, test harness, or rendering engine names a Domain concept, changing that delivery mechanism forces Domain edits and weakens the Domain language even though imports stay clean.",
      destination:
        "App/Runtime for process and scheduling state; Application/Contracts for provider availability taxonomies that adapters map into; the test target for fixture and harness vocabulary; Presentation for rendering decisions; Domain keeps only the problem-space decision semantics.",
      decomposition: `Identify what business decision '${identifier}' represents, rename the Domain concept in problem-space vocabulary, move the delivery-specific remainder to the layer that owns that mechanism, update boundary mapping code, and re-run the linter.`,
    }),
    coordinate,
  );
}

function domainOuterArtifactDiagnostic(
  file: ArchitectureFile,
  value: string,
  coordinate: SourceCoordinate,
): ArchitectureDiagnostic {
  return file.diagnostic(
    DomainOuterArtifactStringLiteralsPolicy.ruleID,
    domainRemediationMessage({
      summary: `Domain file '${file.repoRelativePath}' embeds outer-layer artifact text in string literal '${value}'.`,
      categories: [
        "platform or compliance vocabulary hard-coded as Domain sentences",
        "storage or route namespace known to the innermost layer",
        "localization-catalog key chosen by Domain instead of Presentation",
        "stringly-typed cross-layer contract consumed by exact sentence identity",
      ],
      signs: [
        "literal contains an outer-artifact fragment (storage key, launch argument, route or storage namespace, OS backup, App Group, privacy nutrition label, cloud account) or wholly matches a 3+-segment dotted localization-key shape",
        "outer layers compare or render the literal verbatim, so rewording the Domain string silently changes workflow or UI behavior",
      ],
      architecturalNote:
        "Domain must not know the names of delivery artifacts -- route prefixes, storage namespaces, compliance terms, or resource-catalog keys -- because renaming any of them then requires Domain edits, and exact-match string filtering across layers is an untested silent-behavior-change hazard.",
      destination:
        "Application/Contracts/Workflow for claim and redaction taxonomies modeled as enums with raw values, not sentences; Presentation for mapping Domain outcome values to localization keys; App/Configuration for namespace constants.",
      decomposition:
        "Replace sentence-identity claims with a Domain enum, move human-readable wording to the rendering layer, move namespace and artifact-name constants to the owning outer layer, and pass values into Domain only where Domain logic genuinely needs them.",
    }),
    coordinate,
  );
}
