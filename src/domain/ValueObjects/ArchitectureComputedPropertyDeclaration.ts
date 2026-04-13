import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureComputedPropertyDeclaration {
  readonly enclosingTypeName: string;
  readonly name: string;
  readonly typeDescription: string;
  readonly typeNames: readonly string[];
  readonly isStatic: boolean;
  readonly coordinate: SourceCoordinate;
}
