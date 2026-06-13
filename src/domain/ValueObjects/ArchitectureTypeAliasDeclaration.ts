import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureTypeAliasDeclaration {
  readonly aliasName: string;
  readonly targetTypeName: string;
  readonly coordinate: SourceCoordinate;
}
