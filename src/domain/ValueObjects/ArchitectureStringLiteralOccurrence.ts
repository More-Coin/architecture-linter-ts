import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureStringLiteralOccurrence {
  readonly value: string;
  readonly coordinate: SourceCoordinate;
}
