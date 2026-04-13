import type { ArchitectureComputedPropertyDeclaration } from "./ArchitectureComputedPropertyDeclaration.ts";
import type { ArchitectureConstructorDeclaration } from "./ArchitectureConstructorDeclaration.ts";
import type { ArchitectureDiagnostic } from "./ArchitectureDiagnostic.ts";
import type { ArchitectureFunctionTypeOccurrence } from "./ArchitectureFunctionTypeOccurrence.ts";
import type { ArchitectureIdentifierOccurrence } from "./ArchitectureIdentifierOccurrence.ts";
import type { ArchitectureImportOccurrence } from "./ArchitectureImportOccurrence.ts";
import type { ArchitectureMemberCallOccurrence } from "./ArchitectureMemberCallOccurrence.ts";
import type { ArchitectureMethodDeclaration } from "./ArchitectureMethodDeclaration.ts";
import type { ArchitectureNestedNominalDeclaration } from "./ArchitectureNestedNominalDeclaration.ts";
import type { ArchitectureOperationalUseOccurrence } from "./ArchitectureOperationalUseOccurrence.ts";
import type { ArchitectureStoredMemberDeclaration } from "./ArchitectureStoredMemberDeclaration.ts";
import type { ArchitectureStringLiteralOccurrence } from "./ArchitectureStringLiteralOccurrence.ts";
import type { ArchitectureTopLevelDeclaration } from "./ArchitectureTopLevelDeclaration.ts";
import type { ArchitectureTypeReference } from "./ArchitectureTypeReference.ts";
import type { ArchitectureTypedMemberOccurrence } from "./ArchitectureTypedMemberOccurrence.ts";
import { FileClassification } from "./FileClassification.ts";
import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureFileInput {
  readonly repoRelativePath: string;
  readonly classification: FileClassification;
  readonly imports?: readonly ArchitectureImportOccurrence[];
  readonly functionTypeOccurrences?: readonly ArchitectureFunctionTypeOccurrence[];
  readonly identifierOccurrences?: readonly ArchitectureIdentifierOccurrence[];
  readonly stringLiteralOccurrences?: readonly ArchitectureStringLiteralOccurrence[];
  readonly typedMemberOccurrences?: readonly ArchitectureTypedMemberOccurrence[];
  readonly memberCallOccurrences?: readonly ArchitectureMemberCallOccurrence[];
  readonly methodDeclarations?: readonly ArchitectureMethodDeclaration[];
  readonly constructorDeclarations?: readonly ArchitectureConstructorDeclaration[];
  readonly computedPropertyDeclarations?: readonly ArchitectureComputedPropertyDeclaration[];
  readonly storedMemberDeclarations?: readonly ArchitectureStoredMemberDeclaration[];
  readonly operationalUseOccurrences?: readonly ArchitectureOperationalUseOccurrence[];
  readonly typeReferences?: readonly ArchitectureTypeReference[];
  readonly topLevelDeclarations?: readonly ArchitectureTopLevelDeclaration[];
  readonly nestedNominalDeclarations?: readonly ArchitectureNestedNominalDeclaration[];
}

export class ArchitectureFile {
  readonly repoRelativePath: string;
  readonly classification: FileClassification;
  readonly imports: readonly ArchitectureImportOccurrence[];
  readonly functionTypeOccurrences: readonly ArchitectureFunctionTypeOccurrence[];
  readonly identifierOccurrences: readonly ArchitectureIdentifierOccurrence[];
  readonly stringLiteralOccurrences: readonly ArchitectureStringLiteralOccurrence[];
  readonly typedMemberOccurrences: readonly ArchitectureTypedMemberOccurrence[];
  readonly memberCallOccurrences: readonly ArchitectureMemberCallOccurrence[];
  readonly methodDeclarations: readonly ArchitectureMethodDeclaration[];
  readonly constructorDeclarations: readonly ArchitectureConstructorDeclaration[];
  readonly computedPropertyDeclarations: readonly ArchitectureComputedPropertyDeclaration[];
  readonly storedMemberDeclarations: readonly ArchitectureStoredMemberDeclaration[];
  readonly operationalUseOccurrences: readonly ArchitectureOperationalUseOccurrence[];
  readonly typeReferences: readonly ArchitectureTypeReference[];
  readonly topLevelDeclarations: readonly ArchitectureTopLevelDeclaration[];
  readonly nestedNominalDeclarations: readonly ArchitectureNestedNominalDeclaration[];

  constructor(input: ArchitectureFileInput) {
    this.repoRelativePath = input.repoRelativePath;
    this.classification = input.classification;
    this.imports = [...(input.imports ?? [])];
    this.functionTypeOccurrences = [...(input.functionTypeOccurrences ?? [])];
    this.identifierOccurrences = [...(input.identifierOccurrences ?? [])];
    this.stringLiteralOccurrences = [...(input.stringLiteralOccurrences ?? [])];
    this.typedMemberOccurrences = [...(input.typedMemberOccurrences ?? [])];
    this.memberCallOccurrences = [...(input.memberCallOccurrences ?? [])];
    this.methodDeclarations = [...(input.methodDeclarations ?? [])];
    this.constructorDeclarations = [...(input.constructorDeclarations ?? [])];
    this.computedPropertyDeclarations = [
      ...(input.computedPropertyDeclarations ?? []),
    ];
    this.storedMemberDeclarations = [...(input.storedMemberDeclarations ?? [])];
    this.operationalUseOccurrences = [...(input.operationalUseOccurrences ?? [])];
    this.typeReferences = [...(input.typeReferences ?? [])];
    this.topLevelDeclarations = [...(input.topLevelDeclarations ?? [])];
    this.nestedNominalDeclarations = [...(input.nestedNominalDeclarations ?? [])];
  }

  diagnostic(
    ruleID: string,
    message: string,
    coordinate: SourceCoordinate = { line: 1, column: 1 },
  ): ArchitectureDiagnostic {
    return {
      ruleID,
      path: this.repoRelativePath,
      line: coordinate.line,
      column: coordinate.column,
      message,
    };
  }
}
