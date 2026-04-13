import type { ArchitectureLayer } from "./ArchitectureLayer.ts";
import type { IndexedMethodShape } from "./IndexedMethodShape.ts";
import type { NominalKind } from "./NominalKind.ts";
import type { RoleFolder } from "./RoleFolder.ts";

export interface IndexedDeclaration {
  readonly name: string;
  readonly kind: NominalKind;
  readonly inheritedTypeNames: readonly string[];
  readonly methodShapes: readonly IndexedMethodShape[];
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
}
