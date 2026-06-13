import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { ArchitectureLinterConfiguration } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";
import type { SourceCoordinate } from "../ValueObjects/SourceCoordinate.ts";
import { richRemediationMessage } from "./shared/RichRemediationMessage.ts";

export class ArchitectureDisabledRuleVisibilityPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "architecture.disabled_rule_visibility";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration =
      DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    private readonly registeredRuleIDs: readonly string[] = [],
  ) {}

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    const matchedIDs = this.registeredRuleIDs
      .filter((ruleID) =>
        this.configuration.disabledRulePrefixes.some((prefix) =>
          ruleID.startsWith(prefix),
        ),
      )
      .sort();
    const anchorPath = disabledRuleVisibilityAnchorPath(context);

    if (matchedIDs.length === 0 || file.repoRelativePath !== anchorPath) {
      return [];
    }

    const prefixes = [...this.configuration.disabledRulePrefixes].sort().join(", ");
    const expanded = matchedIDs.join(", ");

    return [
      file.diagnostic(
        ArchitectureDisabledRuleVisibilityPolicy.ruleID,
        richRemediationMessage({
          summary: `Linter configuration silently disables ${matchedIDs.length} of ${this.registeredRuleIDs.length} registered rules via disabledRulePrefixes ${prefixes}; suppressed coverage must be visible and intentional.`,
          categories: [
            "wholesale rule-family disablement left over from a migration",
            "enforcement gap invisible in linter output",
            "prefix entry that silently widens as new rules join the family",
          ],
          signs: [
            "the configuration contains a non-empty disabledRulePrefixes entry",
            `the expanded prefix currently matches these registered rules: ${expanded}`,
            "a green exit-0 run is indistinguishable from a fully-enforced one",
          ],
          architecturalNote:
            "disabling enforcement is sometimes legitimate but must be loud, scoped, and enumerable -- a prefix is an open-ended wildcard that also disables every future rule sharing the prefix, so the disabled set grows without any config change or review.",
          destination: `the linter configuration file -- replace each disabledRulePrefixes entry with the explicit list of ruleIDs in disabledRuleIDs (currently: ${expanded}), so every suppressed rule is an individually reviewable line in version control.`,
          decomposition:
            "1) run the linter with the prefix removed to see the suppressed diagnostics and confirm the disablement is still wanted; 2) for rules the team intends to adopt, fix the findings instead of suppressing; 3) for the remainder, move each ruleID into disabledRuleIDs explicitly and delete the prefix entry; 4) if the whole-family suppression is a permanent decision, record it by explicitly disabling this rule's ID as well; 5) re-run the linter and confirm this diagnostic no longer appears.",
        }),
        { line: 1, column: 1 },
      ),
    ];
  }
}

export class ArchitectureUnclassifiedSourcePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "architecture.unclassified_source";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      file.classification.layer !== ArchitectureLayer.Other ||
      file.classification.isTestFile ||
      isProjectManifestOrConfigFile(file)
    ) {
      return [];
    }

    return [
      file.diagnostic(
        ArchitectureUnclassifiedSourcePolicy.ruleID,
        richRemediationMessage({
          summary: `Source file '${file.repoRelativePath}' classifies as layer 'other' with no role folder, so no layer, shape, or boundary rule can evaluate it.`,
          categories: [
            "app-extension or auxiliary source root outside the layered source tree",
            "duplicated Domain/Application logic forked into an unlinted target",
            "dead template scaffolding shipped without review",
          ],
          signs: [
            "no path component equals a recognized layer folder and the path matches no configured source-root entry",
            "the classifier assigned layer 'other' and RoleFolder 'none'",
            "the file is parsed by discovery but matched by zero layer-gated policies",
          ],
          architecturalNote:
            "every executable source file must belong to a layer with enforceable boundaries -- an unclassified source root is a standing escape hatch where policy, persistence access, and UI can drift silently and fork from their canonical copies.",
          destination:
            "bring the file under a classified root -- either share the canonical source from its owning layer folder, or configure the source-root layout and layer names so the file classifies into the layer that owns it.",
          decomposition:
            "1) decide which layer the file belongs to; 2) for duplicated types, delete the fork and use the canonical layered file; 3) for files that genuinely live in an extra root, update the linter configuration so that root classifies into the owning layer; 4) re-run the linter and fix any boundary violations the newly classified files reveal.",
        }),
        primaryDiagnosticCoordinate(file),
      ),
    ];
  }
}

export class ArchitectureUnknownRoleSubdirectoryPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "architecture.unknown_role_subdirectory";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      ![
        ArchitectureLayer.Application,
        ArchitectureLayer.Presentation,
        ArchitectureLayer.App,
      ].includes(file.classification.layer) ||
      file.classification.roleFolder !== RoleFolder.None
    ) {
      return [];
    }

    const folder = unknownRoleFolderName(file) ?? "unknown";
    const isApplicationPolicies =
      file.classification.layer === ArchitectureLayer.Application &&
      folder === "Policies";

    return [
      file.diagnostic(
        ArchitectureUnknownRoleSubdirectoryPolicy.ruleID,
        isApplicationPolicies
          ? applicationPoliciesUnknownRoleMessage(file, folder)
          : genericUnknownRoleMessage(file, folder),
        primaryDiagnosticCoordinate(file),
      ),
    ];
  }
}

function disabledRuleVisibilityAnchorPath(
  context: ProjectContext,
): string | undefined {
  const appDependencyInjectionPath = sortedDeclarationPath(
    context,
    (declaration) =>
      declaration.roleFolder === RoleFolder.AppDependencyInjection,
  );
  if (appDependencyInjectionPath) {
    return appDependencyInjectionPath;
  }

  const appPath = sortedDeclarationPath(
    context,
    (declaration) => declaration.layer === ArchitectureLayer.App,
  );
  if (appPath) {
    return appPath;
  }

  return sortedDeclarationPath(context, () => true);
}

function sortedDeclarationPath(
  context: ProjectContext,
  predicate: (declaration: ProjectContext["declarations"][number]) => boolean,
): string | undefined {
  return context.declarations
    .filter(predicate)
    .map((declaration) => declaration.repoRelativePath)
    .sort()[0];
}

function primaryDiagnosticCoordinate(file: ArchitectureFile): SourceCoordinate {
  return (
    file.topLevelDeclarations.find(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol &&
        declaration.kind !== NominalKind.Enum,
    )?.coordinate ??
    file.topLevelDeclarations[0]?.coordinate ?? { line: 1, column: 1 }
  );
}

function isProjectManifestOrConfigFile(file: ArchitectureFile): boolean {
  if (file.classification.pathComponents.length !== 1) {
    return false;
  }

  const fileName = file.classification.fileName.toLowerCase();
  const fileStem = file.classification.fileStem.toLowerCase();

  return (
    fileName === "package.json" ||
    fileName === "package-lock.json" ||
    fileName === "pnpm-lock.yaml" ||
    fileName === "yarn.lock" ||
    fileName === "bun.lockb" ||
    /^tsconfig(?:\..+)?\.json$/.test(fileName) ||
    fileStem.endsWith(".config") ||
    fileStem.endsWith("config") ||
    fileName.startsWith(".eslintrc") ||
    fileName.startsWith(".prettierrc")
  );
}

function unknownRoleFolderName(file: ArchitectureFile): string | undefined {
  const layerName = layerFolderName(file.classification.layer);
  if (!layerName) {
    return undefined;
  }

  const layerIndex = file.classification.pathComponents.findIndex(
    (component) => component.toLowerCase() === layerName.toLowerCase(),
  );

  if (layerIndex < 0) {
    return undefined;
  }

  return file.classification.pathComponents[layerIndex + 1];
}

function layerFolderName(layer: ArchitectureLayer): string {
  switch (layer) {
    case ArchitectureLayer.Domain:
      return "Domain";
    case ArchitectureLayer.Application:
      return "Application";
    case ArchitectureLayer.Infrastructure:
      return "Infrastructure";
    case ArchitectureLayer.Presentation:
      return "Presentation";
    case ArchitectureLayer.App:
      return "App";
    case ArchitectureLayer.UI:
      return "UI";
    case ArchitectureLayer.Tests:
      return "Tests";
    case ArchitectureLayer.Other:
      return "";
  }
}

function genericUnknownRoleMessage(
  file: ArchitectureFile,
  folder: string,
): string {
  const layerName = layerFolderName(file.classification.layer);

  return richRemediationMessage({
    summary: `Source file '${file.repoRelativePath}' sits in an unrecognized ${layerName} subdirectory '${folder}', so it carries no role folder and no role-gated rule can evaluate it or resolve references to it.`,
    categories: [
      "unknown layer taxonomy invented ad hoc",
      "misplaced role parked outside its canonical folder",
      "rule-evasion zone where neither shape rules nor boundary rules apply",
    ],
    signs: [
      "the path component after the layer folder matches no canonical role for that layer",
      "the classifier assigned RoleFolder 'none'",
      "declarations in this file resolve with no role folder, making them invisible to reference rules",
    ],
    architecturalNote:
      "each layer's role folders are a closed, enforced set -- Domain and Infrastructure already reject unknown subdirectories, and an unguarded folder in Application, Presentation, or App becomes a wholesale evasion channel where code escapes the rule set.",
    destination:
      "the canonical role folder matching the file's behavior -- Application: Contracts/Commands, Contracts/Ports, Contracts/Workflow, Errors, Ports/Protocols, StateTransitions, UseCases, or Services; Presentation: Controllers, Routes, DTOs, Presenters, Renderers, Middleware, Errors, ViewModels, Views, or Styles; App: Configuration, Runtime, or DependencyInjection -- or, if a genuinely new durable role is intended, extend the classifier with a new RoleFolder case plus accompanying shape and boundary rules.",
    decomposition:
      "1) classify each file's actual role; 2) move it to the canonical folder or its owning layer; 3) update references; 4) only if a new role is truly warranted, add the RoleFolder case, classifier mapping, and at least one shape rule before moving files under it; 5) re-run the linter.",
  });
}

function applicationPoliciesUnknownRoleMessage(
  file: ArchitectureFile,
  folder: string,
): string {
  return richRemediationMessage({
    summary: `Application source file '${file.repoRelativePath}' sits in unrecognized subdirectory '${folder}', so no role-gated rule can evaluate it or resolve references to it.`,
    categories: [
      "unclassified Application taxonomy that escapes every shape, purity, and boundary-reference rule",
      "misplaced concern parked in an unpoliced Application folder",
      "rule-evasion zone referenced directly from Presentation",
    ],
    signs: [
      "the file is inside Application/ but its subfolder maps to no canonical Application role",
      "the file's types are referenced from other layers without any role rule in the path",
    ],
    architecturalNote:
      "policies are stateless business deciders and belong in Domain/Policies, where domain purity and policy shape rules evaluate them -- an Application policies folder is invisible to the classifier, so its decision logic is unpoliced and Presentation can call it directly, bypassing the service boundary.",
    destination:
      "Domain/Policies for decision logic, operating on Domain entities and value objects, or another appropriate role such as Presentation for display/formatting fragments; Application services should surface policy outcomes as passive contract fields.",
    decomposition:
      "1) split each file into decision logic and formatting; 2) move decision logic to Domain/Policies, introducing Domain value objects for any shapes that were Application contracts; 3) move formatting into the Presentation layer beside its consumer; 4) route every former direct call through an Application service that exposes the outcome as a contract field; 5) delete the empty folder and re-run the linter.",
  });
}
