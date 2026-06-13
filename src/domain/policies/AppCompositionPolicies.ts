import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLayer } from "../ValueObjects/ArchitectureLayer.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import type { IndexedDeclaration } from "../ValueObjects/IndexedDeclaration.ts";
import { NominalKind } from "../ValueObjects/NominalKind.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../ValueObjects/RoleFolder.ts";
import { applicationPortProtocolConformances } from "./ApplicationArchitecturePolicies.ts";
import { canonicalReferenceTypeName } from "./shared/ReferenceOccurrences.ts";

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

      const declaration = context.resolvedDeclarations(reference.name).find(
        (candidate) => candidate.layer === ArchitectureLayer.App,
      );
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

export class AppPortProtocolConformancePolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "app.port_protocol_conformance";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.layer !== ArchitectureLayer.App) {
      return [];
    }

    return applicationPortProtocolConformances(
      file,
      context,
      new Set([
        RoleFolder.ApplicationPortsProtocols,
        RoleFolder.DomainProtocols,
      ]),
    ).map((conformance) =>
      file.diagnostic(
        AppPortProtocolConformancePolicy.ruleID,
        appRemediationMessage({
          summary: `App-layer type '${conformance.declName}' conforms to inner-layer protocol '${conformance.protocolName}' declared in '${conformance.protocolPath}'; the composition root constructs and wires implementations but must not be one${conformance.isAmbiguous ? "; the name is ambiguous and one matching declaration violates the App boundary" : ""}.`,
          categories: [
            "port adapter hidden in App behind a DI or Runtime suffix",
            "test or smoke fixture with real behavior compiled into the production composition root",
            "circular shim re-exposing a use case as the very port it consumes",
          ],
          signs: [
            "a concrete App-layer class, struct, enum, or actor lists an inherited type that resolves to a protocol in Application/Ports/Protocols or Domain/Protocols",
            "the type carries method bodies implementing boundary behavior",
            "suffix-only App shape rules cannot see what the type does",
          ],
          architecturalNote:
            "Implementations of inner-layer seams belong in Infrastructure, where adapter-family rules review translation, fallback, and dispatch behavior. A conformance in App carries behavior in a layer whose rules check only type-name suffixes.",
          destination:
            "Infrastructure/PortAdapters for production implementations and launch-argument fixtures the binary must ship, or a test-support target for purely test-time doubles; App/DependencyInjection keeps only construction and binding of the moved type.",
          decomposition: `Move '${conformance.declName}' to Infrastructure/PortAdapters and rename it to match the adapter role; delete circular shims that wrap a use case back into its own consumed port; update composition-root construction sites; then re-run the linter so adapter-family rules evaluate the moved code.`,
        }),
        conformance.coordinate,
      ),
    );
  }
}

export class AppApplicationBoundaryOperationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "app.application_boundary_operation";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.layer !== ArchitectureLayer.App) {
      return [];
    }

    const boundaryRoles = new Set([
      RoleFolder.ApplicationPortsProtocols,
      RoleFolder.ApplicationUseCases,
    ]);
    const bindings = appBoundaryBindings(file, context, boundaryRoles);
    const diagnostics: ArchitectureDiagnostic[] = [];

    if (file.classification.roleFolder === RoleFolder.AppRuntime) {
      for (const member of file.storedMemberDeclarations) {
        const declaration =
          bindings.get(member.name) ??
          member.typeNames
            .map((typeName) =>
              appBoundaryDeclaration(typeName, context, boundaryRoles),
            )
            .find((candidate): candidate is IndexedDeclaration =>
              Boolean(candidate),
            );
        if (!declaration) {
          continue;
        }

        diagnostics.push(
          appBoundaryOperationDiagnostic(
            file,
            member.name,
            declaration,
            member.coordinate,
          ),
        );
      }
    }

    for (const call of file.memberCallOccurrences) {
      const declaration = bindings.get(call.baseName);
      if (!declaration) {
        continue;
      }

      diagnostics.push(
        appBoundaryOperationDiagnostic(
          file,
          call.baseName,
          declaration,
          call.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class AppMultiServiceOrchestrationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "app.multi_service_orchestration";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (file.classification.layer !== ArchitectureLayer.App) {
      return [];
    }

    const bindings = appBoundaryBindings(
      file,
      context,
      new Set([RoleFolder.ApplicationServices]),
    );
    const calledBases: Array<{
      readonly baseName: string;
      readonly call: { readonly coordinate: { readonly line: number; readonly column: number } };
    }> = [];
    const seen = new Set<string>();

    for (const call of file.memberCallOccurrences) {
      if (!bindings.has(call.baseName) || seen.has(call.baseName)) {
        continue;
      }

      seen.add(call.baseName);
      calledBases.push({ baseName: call.baseName, call });
    }

    if (calledBases.length < 2) {
      return [];
    }

    const [firstCall, secondCall] = calledBases;
    if (!firstCall || !secondCall) {
      return [];
    }

    return [
      file.diagnostic(
        AppMultiServiceOrchestrationPolicy.ruleID,
        appRemediationMessage({
          summary: `App-layer file '${file.repoRelativePath}' operates ${calledBases.length} distinct Application services ('${firstCall.baseName}', '${secondCall.baseName}'), coordinating a cross-service workflow from the composition root.`,
          categories: [
            "multi-step application workflow owned by App instead of a Service",
            "cross-service sequencing with caching or failure policy outside the policed Application layer",
            "orchestration reachable from Presentation only through opaque App-built closures",
          ],
          signs: [
            "two or more stored members, typed bindings, or construction-assigned locals resolve to declarations in Application/Services",
            "App-layer code performs member calls on at least two of them",
            "the identical structure would trip the service-reference rules if the type lived in Application/Services",
          ],
          architecturalNote:
            "App schedules and triggers Application services but must not own multi-step sequencing, inter-service data flow, result caching, or error-swallowing policy. Placing that in App exempts the core workflow from orchestration and surface rules and invites duplicated, diverging copies across trigger paths.",
          destination:
            "one coordinating type in Application/Services that owns the sequence, state, and failure policy, exposing a single entry point the App-layer trigger calls.",
          decomposition:
            "create the coordinating Application service and move the call sequence, inter-service data threading, caching, and error policy into one method; inject the previously separate services into it; reduce the App-layer file to a single service call per trigger; ensure every other trigger path calls the same entry point; re-run the linter.",
        }),
        secondCall.call.coordinate,
      ),
    ];
  }
}

export function makeAppCompositionPolicies(): readonly ArchitecturePolicyProtocol[] {
  return [
    new AppConfigurationShapePolicy(),
    new AppRuntimeShapePolicy(),
    new AppDependencyInjectionShapePolicy(),
    new AppApplicationBoundaryOperationPolicy(),
    new AppMultiServiceOrchestrationPolicy(),
    new AppPortProtocolConformancePolicy(),
    new CompositionRootInwardReferencePolicy(),
  ];
}

function appBoundaryBindings(
  file: ArchitectureFile,
  context: ProjectContext,
  roles: ReadonlySet<RoleFolder>,
): ReadonlyMap<string, IndexedDeclaration> {
  const bindings = new Map<string, IndexedDeclaration>();

  for (const member of file.storedMemberDeclarations) {
    const declaration = member.typeNames
      .map((typeName) => appBoundaryDeclaration(typeName, context, roles))
      .find((candidate): candidate is IndexedDeclaration => Boolean(candidate));
    if (declaration) {
      bindings.set(member.name, declaration);
    }
  }

  for (const typedMember of file.typedMemberOccurrences) {
    const declaration = typedMember.typeNames
      .map((typeName) => appBoundaryDeclaration(typeName, context, roles))
      .find((candidate): candidate is IndexedDeclaration => Boolean(candidate));
    if (declaration) {
      bindings.set(typedMember.name, declaration);
    }
  }

  for (const construction of file.constructionOccurrences) {
    if (!construction.assignedName) {
      continue;
    }

    const declaration = appBoundaryDeclaration(
      construction.typeName,
      context,
      roles,
    );
    if (declaration) {
      bindings.set(construction.assignedName, declaration);
    }
  }

  return bindings;
}

function appBoundaryDeclaration(
  typeName: string,
  context: ProjectContext,
  roles: ReadonlySet<RoleFolder>,
): IndexedDeclaration | undefined {
  const canonicalTypeName = canonicalReferenceTypeName(typeName);
  return context.declarations.find(
    (declaration) =>
      declaration.name === canonicalTypeName && roles.has(declaration.roleFolder),
  );
}

function appBoundaryOperationDiagnostic(
  file: ArchitectureFile,
  bindingName: string,
  declaration: IndexedDeclaration,
  coordinate: { readonly line: number; readonly column: number },
): ArchitectureDiagnostic {
  return file.diagnostic(
    AppApplicationBoundaryOperationPolicy.ruleID,
    appRemediationMessage({
      summary: `App-layer code stores or invokes Application boundary dependency '${bindingName}' resolving to '${declaration.name}' in '${declaration.repoRelativePath}'; the composition root may construct ports and use cases for injection but must not operate them.`,
      categories: [
        "Application-service workflow living in App/Runtime",
        "port or use-case orchestration outside the policed Application layer",
        "business sequencing and persistence decisions hidden behind a Runtime or DI suffix",
      ],
      signs: [
        "a stored member or local binding is typed as, or constructed from, a declaration in Application/Ports/Protocols or Application/UseCases",
        "App-layer code performs member calls on that binding",
        "the identical dependencies would trip the application service boundary rules if this type lived in Application/Services",
      ],
      architecturalNote:
        "App is wiring and lifecycle bootstrap only; workflow that sequences ports and use cases, holds workflow state, or encodes scheduling policy is Application-service work, and parking it in App exempts it from application.services.* boundary rules.",
      destination:
        "a concrete type in Application/Services owning the workflow, its state, and its policy, injected with the same ports and use cases; the App-layer type keeps only OS-callback translation into single service calls.",
      decomposition:
        "create the Application/Services type and move the workflow methods, stored boundary dependencies, and workflow state onto it; reduce the App-layer type to constructing or receiving that service and forwarding OS callbacks to single service methods; deduplicate policy now present in both layers; re-run the linter.",
    }),
    coordinate,
  );
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
