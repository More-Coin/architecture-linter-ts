import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureConstructionOccurrence {
  readonly typeName: string;
  readonly coordinate: SourceCoordinate;
}
