import type { NominalKind } from "./NominalKind.ts";
import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureNestedNominalDeclaration {
  readonly enclosingTypeName: string;
  readonly name: string;
  readonly kind: NominalKind;
  readonly inheritedTypeNames: readonly string[];
  readonly memberNames: readonly string[];
  readonly coordinate: SourceCoordinate;
}
