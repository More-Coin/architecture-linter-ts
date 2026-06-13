import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureFunctionTypeOccurrence {
  readonly coordinate: SourceCoordinate;
  readonly parameterTypeNames?: readonly string[];
  readonly returnTypeNames?: readonly string[];
  readonly isAsync?: boolean;
  readonly isVoidLikeReturn?: boolean;
}
