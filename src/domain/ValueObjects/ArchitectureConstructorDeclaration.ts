import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureConstructorDeclaration {
  readonly enclosingTypeName: string;
  readonly parameterTypeNames: readonly string[];
  readonly coordinate: SourceCoordinate;
}
