import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureTypedMemberOccurrence {
  readonly name: string;
  readonly typeNames: readonly string[];
  readonly coordinate: SourceCoordinate;
}
