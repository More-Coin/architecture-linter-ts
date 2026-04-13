import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureImportOccurrence {
  readonly moduleName: string;
  readonly coordinate: SourceCoordinate;
}
