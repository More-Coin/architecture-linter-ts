import type { ArchitectureFile } from "../../domain/value-objects/ArchitectureFile.ts";
import { ProjectContext } from "../../domain/value-objects/ProjectContext.ts";
import type { IndexedDeclaration } from "../../domain/value-objects/IndexedDeclaration.ts";
import type { IndexedMethodShape } from "../../domain/value-objects/IndexedMethodShape.ts";

export class LinterProjectContextModel {
  toDomain(files: readonly ArchitectureFile[]): ProjectContext {
    const declarations: IndexedDeclaration[] = files.flatMap((file) =>
      file.topLevelDeclarations.map((declaration) => {
        const methodShapes: readonly IndexedMethodShape[] =
          declaration.kind === "protocol"
            ? file.methodDeclarations
                .filter(
                  (methodDeclaration) =>
                    methodDeclaration.enclosingTypeName === declaration.name,
                )
                .map((methodDeclaration) => ({
                  returnsVoidLike: methodDeclaration.returnsVoidLike,
                  parameterTypeNames: methodDeclaration.parameterTypeNames,
                }))
            : [];

        return {
          name: declaration.name,
          kind: declaration.kind,
          inheritedTypeNames: declaration.inheritedTypeNames,
          methodShapes,
          repoRelativePath: file.repoRelativePath,
          layer: file.classification.layer,
          roleFolder: file.classification.roleFolder,
        };
      }),
    );

    return new ProjectContext(declarations);
  }
}
