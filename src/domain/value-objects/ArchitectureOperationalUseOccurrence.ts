import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureOperationalUseOccurrence {
  readonly enclosingTypeName: string;
  readonly enclosingMethodName: string;
  readonly baseName: string;
  readonly memberName: string;
  readonly branchGroupIndex?: number;
  readonly branchArmIndex?: number;
  readonly coordinate: SourceCoordinate;
}
