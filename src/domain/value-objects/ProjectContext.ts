import type { IndexedDeclaration } from "./IndexedDeclaration.ts";

export class ProjectContext {
  readonly declarations: readonly IndexedDeclaration[];
  readonly uniquelyNamedDeclarations: ReadonlyMap<string, IndexedDeclaration>;

  constructor(declarations: readonly IndexedDeclaration[]) {
    this.declarations = [...declarations];

    const declarationsByName = new Map<string, IndexedDeclaration[]>();
    for (const declaration of declarations) {
      const matchedDeclarations = declarationsByName.get(declaration.name) ?? [];
      matchedDeclarations.push(declaration);
      declarationsByName.set(declaration.name, matchedDeclarations);
    }

    const uniqueDeclarations = new Map<string, IndexedDeclaration>();
    for (const [name, matchedDeclarations] of declarationsByName) {
      if (matchedDeclarations.length === 1) {
        uniqueDeclarations.set(name, matchedDeclarations[0]);
      }
    }

    this.uniquelyNamedDeclarations = uniqueDeclarations;
  }

  uniqueDeclaration(named: string): IndexedDeclaration | undefined {
    return this.uniquelyNamedDeclarations.get(named);
  }
}
