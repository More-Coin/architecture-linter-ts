import type { ArchitecturePolicyProtocol } from "../protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLayer } from "../value-objects/ArchitectureLayer.ts";
import type { ArchitectureComputedPropertyDeclaration } from "../value-objects/ArchitectureComputedPropertyDeclaration.ts";
import type { ArchitectureDiagnostic } from "../value-objects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../value-objects/ArchitectureFile.ts";
import type { ArchitectureIdentifierOccurrence } from "../value-objects/ArchitectureIdentifierOccurrence.ts";
import type { ArchitectureConstructorDeclaration } from "../value-objects/ArchitectureConstructorDeclaration.ts";
import type { ArchitectureMemberCallOccurrence } from "../value-objects/ArchitectureMemberCallOccurrence.ts";
import type { ArchitectureMethodDeclaration } from "../value-objects/ArchitectureMethodDeclaration.ts";
import type { ArchitectureNestedNominalDeclaration } from "../value-objects/ArchitectureNestedNominalDeclaration.ts";
import { NominalKind } from "../value-objects/NominalKind.ts";
import type { ArchitectureOperationalUseOccurrence } from "../value-objects/ArchitectureOperationalUseOccurrence.ts";
import type { ArchitectureStoredMemberDeclaration } from "../value-objects/ArchitectureStoredMemberDeclaration.ts";
import type { ArchitectureStringLiteralOccurrence } from "../value-objects/ArchitectureStringLiteralOccurrence.ts";
import type { ArchitectureTopLevelDeclaration } from "../value-objects/ArchitectureTopLevelDeclaration.ts";
import type { ArchitectureTypeReference } from "../value-objects/ArchitectureTypeReference.ts";
import type { IndexedDeclaration } from "../value-objects/IndexedDeclaration.ts";
import type { ProjectContext } from "../value-objects/ProjectContext.ts";
import { RoleFolder } from "../value-objects/RoleFolder.ts";

export class ApplicationOuterLayerReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.outer_layer_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplication) {
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
      if (
        !declaration ||
        (declaration.layer !== ArchitectureLayer.Presentation &&
          declaration.layer !== ArchitectureLayer.App)
      ) {
        continue;
      }

      const layerLabel =
        declaration.layer === ArchitectureLayer.Presentation
          ? "Presentation"
          : "App composition root";

      diagnostics.push(
        file.diagnostic(
          ApplicationOuterLayerReferencePolicy.ruleID,
          applicationRemediationMessage(
            `Application file references '${reference.name}' from the ${layerLabel} layer at '${declaration.repoRelativePath}', but Application must not depend on outer layers.`,
            "Remove the outer-layer reference and express the needed behavior through an Application/Ports or Domain protocol instead.",
          ),
          reference.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class ApplicationPortProtocolsShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.port_protocols.shape";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationPortProtocolFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenPlatformNames = new Set<string>();

    for (const occurrence of file.identifierOccurrences) {
      if (
        !APPLICATION_POLICY_FORBIDDEN_APIS.platformTypes.has(occurrence.name) ||
        seenPlatformNames.has(occurrence.name)
      ) {
        continue;
      }
      seenPlatformNames.add(occurrence.name);
      diagnostics.push(
        file.diagnostic(
          ApplicationPortProtocolsShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Ports/Protocols references platform API '${occurrence.name}', but port protocols must stay platform-agnostic.`,
            "Model the seam in application-owned terms and keep platform mapping in Infrastructure.",
          ),
          occurrence.coordinate,
        ),
      );
    }

    diagnostics.push(
      ...file.topLevelDeclarations.flatMap((declaration) => {
        if (declaration.kind !== NominalKind.Protocol) {
          return [
            file.diagnostic(
              ApplicationPortProtocolsShapePolicy.ruleID,
              applicationRemediationMessage(
                `Application/Ports/Protocols declares concrete ${declaration.kind} '${declaration.name}', but this role must expose port protocols only.`,
                "Move concrete boundary implementations to Infrastructure and passive data shapes to Application/Contracts.",
              ),
              declaration.coordinate,
            ),
          ];
        }

        if (!declaration.name.endsWith("PortProtocol")) {
          return [
            file.diagnostic(
              ApplicationPortProtocolsShapePolicy.ruleID,
              applicationRemediationMessage(
                `Application/Ports/Protocols declares protocol '${declaration.name}', which does not end in 'PortProtocol'.`,
                "Rename the protocol to end in PortProtocol or move it to the protocol layer that actually owns it.",
              ),
              declaration.coordinate,
            ),
          ];
        }

        const indexedDeclaration = context.uniqueDeclaration(declaration.name);
        if (
          indexedDeclaration &&
          isSinkShapedApplicationPortProtocol(indexedDeclaration, context)
        ) {
          const invalidMethod = file.methodDeclarations
            .filter((method) => method.enclosingTypeName === declaration.name)
            .find((method) => !isValidSinkShapedApplicationPortMethod(method, context));

          if (invalidMethod) {
            return [
              file.diagnostic(
                ApplicationPortProtocolsShapePolicy.ruleID,
                applicationRemediationMessage(
                  `Sink port protocol '${declaration.name}' has method '${invalidMethod.name}' with an invalid shape.`,
                  "Each sink-shaped port method must accept exactly one Application contract parameter and nothing else.",
                ),
                invalidMethod.coordinate,
              ),
            ];
          }
        }

        return [];
      }),
    );

    if (
      !file.topLevelDeclarations.some(
        (declaration) =>
          declaration.kind === NominalKind.Protocol &&
          declaration.name.endsWith("PortProtocol"),
      )
    ) {
      diagnostics.push(
        file.diagnostic(
          ApplicationPortProtocolsShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Ports/Protocols file '${file.repoRelativePath}' exposes no protocol ending in 'PortProtocol'.`,
            "Restore or add a PortProtocol definition, or move the file out of this role.",
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class ApplicationContractsShapePolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "application.contracts.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationContractFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenPlatformNames = new Set<string>();

    for (const occurrence of file.identifierOccurrences) {
      if (
        !APPLICATION_POLICY_FORBIDDEN_APIS.platformTypes.has(occurrence.name) ||
        seenPlatformNames.has(occurrence.name)
      ) {
        continue;
      }

      seenPlatformNames.add(occurrence.name);
      diagnostics.push(
        file.diagnostic(
          ApplicationContractsShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Contracts references platform API '${occurrence.name}', but contracts must define application-owned data shapes only.`,
            "Replace platform types with application-owned values and keep mapping in Infrastructure.",
          ),
          occurrence.coordinate,
        ),
      );
    }

    diagnostics.push(
      ...file.topLevelDeclarations.flatMap((declaration) => {
        if (declaration.kind === NominalKind.Protocol) {
          return [
            file.diagnostic(
              ApplicationContractsShapePolicy.ruleID,
              applicationRemediationMessage(
                `Application/Contracts declares protocol '${declaration.name}', but contracts are passive data shapes, not behavioral abstractions.`,
                "Move seams to Application/Ports/Protocols or Domain/Protocols.",
              ),
              declaration.coordinate,
            ),
          ];
        }

        if (
          declaration.kind === NominalKind.Class ||
          declaration.kind === NominalKind.Actor
        ) {
          return [
            file.diagnostic(
              ApplicationContractsShapePolicy.ruleID,
              applicationRemediationMessage(
                `Application/Contracts declares ${declaration.kind} '${declaration.name}', but contracts must be simple value shapes.`,
                "Convert passive contract shapes to structs or enums, or move active behavior out of the contract layer.",
              ),
              declaration.coordinate,
            ),
          ];
        }

        if (!declaration.name.endsWith("Contract")) {
          return [
            file.diagnostic(
              ApplicationContractsShapePolicy.ruleID,
              applicationRemediationMessage(
                `Application/Contracts declares '${declaration.name}', which does not end in 'Contract'.`,
                "Rename the type with a Contract suffix or move it to the application role that matches its responsibility.",
              ),
              declaration.coordinate,
            ),
          ];
        }

        return [];
      }),
    );

    if (
      !file.topLevelDeclarations.some(
        (declaration) =>
          (declaration.kind === NominalKind.Struct ||
            declaration.kind === NominalKind.Enum) &&
          declaration.name.endsWith("Contract"),
      )
    ) {
      diagnostics.push(
        file.diagnostic(
          ApplicationContractsShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Contracts file '${file.repoRelativePath}' exposes no struct or enum ending in 'Contract'.`,
            "Restore a passive Contract type or move the file out of Application/Contracts.",
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class ApplicationContractsNestedErrorPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.contracts.nested_error_placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationContractFile) {
      return [];
    }

    return file.nestedNominalDeclarations.flatMap((declaration) => {
      if (!isErrorShapedContractNestedDeclaration(declaration)) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationContractsNestedErrorPlacementPolicy.ruleID,
          applicationRemediationMessage(
            `Application contract '${declaration.enclosingTypeName}' declares nested error-shaped type '${declaration.name}', but contract files must not define error types.`,
            "Move nested error types to Application/Errors as top-level declarations.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class ApplicationContractsNoErrorMappingSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.contracts.no_error_mapping_surface";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationContractFile) {
      return [];
    }

    return [
      ...file.constructorDeclarations.flatMap((declaration) => {
        if (
          !declaration.parameterTypeNames.some((typeName) =>
            isErrorShapedTypeName(typeName, context),
          )
        ) {
          return [];
        }

        return [
          file.diagnostic(
            ApplicationContractsNoErrorMappingSurfacePolicy.ruleID,
            applicationContractErrorMappingSurfaceMessage(
              `Constructor '${declaration.enclosingTypeName}(...)'`,
            ),
            declaration.coordinate,
          ),
        ];
      }),
      ...file.methodDeclarations.flatMap((declaration) => {
        if (
          !declaration.parameterTypeNames.some((typeName) =>
            isErrorShapedTypeName(typeName, context),
          )
        ) {
          return [];
        }

        return [
          file.diagnostic(
            ApplicationContractsNoErrorMappingSurfacePolicy.ruleID,
            applicationContractErrorMappingSurfaceMessage(
              `Method '${declaration.name}' on contract '${declaration.enclosingTypeName}'`,
            ),
            declaration.coordinate,
          ),
        ];
      }),
    ];
  }
}

export class ApplicationContractsNoCollaboratorDependenciesPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.contracts.no_collaborator_dependencies";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationContractFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenForbiddenDependencyNames = new Set<string>();

    const pushDependencyDiagnostic = (
      rawDependencyName: string,
      coordinate: { line: number; column: number },
    ): void => {
      if (
        !isForbiddenApplicationContractDependencyTypeName(
          rawDependencyName,
          context,
        )
      ) {
        return;
      }

      const dependencyName = canonicalArchitectureTypeName(rawDependencyName);
      if (seenForbiddenDependencyNames.has(dependencyName)) {
        return;
      }
      seenForbiddenDependencyNames.add(dependencyName);

      diagnostics.push(
        file.diagnostic(
          ApplicationContractsNoCollaboratorDependenciesPolicy.ruleID,
          applicationContractCollaboratorDependencyMessage(
            dependencyName,
            context.uniqueDeclaration(dependencyName),
          ),
          coordinate,
        ),
      );
    };

    for (const reference of file.typeReferences) {
      pushDependencyDiagnostic(reference.name, reference.coordinate);
    }

    for (const occurrence of file.identifierOccurrences) {
      pushDependencyDiagnostic(occurrence.name, occurrence.coordinate);
    }

    for (const declaration of file.methodDeclarations) {
      for (const parameterTypeName of declaration.parameterTypeNames) {
        pushDependencyDiagnostic(parameterTypeName, declaration.coordinate);
      }
    }

    for (const declaration of file.constructorDeclarations) {
      for (const parameterTypeName of declaration.parameterTypeNames) {
        pushDependencyDiagnostic(parameterTypeName, declaration.coordinate);
      }
    }

    return diagnostics;
  }
}

export class ApplicationContractsOwnershipPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.contracts.ownership";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.constructorDeclarations) {
      const contractDeclaration = attachedApplicationContractDeclaration(
        declaration.enclosingTypeName,
        file,
        context,
      );
      if (!contractDeclaration) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          ApplicationContractsOwnershipPolicy.ruleID,
          applicationContractOwnershipMessage(
            `Constructor '${declaration.enclosingTypeName}(...)'`,
            contractDeclaration.name,
            contractDeclaration.repoRelativePath,
          ),
          declaration.coordinate,
        ),
      );
    }

    for (const declaration of file.methodDeclarations) {
      const contractDeclaration = attachedApplicationContractDeclaration(
        declaration.enclosingTypeName,
        file,
        context,
      );
      if (!contractDeclaration) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          ApplicationContractsOwnershipPolicy.ruleID,
          applicationContractOwnershipMessage(
            `Method '${declaration.name}' on contract '${declaration.enclosingTypeName}'`,
            contractDeclaration.name,
            contractDeclaration.repoRelativePath,
          ),
          declaration.coordinate,
        ),
      );
    }

    for (const declaration of file.computedPropertyDeclarations) {
      const contractDeclaration = attachedApplicationContractDeclaration(
        declaration.enclosingTypeName,
        file,
        context,
      );
      if (!contractDeclaration) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          ApplicationContractsOwnershipPolicy.ruleID,
          applicationContractOwnershipMessage(
            `Computed property '${declaration.name}' on contract '${declaration.enclosingTypeName}'`,
            contractDeclaration.name,
            contractDeclaration.repoRelativePath,
          ),
          declaration.coordinate,
        ),
      );
    }

    return diagnostics;
  }
}

export class ApplicationContractsNoStateTransitionSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.contracts.no_state_transition_surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationContractFile) {
      return [];
    }

    return [
      ...file.methodDeclarations.flatMap((declaration) => {
        if (!isApplicationContractStateTransitionMethod(declaration)) {
          return [];
        }

        return [
          file.diagnostic(
            ApplicationContractsNoStateTransitionSurfacePolicy.ruleID,
            applicationContractStateTransitionSurfaceMessage(
              `Method '${declaration.name}' on contract '${declaration.enclosingTypeName}'`,
            ),
            declaration.coordinate,
          ),
        ];
      }),
      ...file.computedPropertyDeclarations.flatMap((declaration) => {
        if (!isApplicationContractStateTransitionComputedProperty(declaration)) {
          return [];
        }

        return [
          file.diagnostic(
            ApplicationContractsNoStateTransitionSurfacePolicy.ruleID,
            applicationContractStateTransitionSurfaceMessage(
              `Computed property '${declaration.name}' on contract '${declaration.enclosingTypeName}'`,
            ),
            declaration.coordinate,
          ),
        ];
      }),
    ];
  }
}

export class ApplicationContractsErrorTaxonomyPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.contracts.error_taxonomy";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationContractFile) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (!isForbiddenApplicationContractErrorTaxonomy(declaration, file)) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationContractsErrorTaxonomyPolicy.ruleID,
          applicationRemediationMessage(
            `Application contract type '${declaration.name}' acts as an error or failure taxonomy, which must not live in Application/Contracts.`,
            "Move structured failure types to Application/Errors and keep contracts as passive snapshots or non-error outcomes only.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class ApplicationProtocolPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.protocol_placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      !file.classification.isApplication ||
      file.classification.isApplicationPortProtocolFile ||
      file.classification.isApplicationUseCaseFile ||
      file.classification.isApplicationServicesRole
    ) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (declaration.kind !== NominalKind.Protocol) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationProtocolPlacementPolicy.ruleID,
          applicationRemediationMessage(
            `Protocol '${declaration.name}' is declared in '${file.repoRelativePath}', but Application protocols must live in Application/Ports/Protocols.`,
            "Move Application protocols into the canonical Application/Ports/Protocols location.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class ApplicationErrorsShapePolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "application.errors.shape";
  static readonly surfaceRuleID = "application.errors.surface";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationErrorFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const namingValidator = (declaration: ArchitectureTopLevelDeclaration) =>
      declaration.name === "ApplicationError" ||
      declaration.name.endsWith("Error");
    const concreteDeclarations = file.topLevelDeclarations.filter(
      (declaration) => declaration.kind !== NominalKind.Protocol,
    );
    const fileBaseName = applicationErrorFileBaseName(file.repoRelativePath);

    if (concreteDeclarations.length > 1) {
      diagnostics.push(
        file.diagnostic(
          ApplicationErrorsShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Errors file '${file.repoRelativePath}' declares more than one concrete type.`,
            "Split concrete error types into dedicated files under Application/Errors.",
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
            ApplicationErrorsShapePolicy.ruleID,
            applicationRemediationMessage(
              `Application/Errors declares protocol '${declaration.name}', but this role must expose concrete structured error types only.`,
              "Move behavioral abstractions to Application/Ports/Protocols or Domain/Protocols.",
            ),
            declaration.coordinate,
          ),
        ];
      }),
    );

    const structuredErrorDeclarations = concreteDeclarations.filter((declaration) =>
      isApplicationStructuredErrorPlacementDeclaration(declaration, namingValidator),
    );

    if (structuredErrorDeclarations.length === 0) {
      diagnostics.push(
        file.diagnostic(
          ApplicationErrorsShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Errors file '${file.repoRelativePath}' exposes no structured error type.`,
            "Restore a structured error type that conforms to StructuredErrorProtocol and carries the required members.",
          ),
        ),
      );
      diagnostics.push(
        ...structuredErrorSurfaceDiagnostics(
          file,
          ApplicationErrorsShapePolicy.surfaceRuleID,
          "Application/Errors",
          STRUCTURED_ERROR_FORBIDDEN_SURFACE_TERMS,
        ),
      );
      return diagnostics;
    }

    if (!structuredErrorDeclarations.some((declaration) => declaration.name === fileBaseName)) {
      diagnostics.push(
        file.diagnostic(
          ApplicationErrorsShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Errors file '${file.repoRelativePath}' is not named after the structured error type it contains.`,
            "Rename the file or the primary structured error type so they match.",
          ),
        ),
      );
    }

    for (const declaration of concreteDeclarations) {
      if (
        !namingValidator(declaration) &&
        !isApplicationStructuredErrorPlacementDeclaration(
          declaration,
          namingValidator,
        )
      ) {
        diagnostics.push(
          file.diagnostic(
            ApplicationErrorsShapePolicy.ruleID,
            applicationRemediationMessage(
              `Application/Errors declares '${declaration.name}', which does not match the expected structured error naming pattern.`,
              "Rename structured error types to end in Error or move helpers out of Application/Errors.",
            ),
            declaration.coordinate,
          ),
        );
        continue;
      }

      if (!declaration.inheritedTypeNames.includes("StructuredErrorProtocol")) {
        diagnostics.push(
          file.diagnostic(
            ApplicationErrorsShapePolicy.ruleID,
            applicationRemediationMessage(
              `'${declaration.name}' does not conform to StructuredErrorProtocol.`,
              "Add StructuredErrorProtocol conformance and implement the required members.",
            ),
            declaration.coordinate,
          ),
        );
      }

      const missingMemberNames = [...STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES].filter(
        (memberName) => !declaration.memberNames.includes(memberName),
      );

      if (missingMemberNames.length > 0) {
        diagnostics.push(
          file.diagnostic(
            ApplicationErrorsShapePolicy.ruleID,
            applicationRemediationMessage(
              `'${declaration.name}' is missing required structured error members: ${missingMemberNames.join(", ")}.`,
              "Implement code, message, retryable, and details on structured application errors.",
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    diagnostics.push(
      ...structuredErrorSurfaceDiagnostics(
        file,
        ApplicationErrorsShapePolicy.surfaceRuleID,
        "Application/Errors",
        STRUCTURED_ERROR_FORBIDDEN_SURFACE_TERMS,
      ),
    );

    return diagnostics;
  }
}

export class ApplicationErrorsPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.errors.placement";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (
      !file.classification.isApplication ||
      file.classification.isApplicationErrorFile
    ) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        declaration.kind === NominalKind.Protocol ||
        !isApplicationStructuredErrorPlacementDeclaration(
          declaration,
          (candidate) =>
            candidate.name === "ApplicationError" ||
            candidate.name.endsWith("Error"),
        )
      ) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationErrorsPlacementPolicy.ruleID,
          applicationRemediationMessage(
            `Structured error type '${declaration.name}' is declared in '${file.repoRelativePath}' but must live in Application/Errors.`,
            "Move structured Application-layer errors into dedicated files under Application/Errors.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class ApplicationServicesNoProtocolsPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.no_protocols";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServicesRole) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (declaration.kind !== NominalKind.Protocol) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationServicesNoProtocolsPolicy.ruleID,
          applicationRemediationMessage(
            `Application/Services declares protocol '${declaration.name}', but this folder is reserved for concrete orchestration types.`,
            "Move Application service abstractions into Application/Ports/Protocols.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class ApplicationServicesShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.shape";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServiceFile) {
      return [];
    }

    const diagnostics = file.topLevelDeclarations.flatMap((declaration) => {
      if (
        declaration.kind === NominalKind.Protocol ||
        declaration.name.endsWith("Service")
      ) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationServicesShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Services file declares '${declaration.name}', which does not end in 'Service'.`,
            "Rename orchestration types with a Service suffix or move the type to the Application role it actually belongs to.",
          ),
          declaration.coordinate,
        ),
      ];
    });

    if (
      !file.topLevelDeclarations.some(
        (declaration) =>
          declaration.kind !== NominalKind.Protocol &&
          declaration.name.endsWith("Service"),
      )
    ) {
      diagnostics.push(
        file.diagnostic(
          ApplicationServicesShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/Services file '${file.repoRelativePath}' exposes no top-level type ending in 'Service'.`,
            "Restore a concrete Service type or move the file out of Application/Services.",
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class ApplicationServicesNoUseCasesPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.no_usecases";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServicesRole) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        !declaration.name.endsWith("UseCase") &&
        !declaration.name.endsWith("UseCases")
      ) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationServicesNoUseCasesPolicy.ruleID,
          applicationRemediationMessage(
            `Application/Services declares '${declaration.name}', which has a use-case suffix and belongs in Application/UseCases.`,
            "Move use-case types out of Application/Services into dedicated Application/UseCases files.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class ApplicationUseCasesShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.shape";
  private readonly forbiddenSuffixes = [
    "Service",
    "Coordinator",
    "Store",
    "Controller",
    "Orchestrator",
  ];

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    for (const declaration of file.topLevelDeclarations) {
      if (
        this.forbiddenSuffixes.some((suffix) => declaration.name.endsWith(suffix))
      ) {
        diagnostics.push(
          file.diagnostic(
            ApplicationUseCasesShapePolicy.ruleID,
            applicationRemediationMessage(
              `Application/UseCases declares '${declaration.name}', whose suffix signals a broader orchestration role rather than a focused use case.`,
              "Move coordinator-like types out of Application/UseCases or trim them into focused UseCase types.",
            ),
            declaration.coordinate,
          ),
        );
      }

      if (!declaration.name.endsWith("UseCase")) {
        diagnostics.push(
          file.diagnostic(
            ApplicationUseCasesShapePolicy.ruleID,
            applicationRemediationMessage(
              `Application/UseCases declares '${declaration.name}', which does not end in 'UseCase'.`,
              "Rename focused operation types with a UseCase suffix or move them to the proper Application role.",
            ),
            declaration.coordinate,
          ),
        );
      }

      if (declaration.kind === NominalKind.Enum) {
        diagnostics.push(
          file.diagnostic(
            ApplicationUseCasesShapePolicy.ruleID,
            applicationRemediationMessage(
              `Application/UseCases declares enum '${declaration.name}', but use cases should be concrete operation types rather than enum namespaces.`,
              "Replace enum namespaces with concrete use-case types that expose focused operations.",
            ),
            declaration.coordinate,
          ),
        );
      }
    }

    if (
      !file.topLevelDeclarations.some((declaration) =>
        declaration.name.endsWith("UseCase"),
      )
    ) {
      diagnostics.push(
        file.diagnostic(
          ApplicationUseCasesShapePolicy.ruleID,
          applicationRemediationMessage(
            `Application/UseCases file '${file.repoRelativePath}' exposes no top-level type ending in 'UseCase'.`,
            "Restore a focused UseCase type or move the file out of Application/UseCases.",
          ),
        ),
      );
    }

    return diagnostics;
  }
}

export class ApplicationUseCasesNoProtocolsPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.no_protocols";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
      return [];
    }

    return file.topLevelDeclarations.flatMap((declaration) => {
      if (
        declaration.kind !== NominalKind.Protocol ||
        !declaration.name.endsWith("UseCase")
      ) {
        return [];
      }

      return [
        file.diagnostic(
          ApplicationUseCasesNoProtocolsPolicy.ruleID,
          applicationRemediationMessage(
            `Application/UseCases declares protocol '${declaration.name}', but use cases must be concrete operation types rather than protocols.`,
            "Move seams to Application/Ports/Protocols and keep Application/UseCases concrete.",
          ),
          declaration.coordinate,
        ),
      ];
    });
  }
}

export class ApplicationUseCasesOperationShapePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.operation_shape";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
      return [];
    }

    return operationSurfaceUseCaseDeclarations(file).flatMap((declaration) => {
      const operationMethods = applicationOperationMethods(
        file,
        context,
        declaration.name,
      );

      if (operationMethods.length === 0) {
        return [
          file.diagnostic(
            ApplicationUseCasesOperationShapePolicy.ruleID,
            applicationRemediationMessage(
              `Application use case '${declaration.name}' exposes no direct instance operation method with a non-Void Application contract or Domain entity result.`,
              "Expose a non-private instance method that returns an Application contract or Domain entity result.",
            ),
            declaration.coordinate,
          ),
        ];
      }

      if (hasInvalidMultiMethodOperationNaming(operationMethods)) {
        return [
          file.diagnostic(
            ApplicationUseCasesOperationShapePolicy.ruleID,
            applicationRemediationMessage(
              `Application use case '${declaration.name}' exposes multiple public operation methods but uses generic operation naming.`,
              "Give each public operation a distinct semantic name or split the type into smaller use cases.",
            ),
            declaration.coordinate,
          ),
        ];
      }

      return [];
    });
  }
}

export class ApplicationUseCasesAbstractionDelegationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.abstraction_delegation";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
      return [];
    }

    return concreteUseCaseDeclarations(file).flatMap((declaration) => {
      const nonPrivateInstanceMethods = nonPrivateInstanceUseCaseMethods(
        file,
        declaration.name,
      );
      const inwardDependencyNames = inwardAbstractionDependencyNames(
        file,
        context,
        declaration.name,
      );

      if (
        nonPrivateInstanceMethods.length === 0 ||
        inwardDependencyNames.size === 0
      ) {
        return [
          file.diagnostic(
            ApplicationUseCasesAbstractionDelegationPolicy.ruleID,
            applicationRemediationMessage(
              `Concrete Application use case '${declaration.name}' does not operationally use an injected Application or Domain protocol dependency from a valid method.`,
              "A concrete use case should expose seam-backed work through injected Application or Domain abstractions.",
            ),
            declaration.coordinate,
          ),
        ];
      }

      return nonPrivateInstanceMethods.flatMap((method) => {
        if (
          methodOperationallyUsesInwardAbstraction(
            file,
            context,
            declaration.name,
            method.name,
          )
        ) {
          return [];
        }

        return [
          file.diagnostic(
            ApplicationUseCasesAbstractionDelegationPolicy.ruleID,
            applicationRemediationMessage(
              `Application use case method '${method.name}' does not operationally use an injected Application or Domain protocol dependency.`,
              "Focused use-case methods should delegate through inward abstractions rather than only performing local logic.",
            ),
            method.coordinate,
          ),
        ];
      });
    });
  }
}

export class ApplicationUseCasesSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.surface";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
      return [];
    }

    return concreteUseCaseDeclarations(file).flatMap((declaration) =>
      nonPrivateInstanceUseCaseMethods(file, declaration.name).flatMap((method) => {
        if (
          !methodOperationallyUsesInwardAbstraction(
            file,
            context,
            declaration.name,
            method.name,
          )
        ) {
          return [];
        }

        const keepsProjectionOrTranslationInline =
          useCaseMethodKeepsProjectionOrTranslationInline(
            file,
            context,
            declaration.name,
            method,
          );
        const usesApplicationStateTransition =
          useCaseMethodOperationallyUsesApplicationStateTransition(
            file,
            context,
            declaration.name,
            method.name,
          );

        if (
          !keepsProjectionOrTranslationInline &&
          !usesApplicationStateTransition
        ) {
          return [];
        }

        return [
          file.diagnostic(
            ApplicationUseCasesSurfacePolicy.ruleID,
            applicationRemediationMessage(
              `Application use case method '${method.name}' mixes a seam-backed operation with inline state progression or projection/translation logic.`,
              "Keep seam-backed work on the use-case surface and move state progression, projection, or broader orchestration to the proper collaborator.",
            ),
            method.coordinate,
          ),
        ];
      }),
    );
  }
}

export class ApplicationServicesInfrastructureReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.infrastructure_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServiceFile) {
      return [];
    }

    return referenceLayerDiagnostics(
      file,
      context,
      ApplicationServicesInfrastructureReferencePolicy.ruleID,
      (declaration) => declaration.layer === ArchitectureLayer.Infrastructure,
      "Application services must not reference Infrastructure types directly.",
    );
  }
}

export class ApplicationServicesRepositoryReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.repository_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServiceFile) {
      return [];
    }

    return referenceLayerDiagnostics(
      file,
      context,
      ApplicationServicesRepositoryReferencePolicy.ruleID,
      (declaration) => isRepositoryDependency(declaration),
      "Application services should route repository-backed behavior through focused use cases instead of touching repositories directly.",
    );
  }
}

export class ApplicationUseCasesInfrastructureReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.infrastructure_reference";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
      return [];
    }

    return referenceLayerDiagnostics(
      file,
      context,
      ApplicationUseCasesInfrastructureReferencePolicy.ruleID,
      (declaration) => declaration.layer === ArchitectureLayer.Infrastructure,
      "Use cases should depend on Application or Domain abstractions, not concrete Infrastructure types.",
    );
  }
}

export class ApplicationUseCasesPlatformAPIPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.platform_api";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
      return [];
    }

    return platformIdentifierDiagnostics(
      file,
      ApplicationUseCasesPlatformAPIPolicy.ruleID,
      new Set([...APPLICATION_POLICY_FORBIDDEN_APIS.platformTypes, "globalThis"]),
      "Use cases should stay platform-agnostic and push runtime details behind Application-facing protocols.",
    );
  }
}

export class ApplicationUseCasesServiceReferencePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.usecases.service_reference";
  private readonly serviceSuffixes = [
    "Service",
    "Store",
    "Controller",
    "Coordinator",
    "Orchestrator",
    "Builder",
    "Generator",
    "Actor",
  ];

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationUseCaseFile) {
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
      if (
        !declaration ||
        declaration.roleFolder !== RoleFolder.ApplicationServices ||
        !this.isServiceLike(declaration)
      ) {
        continue;
      }

      diagnostics.push(
        file.diagnostic(
          ApplicationUseCasesServiceReferencePolicy.ruleID,
          applicationRemediationMessage(
            `Application use case '${file.repoRelativePath}' references Application service '${reference.name}' from '${declaration.repoRelativePath}'.`,
            "Keep use cases focused on one operation and move broader coordination up into Application services.",
          ),
          reference.coordinate,
        ),
      );
    }

    return diagnostics;
  }

  private isServiceLike(declaration: IndexedDeclaration): boolean {
    switch (declaration.kind) {
      case NominalKind.Class:
      case NominalKind.Actor:
        return true;
      case NominalKind.Struct:
      case NominalKind.Protocol:
        return this.serviceSuffixes.some((suffix) =>
          declaration.name.endsWith(suffix),
        );
      case NominalKind.Enum:
        return false;
    }
  }
}

export class ApplicationServicesPlatformAPIPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.platform_api";

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServiceFile) {
      return [];
    }

    return platformIdentifierDiagnostics(
      file,
      ApplicationServicesPlatformAPIPolicy.ruleID,
      new Set(["process", "fetch", "Buffer", "window", "document"]),
      "Application services should orchestrate workflows, not directly use runtime, filesystem, or networking APIs.",
    );
  }
}

export class ApplicationServicesOrchestrationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.orchestration";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServiceFile) {
      return [];
    }

    const serviceDeclarations = file.topLevelDeclarations.filter(
      isServiceLikeDeclaration,
    );
    const hasValidServiceSurface = serviceDeclarations.some((declaration) =>
      exposedServiceSurfaceMethods(file, declaration.name).some((method) =>
        serviceMethodSatisfiesOrchestrationSurfaceRule(
          file,
          context,
          declaration.name,
          method,
        ),
      ),
    );

    const diagnostics: ArchitectureDiagnostic[] = [];

    if (!hasValidServiceSurface) {
      diagnostics.push(
        file.diagnostic(
          ApplicationServicesOrchestrationPolicy.ruleID,
          applicationRemediationMessage(
            `Application service file '${file.repoRelativePath}' exposes no valid orchestration surface.`,
            "Expose at least one service method that genuinely coordinates injected use cases or Application state transitions.",
          ),
        ),
      );
    }

    diagnostics.push(
      ...serviceDeclarations.flatMap((declaration) => {
        if (
          injectedApplicationUseCaseDependencyNames(
            file,
            context,
            declaration.name,
          ).size === 0
        ) {
          return [];
        }

        return exposedServiceSurfaceMethods(file, declaration.name).flatMap(
          (method) => {
            if (
              serviceMethodSatisfiesOrchestrationSurfaceRule(
                file,
                context,
                declaration.name,
                method,
              )
            ) {
              return [];
            }

            return [
              file.diagnostic(
                ApplicationServicesOrchestrationPolicy.ruleID,
                applicationRemediationMessage(
                  `Application service method '${method.name}' does not satisfy the orchestration surface rule.`,
                  "Keep invariant logic inward, keep state progression in Application/StateTransitions, and keep only real orchestration on service surfaces.",
                ),
                method.coordinate,
              ),
            ];
          },
        );
      }),
    );

    return diagnostics;
  }
}

export class ApplicationServicesSurfacePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "application.services.surface";

  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isApplicationServiceFile) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];
    const seenTerms = new Set<string>();

    for (const occurrence of file.identifierOccurrences) {
      const normalizedName = occurrence.name.toLowerCase();
      if (
        !PROVIDER_SPECIFIC_SURFACE_TERMS.has(normalizedName) ||
        seenTerms.has(normalizedName)
      ) {
        continue;
      }

      seenTerms.add(normalizedName);
      diagnostics.push(
        file.diagnostic(
          ApplicationServicesSurfacePolicy.ruleID,
          applicationRemediationMessage(
            `Application service file '${file.repoRelativePath}' references provider- or product-specific term '${occurrence.name}'.`,
            "Keep Application services provider-agnostic and move vendor terminology behind Application-facing protocols with Infrastructure implementations.",
          ),
          occurrence.coordinate,
        ),
      );
    }

    for (const occurrence of file.stringLiteralOccurrences) {
      const normalizedValue = occurrence.value.toLowerCase();
      const matchedTerm = [...PROVIDER_SPECIFIC_SURFACE_TERMS].find((term) =>
        normalizedValue.includes(term),
      );
      if (!matchedTerm || seenTerms.has(matchedTerm)) {
        continue;
      }

      seenTerms.add(matchedTerm);
      diagnostics.push(
        file.diagnostic(
          ApplicationServicesSurfacePolicy.ruleID,
          applicationRemediationMessage(
            `Application service file '${file.repoRelativePath}' contains provider- or product-specific string '${matchedTerm}'.`,
            "Keep provider-specific naming out of Application service surfaces.",
          ),
          occurrence.coordinate,
        ),
      );
    }

    const serviceTypeNames = new Set(
      file.topLevelDeclarations
        .filter(
          (declaration) =>
            declaration.kind !== NominalKind.Protocol &&
            declaration.name.endsWith("Service"),
        )
        .map((declaration) => declaration.name),
    );

    if (serviceTypeNames.size > 0) {
      const serviceStoredMembers = file.storedMemberDeclarations.filter(
        (declaration) =>
          serviceTypeNames.has(declaration.enclosingTypeName) && !declaration.isStatic,
      );
      const sinkDependencies = applicationServiceProjectionSinkDependencies(
        serviceStoredMembers,
        context,
      );

      const hasServiceLevelProjectionPipeline = sinkDependencies.some(
        (sinkDependency) => {
          const sourceContractNames = sinkDependency.sourceContractNames;
          const targetContractNames = sinkDependency.targetContractNames;

          if (
            sourceContractNames.size === 0 ||
            targetContractNames.size === 0 ||
            !surfaceHandlesApplicationContracts(
              sourceContractNames,
              file.methodDeclarations,
              file.constructorDeclarations,
              serviceStoredMembers,
              file.operationalUseOccurrences,
              serviceTypeNames,
            ) ||
            !surfaceConstructsOrReferencesApplicationContracts(
              targetContractNames,
              file.methodDeclarations,
              serviceStoredMembers,
              file.operationalUseOccurrences,
              file.typeReferences,
              file.identifierOccurrences,
              serviceTypeNames,
            )
          ) {
            return false;
          }

          const storesProjectionTargetsAtServiceLevel =
            storedMemberDeclarationsReferenceApplicationContracts(
              serviceStoredMembers,
              targetContractNames,
            );

          const emitsProjectionTargetsAtServiceLevel =
            file.operationalUseOccurrences.some(
              (occurrence) =>
                serviceTypeNames.has(occurrence.enclosingTypeName) &&
                occurrence.baseName === sinkDependency.memberName &&
                APPLICATION_SERVICES_TECHNICAL_PROJECTION_EMIT_MEMBER_NAMES.has(
                  occurrence.memberName,
                ),
            );

          return (
            storesProjectionTargetsAtServiceLevel ||
            emitsProjectionTargetsAtServiceLevel
          );
        },
      );

      const nestedProjectionHelper = file.nestedNominalDeclarations.find(
        (declaration) =>
          isNestedApplicationServiceTechnicalProjectionHelper(
            declaration,
            file,
            context,
          ),
      );

      if (hasServiceLevelProjectionPipeline || nestedProjectionHelper) {
        const coordinate =
          nestedProjectionHelper?.coordinate ??
          file.topLevelDeclarations.find((declaration) =>
            serviceTypeNames.has(declaration.name),
          )?.coordinate;

        diagnostics.push(
          file.diagnostic(
            ApplicationServicesSurfacePolicy.ruleID,
            applicationRemediationMessage(
              `Application service file '${file.repoRelativePath}' projects technical contracts into telemetry-style contracts or emits and stores those projections directly inside the service.`,
              "Move projection and emission work behind Application ports with Infrastructure implementations while keeping policy decisions in the service.",
            ),
            coordinate,
          ),
        );
      }
    }

    return diagnostics;
  }
}

export function makeApplicationArchitecturePolicies(): readonly ArchitecturePolicyProtocol[] {
  return [
    new ApplicationOuterLayerReferencePolicy(),
    new ApplicationPortProtocolsShapePolicy(),
    new ApplicationContractsShapePolicy(),
    new ApplicationContractsNestedErrorPlacementPolicy(),
    new ApplicationContractsNoErrorMappingSurfacePolicy(),
    new ApplicationContractsNoCollaboratorDependenciesPolicy(),
    new ApplicationContractsOwnershipPolicy(),
    new ApplicationContractsNoStateTransitionSurfacePolicy(),
    new ApplicationContractsErrorTaxonomyPolicy(),
    new ApplicationProtocolPlacementPolicy(),
    new ApplicationErrorsShapePolicy(),
    new ApplicationErrorsPlacementPolicy(),
    new ApplicationServicesNoProtocolsPolicy(),
    new ApplicationServicesShapePolicy(),
    new ApplicationServicesNoUseCasesPolicy(),
    new ApplicationUseCasesShapePolicy(),
    new ApplicationUseCasesNoProtocolsPolicy(),
    new ApplicationUseCasesOperationShapePolicy(),
    new ApplicationUseCasesAbstractionDelegationPolicy(),
    new ApplicationUseCasesSurfacePolicy(),
    new ApplicationServicesInfrastructureReferencePolicy(),
    new ApplicationServicesRepositoryReferencePolicy(),
    new ApplicationUseCasesInfrastructureReferencePolicy(),
    new ApplicationUseCasesPlatformAPIPolicy(),
    new ApplicationUseCasesServiceReferencePolicy(),
    new ApplicationServicesPlatformAPIPolicy(),
    new ApplicationServicesOrchestrationPolicy(),
    new ApplicationServicesSurfacePolicy(),
  ];
}

const APPLICATION_POLICY_FORBIDDEN_APIS = {
  platformTypes: new Set([
    "process",
    "fetch",
    "Buffer",
    "window",
    "document",
    "localStorage",
  ]),
};

const GENERIC_USE_CASE_OPERATION_METHOD_NAMES = new Set([
  "execute",
  "run",
  "perform",
]);

const EXPLICIT_CONTRACT_STATE_TRANSITION_PREFIXES = [
  "claim",
  "unclaim",
  "release",
  "register",
  "update",
  "schedule",
  "complete",
  "apply",
  "transition",
  "advance",
  "nextState",
  "previousState",
];

const APPLICATION_CONTRACT_FORBIDDEN_BOUNDARY_TYPE_NAMES = new Set([
  "Request",
  "Response",
  "Headers",
  "ReadableStream",
  "IncomingMessage",
  "ServerResponse",
  "Buffer",
]);

const APPLICATION_CONTRACT_ERROR_TAXONOMY_NAME_TERMS = new Set([
  "error",
  "errors",
  "failure",
  "failures",
  "failurecode",
  "failurecodes",
  "failurekind",
  "failurekinds",
]);

const APPLICATION_CONTRACT_ERROR_TAXONOMY_IDENTIFIER_TERMS = [
  "timeout",
  "failed",
  "failure",
  "cancelled",
  "canceled",
  "required",
  "notfound",
  "incompatible",
  "invalid",
  "error",
  "exit",
  "response",
  "policy",
  "input",
];

const APPLICATION_CONTRACT_ERROR_TAXONOMY_HELPER_PREFIXES = [
  "from",
  "map",
  "normalize",
];

const PROVIDER_SPECIFIC_SURFACE_TERMS = new Set([
  "api key",
  "apikey",
  "approval policy",
  "approvalpolicy",
  "codex",
  "codexcommand",
  "codex command",
  "endpoint",
  "github",
  "gitlab",
  "graphql",
  "jira",
  "linear",
  "openai",
  "project slug",
  "projectslug",
  "sandbox",
  "tracker kind",
  "trackerkind",
  "workflow path",
  "workflowpath",
  "workflow.md",
]);

const APPLICATION_SERVICES_TECHNICAL_PROJECTION_EMIT_MEMBER_NAMES = new Set([
  "emit",
]);

const APPLICATION_USE_CASE_PROJECTION_COLLECTION_MEMBER_NAMES = new Set([
  "compactMap",
  "flatMap",
  "map",
  "reduce",
  "sorted",
]);

const APPLICATION_USE_CASE_PROJECTION_CONTRACT_NAME_TERMS = [
  "event",
  "log",
  "row",
  "session",
  "snapshot",
  "status",
];

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

function applicationContractStateTransitionSurfaceMessage(
  surfaceDescription: string,
): string {
  return applicationRemediationMessage(
    `${surfaceDescription} appears to define next-state or progression semantics on a contract surface.`,
    "Move next-state semantics to Application/StateTransitions and keep contract surfaces observational only.",
  );
}

function applicationContractErrorMappingSurfaceMessage(
  surfaceDescription: string,
): string {
  return applicationRemediationMessage(
    `${surfaceDescription} appears to translate or shape error or failure information, which must not live on a contract surface.`,
    "Keep passive snapshot fields on contracts and move failure shaping to Application/Errors, Application/Services, Application/UseCases, or Infrastructure as appropriate.",
  );
}

function applicationContractCollaboratorDependencyMessage(
  dependencyName: string,
  declaration: IndexedDeclaration | undefined,
): string {
  let destinationGuidance =
    "Move collaborator-backed behavior off the contract surface and into the Application or Infrastructure construct that owns it.";

  if (declaration) {
    if (
      declaration.repoRelativePath.includes("/Application/Ports/Protocols/") ||
      declaration.repoRelativePath.includes("/Application/UseCases/")
    ) {
      destinationGuidance =
        "Move seam-backed operations to Application/UseCases.";
    } else if (
      declaration.layer === ArchitectureLayer.Infrastructure ||
      isRepositoryDependency(declaration)
    ) {
      destinationGuidance =
        "Move concrete boundary implementation to Infrastructure.";
    } else {
      destinationGuidance = "Move orchestration to Application/Services.";
    }
  }

  return applicationRemediationMessage(
    `Application contract file references collaborator or boundary type '${dependencyName}'; contract evaluators must remain collaborator-free and derive values only from stored contract state.`,
    destinationGuidance,
  );
}

function applicationContractOwnershipMessage(
  surfaceDescription: string,
  contractName: string,
  ownerPath: string,
): string {
  return applicationRemediationMessage(
    `${surfaceDescription} attaches behavior to Application contract type '${contractName}' from a non-owning file.`,
    `If the behavior is observational and collaborator-free, move it to the owning contract file at ${ownerPath}; otherwise move it to the non-contract surface that owns the work.`,
  );
}

function applicationRemediationMessage(
  summary: string,
  destination: string,
): string {
  return `${summary} Destination: ${destination}`;
}

function attachedApplicationContractDeclaration(
  typeName: string,
  file: ArchitectureFile,
  context: ProjectContext,
): IndexedDeclaration | undefined {
  const declaration = context.uniqueDeclaration(typeName);
  if (
    !declaration ||
    !isApplicationContractDeclaration(declaration) ||
    declaration.repoRelativePath === file.repoRelativePath
  ) {
    return undefined;
  }

  return declaration;
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

function isForbiddenApplicationContractDependencyTypeName(
  typeName: string,
  context: ProjectContext,
): boolean {
  const normalizedTypeName = canonicalArchitectureTypeName(typeName);

  if (APPLICATION_CONTRACT_FORBIDDEN_BOUNDARY_TYPE_NAMES.has(normalizedTypeName)) {
    return true;
  }

  if (normalizedTypeName.endsWith("RepositoryProtocol")) {
    return true;
  }

  const declaration = context.uniqueDeclaration(normalizedTypeName);
  if (!declaration) {
    return false;
  }

  return (
    declaration.roleFolder === RoleFolder.ApplicationPortsProtocols ||
    declaration.roleFolder === RoleFolder.ApplicationServices ||
    declaration.roleFolder === RoleFolder.ApplicationUseCases ||
    declaration.roleFolder === RoleFolder.InfrastructureRepositories ||
    declaration.roleFolder === RoleFolder.InfrastructureGateways ||
    declaration.roleFolder === RoleFolder.InfrastructurePortAdapters ||
    declaration.roleFolder === RoleFolder.InfrastructureEvaluators
  );
}

function canonicalArchitectureTypeName(typeName: string): string {
  return typeName
    .replaceAll("any ", "")
    .replaceAll("some ", "")
    .replaceAll("?", "")
    .replaceAll("!", "")
    .trim();
}

function isErrorShapedContractNestedDeclaration(
  declaration: ArchitectureNestedNominalDeclaration,
): boolean {
  return (
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

function isErrorShapedTypeName(
  typeName: string,
  context: ProjectContext,
): boolean {
  if (
    typeName === "Error" ||
    typeName === "StructuredErrorProtocol" ||
    typeName === "LocalizedError" ||
    typeName.endsWith("Error")
  ) {
    return true;
  }

  const declaration = context.uniqueDeclaration(typeName);
  return declaration ? isErrorShapedIndexedDeclaration(declaration) : false;
}

function isErrorShapedIndexedDeclaration(
  declaration: IndexedDeclaration,
): boolean {
  return (
    declaration.name.endsWith("Error") ||
    declaration.inheritedTypeNames.includes("StructuredErrorProtocol") ||
    declaration.inheritedTypeNames.includes("Error") ||
    declaration.inheritedTypeNames.includes("LocalizedError") ||
    declaration.roleFolder === RoleFolder.DomainErrors ||
    declaration.roleFolder === RoleFolder.ApplicationErrors ||
    declaration.roleFolder === RoleFolder.InfrastructureErrors ||
    declaration.roleFolder === RoleFolder.PresentationErrors
  );
}

function isForbiddenApplicationContractErrorTaxonomy(
  declaration: ArchitectureTopLevelDeclaration,
  file: ArchitectureFile,
): boolean {
  if (
    declaration.inheritedTypeNames.includes("StructuredErrorProtocol") ||
    declaration.inheritedTypeNames.includes("Error") ||
    declaration.inheritedTypeNames.includes("LocalizedError")
  ) {
    return true;
  }

  switch (declaration.kind) {
    case NominalKind.Enum:
      return isForbiddenApplicationContractErrorTaxonomyEnum(declaration, file);
    case NominalKind.Struct:
      return isForbiddenApplicationContractErrorTaxonomyStruct(
        declaration,
        file,
      );
    default:
      return false;
  }
}

function isForbiddenApplicationContractErrorTaxonomyEnum(
  declaration: ArchitectureTopLevelDeclaration,
  file: ArchitectureFile,
): boolean {
  if (!isApplicationContractErrorTaxonomyName(declaration.name)) {
    return false;
  }

  const caseSignalCount = applicationContractErrorTaxonomySignalCount(
    file,
    declaration.name,
  );
  const hasStructuredErrorMembers = isSubset(
    STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES,
    new Set(declaration.memberNames),
  );
  const hasTaxonomyHelpers = declaration.memberNames.some((memberName) =>
    isApplicationContractErrorTaxonomyHelperName(memberName),
  );

  return caseSignalCount >= 2 || hasStructuredErrorMembers || hasTaxonomyHelpers;
}

function isForbiddenApplicationContractErrorTaxonomyStruct(
  declaration: ArchitectureTopLevelDeclaration,
  file: ArchitectureFile,
): boolean {
  if (!isApplicationContractErrorTaxonomyName(declaration.name)) {
    return false;
  }

  if (isAllowedApplicationContractErrorSnapshotStruct(declaration)) {
    return false;
  }

  const hasStructuredErrorMembers = isSubset(
    STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES,
    new Set(declaration.memberNames),
  );
  const hasTaxonomyHelpers = declaration.memberNames.some((memberName) =>
    isApplicationContractErrorTaxonomyHelperName(memberName),
  );
  const caseSignalCount = applicationContractErrorTaxonomySignalCount(
    file,
    declaration.name,
  );

  return hasStructuredErrorMembers || hasTaxonomyHelpers || caseSignalCount >= 2;
}

function isAllowedApplicationContractErrorSnapshotStruct(
  declaration: ArchitectureTopLevelDeclaration,
): boolean {
  if (declaration.kind !== NominalKind.Struct) {
    return false;
  }

  const memberNames = new Set(declaration.memberNames);
  if (
    !isSubset(STRUCTURED_ERROR_REQUIRED_MEMBER_NAMES, memberNames) ||
    declaration.inheritedTypeNames.length > 0
  ) {
    return false;
  }

  return !declaration.memberNames.some((memberName) =>
    isApplicationContractErrorTaxonomyHelperName(memberName),
  );
}

function isApplicationContractErrorTaxonomyName(name: string): boolean {
  const normalized = normalizeTaxonomyTerm(name);
  return [...APPLICATION_CONTRACT_ERROR_TAXONOMY_NAME_TERMS].some((term) =>
    normalized.includes(term),
  );
}

function isApplicationContractErrorTaxonomyHelperName(name: string): boolean {
  const normalized = normalizeTaxonomyTerm(name);
  return (
    APPLICATION_CONTRACT_ERROR_TAXONOMY_HELPER_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix),
    ) && normalized.includes("error")
  );
}

function applicationContractErrorTaxonomySignalCount(
  file: ArchitectureFile,
  declarationName: string,
): number {
  const excludedName = normalizeTaxonomyTerm(declarationName);
  const matchedIdentifiers = new Set(
    file.identifierOccurrences.flatMap((occurrence) => {
      const normalized = normalizeTaxonomyTerm(occurrence.name);
      if (
        normalized === excludedName ||
        !APPLICATION_CONTRACT_ERROR_TAXONOMY_IDENTIFIER_TERMS.some((term) =>
          normalized.includes(term),
        )
      ) {
        return [];
      }

      return [normalized];
    }),
  );

  const matchedStrings = new Set(
    file.stringLiteralOccurrences.flatMap((occurrence) => {
      const normalized = normalizeTaxonomyTerm(occurrence.value);
      if (
        !APPLICATION_CONTRACT_ERROR_TAXONOMY_IDENTIFIER_TERMS.some((term) =>
          normalized.includes(term),
        )
      ) {
        return [];
      }

      return [normalized];
    }),
  );

  return new Set([...matchedIdentifiers, ...matchedStrings]).size;
}

function normalizeTaxonomyTerm(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z]/g, "");
}

interface ApplicationServiceProjectionSinkDependency {
  readonly memberName: string;
  readonly sourceContractNames: ReadonlySet<string>;
  readonly targetContractNames: ReadonlySet<string>;
}

function isNestedApplicationServiceTechnicalProjectionHelper(
  declaration: ArchitectureNestedNominalDeclaration,
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const methods = file.methodDeclarations.filter(
    (method) => method.enclosingTypeName === declaration.name,
  );
  const constructors = file.constructorDeclarations.filter(
    (initializer) => initializer.enclosingTypeName === declaration.name,
  );
  const storedMembers = file.storedMemberDeclarations.filter(
    (storedMember) =>
      storedMember.enclosingTypeName === declaration.name && !storedMember.isStatic,
  );
  const sinkDependencies = applicationServiceProjectionSinkDependencies(
    storedMembers,
    context,
  );

  return sinkDependencies.some((sinkDependency) => {
    const sourceContractNames = sinkDependency.sourceContractNames;
    const targetContractNames = sinkDependency.targetContractNames;

    if (
      sourceContractNames.size === 0 ||
      targetContractNames.size === 0 ||
      !surfaceHandlesApplicationContracts(
        sourceContractNames,
        methods,
        constructors,
        storedMembers,
        file.operationalUseOccurrences,
        new Set([declaration.name]),
      )
    ) {
      return false;
    }

    const storesProjectionTargets =
      storedMemberDeclarationsReferenceApplicationContracts(
        storedMembers,
        targetContractNames,
      );
    const returnsProjectionTargets = methods.some((method) =>
      method.returnTypeNames.some((returnTypeName) =>
        targetContractNames.has(canonicalArchitectureTypeName(returnTypeName)),
      ),
    );
    const emitsProjectionTargets = file.operationalUseOccurrences.some(
      (occurrence) =>
        occurrence.enclosingTypeName === declaration.name &&
        occurrence.baseName === sinkDependency.memberName &&
        APPLICATION_SERVICES_TECHNICAL_PROJECTION_EMIT_MEMBER_NAMES.has(
          occurrence.memberName,
        ),
    );

    return storesProjectionTargets || returnsProjectionTargets || emitsProjectionTargets;
  });
}

function applicationServiceProjectionSinkDependencies(
  storedMembers: readonly ArchitectureStoredMemberDeclaration[],
  context: ProjectContext,
): readonly ApplicationServiceProjectionSinkDependency[] {
  return storedMembers.flatMap((storedMember) => {
    for (const rawTypeName of storedMember.typeNames) {
      const typeName = canonicalArchitectureTypeName(rawTypeName);
      const declaration = context.uniqueDeclaration(typeName);
      if (
        !declaration ||
        !isSinkShapedApplicationPortProtocol(declaration, context)
      ) {
        continue;
      }

      const acceptedContractNames = acceptedApplicationContractNames(
        declaration,
        context,
      );
      const sourceContractNames = new Set(
        [...acceptedContractNames].filter(
          (name) => !isProjectionShapedApplicationContractName(name),
        ),
      );
      const targetContractNames = new Set(
        [...acceptedContractNames].filter((name) =>
          isProjectionShapedApplicationContractName(name),
        ),
      );

      if (sourceContractNames.size === 0 || targetContractNames.size === 0) {
        continue;
      }

      return [
        {
          memberName: storedMember.name,
          sourceContractNames,
          targetContractNames,
        },
      ];
    }

    return [];
  });
}

function acceptedApplicationContractNames(
  declaration: IndexedDeclaration,
  context: ProjectContext,
): ReadonlySet<string> {
  return new Set(
    declaration.methodShapes.flatMap((methodShape) =>
      methodShape.parameterTypeNames.flatMap((rawTypeName) => {
        const typeName = canonicalArchitectureTypeName(rawTypeName);
        const acceptedDeclaration = context.uniqueDeclaration(typeName);
        if (
          !acceptedDeclaration ||
          !isApplicationContractDeclaration(acceptedDeclaration)
        ) {
          return [];
        }

        return [acceptedDeclaration.name];
      }),
    ),
  );
}

function isSinkShapedApplicationPortProtocol(
  declaration: IndexedDeclaration,
  context: ProjectContext,
): boolean {
  return (
    declaration.roleFolder === RoleFolder.ApplicationPortsProtocols &&
    declaration.methodShapes.length > 0 &&
    declaration.methodShapes.every((methodShape) => methodShape.returnsVoidLike) &&
    acceptedApplicationContractNames(declaration, context).size > 0
  );
}

function isValidSinkShapedApplicationPortMethod(
  declaration: ArchitectureMethodDeclaration,
  context: ProjectContext,
): boolean {
  const normalizedParameterTypeNames = declaration.parameterTypeNames.map(
    canonicalArchitectureTypeName,
  );
  const applicationContractParameterCount = normalizedParameterTypeNames.reduce(
    (count, typeName) => {
      const indexedDeclaration = context.uniqueDeclaration(typeName);
      return indexedDeclaration && isApplicationContractDeclaration(indexedDeclaration)
        ? count + 1
        : count;
    },
    0,
  );

  return (
    applicationContractParameterCount === 1 &&
    normalizedParameterTypeNames.length === 1
  );
}

function surfaceHandlesApplicationContracts(
  contractNames: ReadonlySet<string>,
  methodDeclarations: readonly ArchitectureMethodDeclaration[],
  constructorDeclarations: readonly ArchitectureConstructorDeclaration[],
  storedMemberDeclarations: readonly ArchitectureStoredMemberDeclaration[],
  operationalUseOccurrences: readonly ArchitectureOperationalUseOccurrence[],
  enclosingTypeNames: ReadonlySet<string>,
): boolean {
  if (
    methodDeclarations.some(
      (declaration) =>
        enclosingTypeNames.has(declaration.enclosingTypeName) &&
        declaration.parameterTypeNames.some((typeName) =>
          contractNames.has(canonicalArchitectureTypeName(typeName)),
        ),
    )
  ) {
    return true;
  }

  if (
    constructorDeclarations.some(
      (declaration) =>
        enclosingTypeNames.has(declaration.enclosingTypeName) &&
        declaration.parameterTypeNames.some((typeName) =>
          contractNames.has(canonicalArchitectureTypeName(typeName)),
        ),
    )
  ) {
    return true;
  }

  if (
    storedMemberDeclarationsReferenceApplicationContracts(
      storedMemberDeclarations,
      contractNames,
    )
  ) {
    return true;
  }

  return operationalUseOccurrences.some(
    (occurrence) =>
      enclosingTypeNames.has(occurrence.enclosingTypeName) &&
      occurrence.memberName === "new" &&
      contractNames.has(canonicalArchitectureTypeName(occurrence.baseName)),
  );
}

function surfaceConstructsOrReferencesApplicationContracts(
  contractNames: ReadonlySet<string>,
  methodDeclarations: readonly ArchitectureMethodDeclaration[],
  storedMemberDeclarations: readonly ArchitectureStoredMemberDeclaration[],
  operationalUseOccurrences: readonly ArchitectureOperationalUseOccurrence[],
  typeReferences: readonly ArchitectureTypeReference[],
  identifierOccurrences: readonly ArchitectureIdentifierOccurrence[],
  enclosingTypeNames: ReadonlySet<string>,
): boolean {
  if (
    storedMemberDeclarationsReferenceApplicationContracts(
      storedMemberDeclarations,
      contractNames,
    )
  ) {
    return true;
  }

  if (
    methodDeclarations.some(
      (declaration) =>
        enclosingTypeNames.has(declaration.enclosingTypeName) &&
        declaration.returnTypeNames.some((typeName) =>
          contractNames.has(canonicalArchitectureTypeName(typeName)),
        ),
    )
  ) {
    return true;
  }

  if (
    operationalUseOccurrences.some(
      (occurrence) =>
        enclosingTypeNames.has(occurrence.enclosingTypeName) &&
        occurrence.memberName === "new" &&
        contractNames.has(canonicalArchitectureTypeName(occurrence.baseName)),
    )
  ) {
    return true;
  }

  if (
    typeReferences.some((reference) =>
      contractNames.has(canonicalArchitectureTypeName(reference.name)),
    )
  ) {
    return true;
  }

  return identifierOccurrences.some((occurrence) =>
    contractNames.has(canonicalArchitectureTypeName(occurrence.name)),
  );
}

function storedMemberDeclarationsReferenceApplicationContracts(
  declarations: readonly ArchitectureStoredMemberDeclaration[],
  contractNames: ReadonlySet<string>,
): boolean {
  return declarations.some((declaration) =>
    declaration.typeNames.some((typeName) =>
      contractNames.has(canonicalArchitectureTypeName(typeName)),
    ),
  );
}

function useCaseMethodKeepsProjectionOrTranslationInline(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
  method: ArchitectureMethodDeclaration,
): boolean {
  const operationalUses = file.operationalUseOccurrences.filter(
    (occurrence) =>
      occurrence.enclosingTypeName === enclosingTypeName &&
      occurrence.enclosingMethodName === method.name,
  );
  if (operationalUses.length === 0) {
    return false;
  }

  const hasProjectionCollectionOperation = operationalUses.some((occurrence) =>
    APPLICATION_USE_CASE_PROJECTION_COLLECTION_MEMBER_NAMES.has(
      occurrence.memberName,
    ),
  );
  if (!hasProjectionCollectionOperation) {
    return false;
  }

  const constructedApplicationContracts = new Set(
    operationalUses.flatMap((occurrence) => {
      if (occurrence.memberName !== "new") {
        return [];
      }

      const declaration = context.uniqueDeclaration(occurrence.baseName);
      if (!declaration || !isApplicationContractDeclaration(declaration)) {
        return [];
      }

      return [declaration.name];
    }),
  );
  if (constructedApplicationContracts.size === 0) {
    return false;
  }

  const returnedApplicationContracts = new Set(
    method.returnTypeNames.flatMap((typeName) => {
      const normalizedTypeName = canonicalArchitectureTypeName(typeName);
      const declaration = context.uniqueDeclaration(normalizedTypeName);
      if (!declaration || !isApplicationContractDeclaration(declaration)) {
        return [];
      }

      return [declaration.name];
    }),
  );

  const auxiliaryConstructedContracts = new Set(
    [...constructedApplicationContracts].filter(
      (name) => !returnedApplicationContracts.has(name),
    ),
  );
  const projectionShapedAuxiliaryContracts = [...auxiliaryConstructedContracts].filter(
    (name) => isProjectionShapedApplicationContractName(name),
  );
  if (projectionShapedAuxiliaryContracts.length > 0) {
    return true;
  }

  return (
    [...returnedApplicationContracts].some((name) =>
      isProjectionShapedApplicationContractName(name),
    ) &&
    constructedApplicationContracts.size > returnedApplicationContracts.size
  );
}

function useCaseStateTransitionDependencyNames(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
): ReadonlySet<string> {
  return new Set(
    file.storedMemberDeclarations.flatMap((declaration) => {
      if (
        declaration.enclosingTypeName !== enclosingTypeName ||
        declaration.isStatic
      ) {
        return [];
      }

      const referencesStateTransition = declaration.typeNames.some((typeName) => {
        const indexedDeclaration = context.uniqueDeclaration(typeName);
        return (
          indexedDeclaration?.roleFolder === RoleFolder.ApplicationStateTransitions
        );
      });

      return referencesStateTransition ? [declaration.name] : [];
    }),
  );
}

function useCaseNonPublicHelperMethodNames(
  file: ArchitectureFile,
  enclosingTypeName: string,
): ReadonlySet<string> {
  return new Set(
    file.methodDeclarations.flatMap((declaration) => {
      if (
        declaration.enclosingTypeName !== enclosingTypeName ||
        declaration.isStatic ||
        !declaration.isPrivateOrFileprivate
      ) {
        return [];
      }

      return [declaration.name];
    }),
  );
}

function useCaseMethodOperationallyUsesApplicationStateTransition(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
  methodName: string,
  visitedMethodNames: ReadonlySet<string> = new Set(),
): boolean {
  if (visitedMethodNames.has(methodName)) {
    return false;
  }

  const stateTransitionDependencyNames = useCaseStateTransitionDependencyNames(
    file,
    context,
    enclosingTypeName,
  );
  if (stateTransitionDependencyNames.size === 0) {
    return false;
  }

  if (
    file.operationalUseOccurrences.some(
      (occurrence) =>
        occurrence.enclosingTypeName === enclosingTypeName &&
        occurrence.enclosingMethodName === methodName &&
        stateTransitionDependencyNames.has(occurrence.baseName),
    )
  ) {
    return true;
  }

  const helperMethodNames = useCaseNonPublicHelperMethodNames(
    file,
    enclosingTypeName,
  );
  const calledHelperNames = new Set(
    file.operationalUseOccurrences.flatMap((occurrence) => {
      if (
        occurrence.enclosingTypeName !== enclosingTypeName ||
        occurrence.enclosingMethodName !== methodName ||
        !helperMethodNames.has(occurrence.baseName)
      ) {
        return [];
      }

      return [occurrence.baseName];
    }),
  );

  const nextVisitedMethodNames = new Set(visitedMethodNames).add(methodName);
  return [...calledHelperNames].some((helperMethodName) =>
    useCaseMethodOperationallyUsesApplicationStateTransition(
      file,
      context,
      enclosingTypeName,
      helperMethodName,
      nextVisitedMethodNames,
    ),
  );
}

function isProjectionShapedApplicationContractName(typeName: string): boolean {
  const normalized = normalizeTaxonomyTerm(typeName);
  return APPLICATION_USE_CASE_PROJECTION_CONTRACT_NAME_TERMS.some((term) =>
    normalized.includes(term),
  );
}

function isRepositoryDependency(declaration: IndexedDeclaration): boolean {
  if (
    declaration.layer === ArchitectureLayer.Infrastructure &&
    declaration.roleFolder === RoleFolder.InfrastructureRepositories
  ) {
    return true;
  }

  return (
    declaration.kind === NominalKind.Protocol &&
    declaration.roleFolder === RoleFolder.DomainProtocols &&
    isRepositoryLikeName(declaration.name)
  );
}

function isRepositoryLikeName(name: string): boolean {
  return name.endsWith("RepositoryProtocol") || name.endsWith("Repository");
}

function referencesOrchestrationCollaborator(
  file: ArchitectureFile,
  context: ProjectContext,
): boolean {
  const collaboratorNames = new Set(
    file.typedMemberOccurrences.flatMap((occurrence) => {
      const hasOrchestrationType = occurrence.typeNames.some((typeName) => {
        const declaration = context.uniqueDeclaration(typeName);
        if (!declaration) {
          return false;
        }

        if (declaration.roleFolder === RoleFolder.ApplicationServices) {
          return isServiceLike(declaration);
        }

        return (
          declaration.roleFolder === RoleFolder.ApplicationUseCases ||
          declaration.roleFolder === RoleFolder.ApplicationStateTransitions
        );
      });

      return hasOrchestrationType ? [occurrence.name] : [];
    }),
  );

  if (collaboratorNames.size === 0) {
    return false;
  }

  return file.memberCallOccurrences.some((occurrence) =>
    collaboratorNames.has(occurrence.baseName),
  );
}

function exposedServiceSurfaceMethods(
  file: ArchitectureFile,
  enclosingTypeName: string,
): readonly ArchitectureMethodDeclaration[] {
  return file.methodDeclarations.filter(
    (declaration) =>
      declaration.enclosingTypeName === enclosingTypeName &&
      !declaration.isStatic &&
      declaration.isPublicOrOpen,
  );
}

function injectedApplicationUseCaseDependencyNames(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
): ReadonlySet<string> {
  return new Set(
    file.storedMemberDeclarations.flatMap((declaration) => {
      if (
        declaration.enclosingTypeName !== enclosingTypeName ||
        declaration.isStatic
      ) {
        return [];
      }

      const referencesUseCase = declaration.typeNames.some((typeName) => {
        const indexedDeclaration = context.uniqueDeclaration(typeName);
        return (
          indexedDeclaration?.roleFolder === RoleFolder.ApplicationUseCases
        );
      });

      return referencesUseCase ? [declaration.name] : [];
    }),
  );
}

function injectedApplicationStateTransitionDependencyNames(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
): ReadonlySet<string> {
  return new Set(
    file.storedMemberDeclarations.flatMap((declaration) => {
      if (
        declaration.enclosingTypeName !== enclosingTypeName ||
        declaration.isStatic
      ) {
        return [];
      }

      const referencesStateTransition = declaration.typeNames.some((typeName) => {
        const indexedDeclaration = context.uniqueDeclaration(typeName);
        return (
          indexedDeclaration?.roleFolder === RoleFolder.ApplicationStateTransitions
        );
      });

      return referencesStateTransition ? [declaration.name] : [];
    }),
  );
}

function serviceNonPublicHelperMethodNames(
  file: ArchitectureFile,
  enclosingTypeName: string,
): ReadonlySet<string> {
  return new Set(
    file.methodDeclarations.flatMap((declaration) => {
      if (
        declaration.enclosingTypeName !== enclosingTypeName ||
        declaration.isStatic ||
        !declaration.isPrivateOrFileprivate
      ) {
        return [];
      }

      return [declaration.name];
    }),
  );
}

function serviceMethodOperationallyUsesInjectedApplicationOrchestrationDependency(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
  methodName: string,
  visitedMethodNames: ReadonlySet<string> = new Set(),
): boolean {
  if (visitedMethodNames.has(methodName)) {
    return false;
  }

  const useCaseDependencyNames = injectedApplicationUseCaseDependencyNames(
    file,
    context,
    enclosingTypeName,
  );
  const stateTransitionDependencyNames =
    injectedApplicationStateTransitionDependencyNames(
      file,
      context,
      enclosingTypeName,
    );
  const orchestrationDependencyNames = new Set([
    ...useCaseDependencyNames,
    ...stateTransitionDependencyNames,
  ]);
  if (orchestrationDependencyNames.size === 0) {
    return false;
  }

  if (
    file.operationalUseOccurrences.some(
      (occurrence) =>
        occurrence.enclosingTypeName === enclosingTypeName &&
        occurrence.enclosingMethodName === methodName &&
        orchestrationDependencyNames.has(occurrence.baseName),
    )
  ) {
    return true;
  }

  const helperMethodNames = serviceNonPublicHelperMethodNames(
    file,
    enclosingTypeName,
  );
  const calledHelperNames = new Set(
    file.operationalUseOccurrences.flatMap((occurrence) => {
      if (
        occurrence.enclosingTypeName !== enclosingTypeName ||
        occurrence.enclosingMethodName !== methodName ||
        !helperMethodNames.has(occurrence.baseName)
      ) {
        return [];
      }

      return [occurrence.baseName];
    }),
  );

  const nextVisitedMethodNames = new Set(visitedMethodNames).add(methodName);
  return [...calledHelperNames].some((helperMethodName) =>
    serviceMethodOperationallyUsesInjectedApplicationOrchestrationDependency(
      file,
      context,
      enclosingTypeName,
      helperMethodName,
      nextVisitedMethodNames,
    ),
  );
}

function serviceMethodSatisfiesOrchestrationSurfaceRule(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
  method: ArchitectureMethodDeclaration,
): boolean {
  if (
    !serviceMethodOperationallyUsesInjectedApplicationOrchestrationDependency(
      file,
      context,
      enclosingTypeName,
      method.name,
    )
  ) {
    return false;
  }

  return !isThinForwardingFacadeServiceMethod(
    file,
    context,
    enclosingTypeName,
    method,
  );
}

function isThinForwardingFacadeServiceMethod(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
  declaration: ArchitectureMethodDeclaration,
): boolean {
  const useCaseDependencyNames = injectedApplicationUseCaseDependencyNames(
    file,
    context,
    enclosingTypeName,
  );
  if (useCaseDependencyNames.size === 0) {
    return false;
  }

  const helperMethodNames = serviceNonPublicHelperMethodNames(
    file,
    enclosingTypeName,
  );
  const operationalUses = file.operationalUseOccurrences.filter(
    (occurrence) =>
      occurrence.enclosingTypeName === enclosingTypeName &&
      occurrence.enclosingMethodName === declaration.name,
  );
  if (operationalUses.length === 0) {
    return false;
  }

  const directUseCaseCalls = operationalUses.filter((occurrence) =>
    useCaseDependencyNames.has(occurrence.baseName),
  );
  if (directUseCaseCalls.length === 0) {
    return false;
  }

  if (
    operationalUses.some((occurrence) =>
      helperMethodNames.has(occurrence.baseName),
    )
  ) {
    return false;
  }

  const nonUseCaseOperationalUses = operationalUses.filter(
    (occurrence) => !useCaseDependencyNames.has(occurrence.baseName),
  );
  if (nonUseCaseOperationalUses.length > 0) {
    return false;
  }

  return new Set(directUseCaseCalls.map((occurrence) => occurrence.baseName)).size === 1;
}

function concreteUseCaseDeclarations(
  file: ArchitectureFile,
): readonly ArchitectureTopLevelDeclaration[] {
  return file.topLevelDeclarations.filter(
    (declaration) =>
      declaration.name.endsWith("UseCase") &&
      declaration.kind !== NominalKind.Protocol,
  );
}

function operationSurfaceUseCaseDeclarations(
  file: ArchitectureFile,
): readonly ArchitectureTopLevelDeclaration[] {
  return file.topLevelDeclarations.filter(
    (declaration) =>
      declaration.name.endsWith("UseCase") &&
      declaration.kind !== NominalKind.Enum,
  );
}

function applicationOperationMethods(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
): readonly ArchitectureMethodDeclaration[] {
  return file.methodDeclarations.filter(
    (declaration) =>
      declaration.enclosingTypeName === enclosingTypeName &&
      !declaration.isStatic &&
      !declaration.isPrivateOrFileprivate &&
      returnsOperationSurfaceResult(declaration, context),
  );
}

function nonPrivateInstanceUseCaseMethods(
  file: ArchitectureFile,
  enclosingTypeName: string,
): readonly ArchitectureMethodDeclaration[] {
  return file.methodDeclarations.filter(
    (declaration) =>
      declaration.enclosingTypeName === enclosingTypeName &&
      !declaration.isStatic &&
      !declaration.isPrivateOrFileprivate,
  );
}

function hasInvalidMultiMethodOperationNaming(
  declarations: readonly ArchitectureMethodDeclaration[],
): boolean {
  if (declarations.length <= 1) {
    return false;
  }

  const methodNames = declarations.map((declaration) => declaration.name);
  return (
    methodNames.some((name) => GENERIC_USE_CASE_OPERATION_METHOD_NAMES.has(name)) ||
    new Set(methodNames).size !== methodNames.length
  );
}

function methodOperationallyUsesInwardAbstraction(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
  methodName: string,
): boolean {
  const inwardDependencyNames = inwardAbstractionDependencyNames(
    file,
    context,
    enclosingTypeName,
  );
  if (inwardDependencyNames.size === 0) {
    return false;
  }

  return file.operationalUseOccurrences.some(
    (occurrence) =>
      occurrence.enclosingTypeName === enclosingTypeName &&
      occurrence.enclosingMethodName === methodName &&
      inwardDependencyNames.has(occurrence.baseName),
  );
}

function inwardAbstractionDependencyNames(
  file: ArchitectureFile,
  context: ProjectContext,
  enclosingTypeName: string,
): ReadonlySet<string> {
  return new Set(
    file.storedMemberDeclarations.flatMap((declaration) => {
      if (
        declaration.enclosingTypeName !== enclosingTypeName ||
        declaration.isStatic
      ) {
        return [];
      }

      const referencesInwardProtocol = declaration.typeNames.some((typeName) => {
        const indexedDeclaration = context.uniqueDeclaration(typeName);
        if (!indexedDeclaration || indexedDeclaration.kind !== NominalKind.Protocol) {
          return false;
        }

        return (
          indexedDeclaration.roleFolder === RoleFolder.ApplicationPortsProtocols ||
          indexedDeclaration.roleFolder === RoleFolder.DomainProtocols
        );
      });

      return referencesInwardProtocol ? [declaration.name] : [];
    }),
  );
}

function returnsOperationSurfaceResult(
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
        (isApplicationContractDeclaration(indexedDeclaration) ||
          isDomainEntityDeclaration(indexedDeclaration)),
    );
  });
}

function isDomainEntityDeclaration(declaration: IndexedDeclaration): boolean {
  if (
    declaration.layer !== ArchitectureLayer.Domain ||
    declaration.roleFolder !== RoleFolder.None ||
    declaration.kind === NominalKind.Protocol
  ) {
    return false;
  }

  const pathComponents = declaration.repoRelativePath
    .replaceAll("\\", "/")
    .split("/");
  const domainIndex = pathComponents.indexOf("Domain");
  return (
    domainIndex >= 0 &&
    domainIndex + 1 < pathComponents.length &&
    pathComponents[domainIndex + 1] === "Entities"
  );
}

function isServiceLikeDeclaration(
  declaration: ArchitectureTopLevelDeclaration,
): boolean {
  return (
    declaration.kind !== NominalKind.Protocol &&
    declaration.name.endsWith("Service")
  );
}

function isServiceLike(declaration: IndexedDeclaration): boolean {
  switch (declaration.kind) {
    case NominalKind.Class:
    case NominalKind.Actor:
      return true;
    case NominalKind.Struct:
    case NominalKind.Protocol:
      return declaration.name.endsWith("Service");
    case NominalKind.Enum:
      return false;
  }
}

function isApplicationContractStateTransitionMethod(
  declaration: ArchitectureMethodDeclaration,
): boolean {
  return (
    isDirectApplicationContractSurfaceType(
      declaration.returnTypeDescription,
      declaration.enclosingTypeName,
    ) || isExplicitContractStateTransitionName(declaration.name)
  );
}

function isApplicationContractStateTransitionComputedProperty(
  declaration: ArchitectureComputedPropertyDeclaration,
): boolean {
  return (
    isDirectApplicationContractSurfaceType(
      declaration.typeDescription,
      declaration.enclosingTypeName,
    ) || isExplicitContractStateTransitionName(declaration.name)
  );
}

function isDirectApplicationContractSurfaceType(
  typeDescription: string | undefined,
  enclosingTypeName: string,
): boolean {
  if (!typeDescription) {
    return false;
  }

  const normalized = typeDescription.replaceAll(" ", "");
  return (
    normalized === enclosingTypeName ||
    normalized === `${enclosingTypeName}?` ||
    normalized === `${enclosingTypeName}!`
  );
}

function isExplicitContractStateTransitionName(name: string): boolean {
  return EXPLICIT_CONTRACT_STATE_TRANSITION_PREFIXES.some((prefix) =>
    name.startsWith(prefix),
  );
}

function applicationErrorFileBaseName(repoRelativePath: string): string {
  const fileName = repoRelativePath.split("/").at(-1) ?? repoRelativePath;
  return fileName.endsWith(".ts")
    ? fileName.replace(/\.[^.]+$/, "")
    : fileName;
}

function isApplicationStructuredErrorPlacementDeclaration(
  declaration: ArchitectureTopLevelDeclaration,
  namingValidator: (declaration: ArchitectureTopLevelDeclaration) => boolean,
): boolean {
  if (declaration.kind === NominalKind.Protocol) {
    return false;
  }

  return (
    namingValidator(declaration) ||
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

function platformIdentifierDiagnostics(
  file: ArchitectureFile,
  ruleID: string,
  forbiddenIdentifiers: ReadonlySet<string>,
  guidance: string,
): readonly ArchitectureDiagnostic[] {
  const diagnostics: ArchitectureDiagnostic[] = [];
  const seenNames = new Set<string>();

  for (const occurrence of file.identifierOccurrences) {
    if (
      !forbiddenIdentifiers.has(occurrence.name) ||
      seenNames.has(occurrence.name)
    ) {
      continue;
    }

    seenNames.add(occurrence.name);
    diagnostics.push(
      file.diagnostic(
        ruleID,
        applicationRemediationMessage(
          `Application file '${file.repoRelativePath}' references platform or runtime API '${occurrence.name}'.`,
          guidance,
        ),
        occurrence.coordinate,
      ),
    );
  }

  return diagnostics;
}

function referenceLayerDiagnostics(
  file: ArchitectureFile,
  context: ProjectContext,
  ruleID: string,
  predicate: (declaration: IndexedDeclaration) => boolean,
  guidance: string,
): readonly ArchitectureDiagnostic[] {
  const diagnostics: ArchitectureDiagnostic[] = [];
  const seenNames = new Set<string>();

  for (const reference of file.typeReferences) {
    if (seenNames.has(reference.name)) {
      continue;
    }
    seenNames.add(reference.name);

    const declaration = context.uniqueDeclaration(reference.name);
    if (!declaration || !predicate(declaration)) {
      continue;
    }

    diagnostics.push(
      file.diagnostic(
        ruleID,
        applicationRemediationMessage(
          `Application file '${file.repoRelativePath}' references '${reference.name}' from '${declaration.repoRelativePath}'.`,
          guidance,
        ),
        reference.coordinate,
      ),
    );
  }

  return diagnostics;
}

function isSubset<T>(subset: ReadonlySet<T>, superset: ReadonlySet<T>): boolean {
  return [...subset].every((value) => superset.has(value));
}
