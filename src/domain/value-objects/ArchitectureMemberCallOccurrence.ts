import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureMemberCallOccurrence {
  readonly baseName: string;
  readonly memberName: string;
  readonly coordinate: SourceCoordinate;
}
