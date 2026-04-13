import type { ArchitecturePolicyProtocol } from "../protocols/ArchitecturePolicyProtocol.ts";
import type { ArchitectureDiagnostic } from "../value-objects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../value-objects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../value-objects/ArchitectureLayer.ts";
import type { ArchitectureTopLevelDeclaration } from "../value-objects/ArchitectureTopLevelDeclaration.ts";
import type { ProjectContext } from "../value-objects/ProjectContext.ts";
import { NominalKind } from "../value-objects/NominalKind.ts";
import { RoleFolder } from "../value-objects/RoleFolder.ts";

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
          domainRemediationMessage(
            "Domain files must remain framework-free.",
            `Move import '${importOccurrence.moduleName}' usage out of ${file.repoRelativePath} into Presentation, App, or Infrastructure.`,
          ),
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

      const declaration = context.uniqueDeclaration(reference.name);
      if (!declaration || declaration.layer === ArchitectureLayer.Domain) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          DomainOuterLayerReferencePolicy.ruleID,
          domainRemediationMessage(
            "Domain files must not reference outer-layer types.",
            `Replace reference '${reference.name}' in ${file.repoRelativePath} with a Domain-owned abstraction or value type.`,
          ),
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
          domainRemediationMessage(
            "Domain files must live under the durable Domain folders.",
            `Place ${file.repoRelativePath} under Domain/Entities, Domain/ValueObjects, Domain/Policies, Domain/Protocols, or Domain/Errors.`,
          ),
        ),
      ];
    }

    const topLevelFolder = file.classification.pathComponents[nextIndex];
    if (topLevelFolder.endsWith(".ts")) {
      return [
        file.diagnostic(
          DomainDurableStructurePolicy.ruleID,
          domainRemediationMessage(
            "Domain files must live under the durable Domain folders.",
            `Move ${file.repoRelativePath} under Domain/Entities, Domain/ValueObjects, Domain/Policies, Domain/Protocols, or Domain/Errors.`,
          ),
        ),
      ];
    }

    if (this.allowedTopLevelFolders.has(topLevelFolder)) {
      return [];
    }

    return [
      file.diagnostic(
        DomainDurableStructurePolicy.ruleID,
        domainRemediationMessage(
          "This Domain file is under a non-durable folder.",
          `Move ${file.repoRelativePath} into Domain/Entities, Domain/ValueObjects, Domain/Policies, Domain/Protocols, or Domain/Errors.`,
        ),
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
          domainRemediationMessage(
            "Domain policy files must remain pure and must not use platform or I/O APIs.",
            `Move the logic that needs '${occurrence.name}' out of ${file.repoRelativePath} into an outer-layer collaborator.`,
          ),
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
          domainRemediationMessage(
            "Domain/Policies should expose concrete policy types, not protocols.",
            `Move protocol '${declaration.name}' from ${file.repoRelativePath} to Domain/Protocols.`,
          ),
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
          domainRemediationMessage(
            "Domain/Policies files must expose at least one policy-shaped top-level type.",
            `Add or rename a top-level policy type in ${file.repoRelativePath} so at least one declaration ends with 'Policy'.`,
          ),
        ),
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
          domainRemediationMessage(
            "Domain capability protocols should use role-revealing names ending in 'Protocol'.",
            `Rename '${declaration.name}' in ${file.repoRelativePath} to end in 'Protocol', or move it to a folder whose naming rules match its role.`,
          ),
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
          domainRemediationMessage(
            "Domain/Errors files should be dedicated to one structured error type per file.",
            `Split ${file.repoRelativePath} so each structured error type has its own file in Domain/Errors.`,
          ),
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
            domainRemediationMessage(
              "Domain/Errors should expose concrete structured error types, not protocols.",
              `Move protocol '${declaration.name}' out of ${file.repoRelativePath} or replace it with a concrete structured error type.`,
            ),
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
          domainRemediationMessage(
            "Domain/Errors files should expose structured error types with the expected naming and members.",
            `Define a structured error type in ${file.repoRelativePath} named SharedDomainError, <Feature>Error, or <Feature>DomainError.`,
          ),
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
          domainRemediationMessage(
            "Domain/Errors files should be named after the structured error type they contain.",
            `Rename ${file.repoRelativePath} to match the structured error type it contains, or rename the type to match the file.`,
          ),
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
            domainRemediationMessage(
              "Domain/Errors should expose correctly named structured error types.",
              `Rename or move '${declaration.name}' from ${file.repoRelativePath} so Domain/Errors contains only SharedDomainError, <Feature>Error, or <Feature>DomainError types.`,
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (!declaration.inheritedTypeNames.includes("StructuredErrorProtocol")) {
        diagnostics.push(
          file.diagnostic(
            DomainErrorsShapePolicy.ruleID,
            domainRemediationMessage(
              "Structured domain error types must conform to StructuredErrorProtocol.",
              `Add StructuredErrorProtocol conformance to '${declaration.name}' in ${file.repoRelativePath}.`,
            ),
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
            domainRemediationMessage(
              "Structured domain error types should expose the full required member set.",
              `Add the missing members to '${declaration.name}' in ${file.repoRelativePath}: ${missingMemberNames.join(", ")}.`,
            ),
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
          domainRemediationMessage(
            "Structured domain error types must live in Domain/Errors.",
            `Move '${declaration.name}' from ${file.repoRelativePath} into Domain/Errors.`,
          ),
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
          domainRemediationMessage(
            "Repository protocols belong in Domain/Protocols.",
            `Move '${declaration.name}' from ${file.repoRelativePath} to Domain/Protocols.`,
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export function makeDomainArchitecturePolicies(): readonly ArchitecturePolicyProtocol[] {
  return [
    new DomainForbiddenImportPolicy(),
    new DomainOuterLayerReferencePolicy(),
    new DomainDurableStructurePolicy(),
    new DomainPolicyPurityPolicy(),
    new DomainPolicyShapePolicy(),
    new DomainProtocolNamingPolicy(),
    new DomainErrorsShapePolicy(),
    new DomainErrorsPlacementPolicy(),
    new RepositoryProtocolPlacementPolicy(),
  ];
}

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

function domainRemediationMessage(summary: string, destination: string): string {
  return `${summary} Destination: ${destination}`;
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
