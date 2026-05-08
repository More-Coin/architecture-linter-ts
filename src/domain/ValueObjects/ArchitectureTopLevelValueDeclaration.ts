import type { SourceCoordinate } from "./SourceCoordinate.ts";

export type ArchitectureTopLevelValueDeclarationKind =
  | "function"
  | "const"
  | "let"
  | "var";

export interface ArchitectureTopLevelValueDeclaration {
  readonly name: string;
  readonly kind: ArchitectureTopLevelValueDeclarationKind;
  readonly isExported: boolean;
  readonly coordinate: SourceCoordinate;
}
