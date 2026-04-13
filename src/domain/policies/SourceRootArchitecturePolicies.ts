import type { ArchitectureLinterConfiguration } from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import type { ArchitecturePolicyProtocol } from "../protocols/ArchitecturePolicyProtocol.ts";
import type { ArchitectureDiagnostic } from "../value-objects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../value-objects/ArchitectureFile.ts";
import type { ProjectContext } from "../value-objects/ProjectContext.ts";

export class SourceRootLayoutPolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "source_root.layout";

  private readonly emittedEntries = new Set<string>();

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration =
      DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    const [topLevelEntry, ...remainingComponents] = file.classification.pathComponents;
    if (!topLevelEntry) {
      return [];
    }

    if (remainingComponents.length === 0) {
      if (this.configuration.sourceRootLayout.allowLooseFilesAtRoot) {
        return [];
      }

      return this.emitOnce(
        `file:${topLevelEntry}`,
        file.diagnostic(
          SourceRootLayoutPolicy.ruleID,
          `Loose source-root file '${file.repoRelativePath}' is not allowed. Move it under one of the configured top-level entries: ${this.allowedEntriesList()}.`,
        ),
      );
    }

    const canonicalEntry = this.canonicalEntryFor(topLevelEntry);
    if (canonicalEntry === topLevelEntry) {
      return [];
    }

    if (
      canonicalEntry &&
      this.configuration.sourceRootLayout.enforceCanonicalCasing
    ) {
      return this.emitOnce(
        `casing:${topLevelEntry}`,
        file.diagnostic(
          SourceRootLayoutPolicy.ruleID,
          `Top-level source entry '${topLevelEntry}' must use canonical casing '${canonicalEntry}'. Allowed top-level entries are ${this.allowedEntriesList()}.`,
        ),
      );
    }

    if (canonicalEntry) {
      return [];
    }

    return this.emitOnce(
      `entry:${topLevelEntry}`,
      file.diagnostic(
        SourceRootLayoutPolicy.ruleID,
        `Top-level source entry '${topLevelEntry}' is not allowed. Allowed top-level entries are ${this.allowedEntriesList()}.`,
      ),
    );
  }

  private allowedEntriesList(): string {
    return this.configuration.sourceRootLayout.allowedTopLevelEntries.join(", ");
  }

  private canonicalEntryFor(topLevelEntry: string): string | undefined {
    return this.configuration.sourceRootLayout.allowedTopLevelEntries.find(
      (allowedEntry) =>
        this.normalizedValue(allowedEntry) === this.normalizedValue(topLevelEntry),
    );
  }

  private emitOnce(
    key: string,
    diagnostic: ArchitectureDiagnostic,
  ): readonly ArchitectureDiagnostic[] {
    if (this.emittedEntries.has(key)) {
      return [];
    }

    this.emittedEntries.add(key);
    return [diagnostic];
  }

  private normalizedValue(value: string): string {
    return value.toLowerCase();
  }
}
