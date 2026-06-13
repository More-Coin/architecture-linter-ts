import type { IndexedDeclaration } from "./IndexedDeclaration.ts";
import type { ArchitectureLayer } from "./ArchitectureLayer.ts";
import type { RoleFolder } from "./RoleFolder.ts";

export interface IndexedStringLiteralSite {
  readonly value: string;
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
}

export class ProjectContext {
  readonly declarations: readonly IndexedDeclaration[];
  readonly uniquelyNamedDeclarations: ReadonlyMap<string, IndexedDeclaration>;
  private readonly declarationsByName: ReadonlyMap<string, readonly IndexedDeclaration[]>;
  private readonly literalSitesByValue: ReadonlyMap<string, readonly IndexedStringLiteralSite[]>;
  private readonly aliasTargetsByName: ReadonlyMap<string, readonly string[]>;

  constructor(
    declarations: readonly IndexedDeclaration[],
    literalSites: readonly IndexedStringLiteralSite[] = [],
    aliasTargetsByName: ReadonlyMap<string, readonly string[]> = new Map(),
  ) {
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
        uniqueDeclarations.set(name, matchedDeclarations[0]!);
      }
    }

    this.uniquelyNamedDeclarations = uniqueDeclarations;
    this.declarationsByName = declarationsByName;

    const literalSitesByValue = new Map<string, IndexedStringLiteralSite[]>();
    for (const site of literalSites) {
      const matchedSites = literalSitesByValue.get(site.value) ?? [];
      matchedSites.push(site);
      literalSitesByValue.set(site.value, matchedSites);
    }

    this.literalSitesByValue = literalSitesByValue;
    this.aliasTargetsByName = aliasTargetsByName;
  }

  uniqueDeclaration(named: string): IndexedDeclaration | undefined {
    return this.uniquelyNamedDeclarations.get(named);
  }

  resolvedDeclarations(named: string): readonly IndexedDeclaration[] {
    return this.resolveDeclarations(named, new Set(), 0);
  }

  literalSites(value: string): readonly IndexedStringLiteralSite[] {
    return this.literalSitesByValue.get(value) ?? [];
  }

  private resolveDeclarations(
    named: string,
    visitedNames: ReadonlySet<string>,
    depth: number,
  ): readonly IndexedDeclaration[] {
    const directDeclarations = this.declarationsByName.get(named) ?? [];
    if (directDeclarations.length > 0) {
      return directDeclarations;
    }

    if (depth >= 4 || visitedNames.has(named)) {
      return [];
    }

    const nextVisitedNames = new Set(visitedNames);
    nextVisitedNames.add(named);
    const resolved: IndexedDeclaration[] = [];
    const seenKeys = new Set<string>();

    for (const target of this.aliasTargetsByName.get(named) ?? []) {
      for (const declaration of this.resolveDeclarations(
        target,
        nextVisitedNames,
        depth + 1,
      )) {
        const key = `${declaration.name}|${declaration.repoRelativePath}`;
        if (seenKeys.has(key)) {
          continue;
        }

        seenKeys.add(key);
        resolved.push(declaration);
      }
    }

    return resolved;
  }
}
