import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureTypeReference {
  readonly name: string;
  readonly coordinate: SourceCoordinate;
}
