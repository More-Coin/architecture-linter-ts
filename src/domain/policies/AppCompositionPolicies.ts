import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";

type AppRoleShapePolicyOptions = Readonly<{
  readonly ruleID: string;
  readonly isMatchingFile: (file: ArchitectureFile) => boolean;
  readonly rolePath: string;
  readonly requiredSuffix: string;
  readonly expectedRoleDescription: string;
  readonly roleOwnershipDescription: string;
  readonly renameGuidance: string;
}>;

class AppRoleShapePolicy implements ArchitecturePolicyProtocol {
  constructor(private readonly options: AppRoleShapePolicyOptions) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!this.options.isMatchingFile(file)) {
      return [];
    }

    const diagnostics = file.topLevelDeclarations.flatMap((declaration) => {
      if (declaration.kind === NominalKind.Protocol) {
        return [
          file.diagnostic(
            this.options.ruleID,
            appRemediationMessage({
              summary: `${this.options.rolePath} declares protocol '${declaration.name}', but this role is expected to contain only concrete ${this.options.expectedRoleDescription}.`,
              categories: [
                `protocol placed in the composition root's ${this.options.expectedRoleDescription}`,
                "abstraction that likely belongs in an inner-layer protocol location",
                "interface extracted without a clear composition-root consumer",
              ],
              signs: [
                "top-level declaration is a protocol",
                `file lives under ${this.options.rolePath}`,
              ],
              architecturalNote: `${this.options.rolePath} is responsible for ${this.options.roleOwnershipDescription}. Protocols introduce an abstraction boundary whose natural home is an inner layer such as Application/Ports or Domain, not the composition root.`,
              destination:
                "move the protocol to its owning inner-layer protocol location, typically Application/Ports/Protocols or Domain/Protocols, and leave only concrete wiring types in this file.",
              decomposition: `identify which layer owns the abstraction, move the protocol to the appropriate inner-layer protocol location, update conformances and import sites, then confirm this file contains only a concrete type ending in ${this.options.requiredSuffix}.`,
            }),
            declaration.coordinate,
          ),
        ];
      }

      if (!declaration.name.endsWith(this.options.requiredSuffix)) {
        return [
          file.diagnostic(
            this.options.ruleID,
            appRemediationMessage({
              summary: `${this.options.rolePath} declares '${declaration.name}', which does not end in '${this.options.requiredSuffix}'.`,
              categories: [
                "misnamed composition-root type",
                "type that may belong in a different App role folder",
                "wiring type whose responsibility has not been scoped to this role",
              ],
              signs: [
                `top-level concrete type name lacks the '${this.options.requiredSuffix}' suffix`,
                `file lives under ${this.options.rolePath}`,
              ],
              architecturalNote: `${this.options.requiredSuffix} is the role suffix indicating this type owns ${this.options.roleOwnershipDescription}. A type without that suffix may belong in another App role folder or a lower layer depending on its actual responsibility.`,
              destination: this.options.renameGuidance,
              decomposition: `identify whether the type owns ${this.options.roleOwnershipDescription}; rename or relocate accordingly; verify the file then contains at least one concrete type ending in ${this.options.requiredSuffix}.`,
            }),
            declaration.coordinate,
          ),
        ];
      }

      return [];
    });

    const hasRequiredType = file.topLevelDeclarations.some(
      (declaration) =>
        declaration.kind !== NominalKind.Protocol &&
        declaration.name.endsWith(this.options.requiredSuffix),
    );

    if (!hasRequiredType) {
      diagnostics.push(
        file.diagnostic(
          this.options.ruleID,
          appRemediationMessage({
            summary: `${this.options.rolePath} file '${file.repoRelativePath}' exposes no concrete type ending in '${this.options.requiredSuffix}'.`,
            categories: [
              "empty or misrouted composition-root file",
              "wiring type renamed without updating its role folder",
              "file that no longer contains a primary role type",
            ],
            signs: [
              `no top-level concrete type name ends in '${this.options.requiredSuffix}'`,
              `file lives under ${this.options.rolePath}`,
            ],
            architecturalNote: `Every file in ${this.options.rolePath} is expected to anchor at least one concrete type ending in ${this.options.requiredSuffix} so this composition-root role remains predictable and discoverable.`,
            destination: `add or restore a concrete type ending in '${this.options.requiredSuffix}', or move the file out of ${this.options.rolePath} if it no longer belongs in this role.`,
            decomposition:
              "audit the file's top-level declarations; rename the primary type or relocate the file to the correct role folder, then re-run the linter.",
          }),
        ),
      );
    }

    return diagnostics;
  }
}

export class AppConfigurationShapePolicy extends AppRoleShapePolicy {
  static readonly ruleID = "app.configuration.shape";

  constructor() {
    super({
      ruleID: AppConfigurationShapePolicy.ruleID,
      isMatchingFile: (file) => file.classification.isAppConfigurationFile,
      rolePath: "App/Configuration",
      requiredSuffix: "Configuration",
      expectedRoleDescription: "configuration wiring types",
      roleOwnershipDescription: "static wiring decisions",
      renameGuidance:
        "rename the type to end in 'Configuration' if it owns wiring decisions, or move it to the appropriate App role folder or inner layer that matches its responsibility.",
    });
  }
}

export class AppRuntimeShapePolicy extends AppRoleShapePolicy {
  static readonly ruleID = "app.runtime.shape";

  constructor() {
    super({
      ruleID: AppRuntimeShapePolicy.ruleID,
      isMatchingFile: (file) => file.classification.isAppRuntimeFile,
      rolePath: "App/Runtime",
      requiredSuffix: "Runtime",
      expectedRoleDescription: "runtime bootstrap types",
      roleOwnershipDescription: "application lifecycle bootstrap decisions",
      renameGuidance:
        "rename the type to end in 'Runtime' if it owns lifecycle bootstrap, or move it to the appropriate App role folder or inner layer that matches its responsibility.",
    });
  }
}

export class AppDependencyInjectionShapePolicy extends AppRoleShapePolicy {
  static readonly ruleID = "app.dependency_injection.shape";

  constructor() {
    super({
      ruleID: AppDependencyInjectionShapePolicy.ruleID,
      isMatchingFile: (file) =>
        file.classification.isAppDependencyInjectionFile,
      rolePath: "App/DependencyInjection",
      requiredSuffix: "DI",
      expectedRoleDescription: "DI wiring types",
      roleOwnershipDescription: "dependency assembly decisions",
      renameGuidance:
        "rename the type to end in 'DI' if it owns dependency assembly, or move it to the appropriate App role folder or inner layer that matches its responsibility.",
    });
  }
}

export class CompositionRootInwardReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "app.inward_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      file.classification.layer !== ArchitectureLayer.Presentation &&
      file.classification.layer !== ArchitectureLayer.Infrastructure
    ) {
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
      if (!declaration || declaration.layer !== ArchitectureLayer.App) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          CompositionRootInwardReferencePolicy.ruleID,
          appRemediationMessage({
            summary: `'${reference.name}' is a composition-root type from '${declaration.repoRelativePath}' and must not be referenced from ${file.classification.layer}.`,
            categories: [
              "composition-root type leaked into a lower layer",
              "dependency on App-layer wiring from Presentation or Infrastructure",
              "type that should only be known to the assembler referenced by an assembled layer",
            ],
            signs: [
              "type reference resolves to a declaration in the App layer",
              "referencing file lives in Presentation or Infrastructure",
            ],
            architecturalNote:
              "The composition root assembles layers but must not be depended on by them. A Presentation or Infrastructure type that references an App-layer type inverts the intended assembly direction and couples the assembled layer to the assembler.",
            destination: `remove the reference to '${reference.name}'; if the behaviour it provides is needed, introduce a protocol in Application/Ports or Domain and inject the dependency through that abstraction.`,
            decomposition: `identify why '${reference.name}' is referenced here; extract the needed behaviour behind an inner-layer protocol if required; remove the direct App-layer import or type reference; verify no other composition-root types are referenced from this file.`,
          }),
          reference.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export function makeAppCompositionPolicies(): readonly ArchitecturePolicyProtocol[] {
  return [
    new AppConfigurationShapePolicy(),
    new AppRuntimeShapePolicy(),
    new AppDependencyInjectionShapePolicy(),
    new CompositionRootInwardReferencePolicy(),
  ];
}

function appRemediationMessage(input: {
  readonly summary: string;
  readonly categories: readonly string[];
  readonly signs: readonly string[];
  readonly architecturalNote: string;
  readonly destination: string;
  readonly decomposition: string;
}): string {
  return `${input.summary} Likely categories: ${input.categories.join("; ")}; signs: ${input.signs.join("; ")}; architectural note: ${input.architecturalNote}; destination: ${input.destination}; explicit decomposition guidance: ${input.decomposition}`;
}
