import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureDecoratorOccurrence {
  readonly name: string;
  readonly coordinate: SourceCoordinate;
}
