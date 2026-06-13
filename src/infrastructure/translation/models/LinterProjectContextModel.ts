import type { ArchitectureFile } from "../../../Domain/ValueObjects/ArchitectureFile.ts";
import type { IndexedDeclaration } from "../../../Domain/ValueObjects/IndexedDeclaration.ts";
import type { IndexedMethodShape } from "../../../Domain/ValueObjects/IndexedMethodShape.ts";
import {
  type IndexedStringLiteralSite,
  ProjectContext,
} from "../../../Domain/ValueObjects/ProjectContext.ts";

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
    const literalSites: IndexedStringLiteralSite[] = files.flatMap((file) =>
      file.stringLiteralOccurrences.map((occurrence) => ({
        value: occurrence.value,
        repoRelativePath: file.repoRelativePath,
        layer: file.classification.layer,
        roleFolder: file.classification.roleFolder,
      })),
    );
    const aliasTargetsByName = new Map<string, string[]>();
    for (const file of files) {
      for (const declaration of file.typeAliasDeclarations) {
        const targets = aliasTargetsByName.get(declaration.aliasName) ?? [];
        targets.push(declaration.targetTypeName);
        aliasTargetsByName.set(declaration.aliasName, targets);
      }
    }

    return new ProjectContext(declarations, literalSites, aliasTargetsByName);
  }
}
