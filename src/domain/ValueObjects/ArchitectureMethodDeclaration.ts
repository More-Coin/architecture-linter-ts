import type { SourceCoordinate } from "./SourceCoordinate.ts";

export interface ArchitectureMethodDeclaration {
  readonly enclosingTypeName: string;
  readonly name: string;
  readonly isStatic: boolean;
  readonly isPublicOrOpen: boolean;
  readonly isPrivateOrFileprivate: boolean;
  readonly parameterTypeNames: readonly string[];
  readonly hasExplicitReturnType: boolean;
  readonly returnTypeDescription?: string;
  readonly returnTypeNames: readonly string[];
  readonly returnsVoidLike: boolean;
  readonly coordinate: SourceCoordinate;
}
