import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureStaticMemberAccessOccurrence {
  readonly baseName: string;
  readonly memberName: string;
  readonly coordinate: SourceCoordinate;
}
