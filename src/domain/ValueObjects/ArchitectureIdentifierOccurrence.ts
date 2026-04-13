import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureIdentifierOccurrence {
  readonly name: string;
  readonly coordinate: SourceCoordinate;
}
