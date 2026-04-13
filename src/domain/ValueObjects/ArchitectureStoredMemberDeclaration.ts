import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureStoredMemberDeclaration {
  readonly enclosingTypeName: string;
  readonly name: string;
  readonly typeNames: readonly string[];
  readonly isStatic: boolean;
  readonly coordinate: SourceCoordinate;
}
