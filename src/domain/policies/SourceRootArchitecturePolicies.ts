import type { ArchitectureLinterConfiguration } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import type {
  ArchitectureProjectPolicyInput,
  ArchitectureProjectPolicyProtocol,
} from "../Protocols/ArchitectureProjectPolicyProtocol.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";

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

export class SourceRootEmptyDirectoryPolicy
  implements ArchitectureProjectPolicyProtocol
{
  static readonly ruleID = "source_root.empty_directory";

  evaluateProject(
    input: ArchitectureProjectPolicyInput,
  ): readonly ArchitectureDiagnostic[] {
    return input.emptyDirectoryPaths
      .filter((directoryPath) => !isInfrastructureDirectoryPath(directoryPath, input))
      .map((directoryPath) => ({
        ruleID: SourceRootEmptyDirectoryPolicy.ruleID,
        path: directoryPath,
        line: 1,
        column: 1,
        message: sourceRootStructuredRemediationMessage({
          summary:
            "Empty directories should not be left behind in the lint root because they usually represent abandoned scaffolding or an incomplete move.",
          categories: [
            "leftover folder after files were moved to their canonical role",
            "temporary scaffolding directory committed without any owned files",
            "placeholder folder kept instead of either deleting it or restoring real contents",
            "container directory emptied during decomposition but never removed",
          ],
          signs: [
            "the directory exists on disk under the lint root",
            "the directory has no visible child files or subdirectories",
            "the linter cannot assign any ownership because there is no remaining source inside it",
          ],
          architecturalNote:
            "An empty directory carries no executable or structural ownership, so leaving it behind usually hides whether a refactor is actually complete. Architectural folders should either contain the files and subfolders that they own or be removed entirely once that ownership is gone.",
          destination:
            "delete the empty directory if it no longer owns anything, or restore the correctly owned files and canonical child structure if the directory is still supposed to exist.",
          decomposition:
            "verify whether the directory still has an architectural reason to exist; if it does not, remove it; if it does, move the owned files back into it or recreate the canonical child folders that make it a real container, then rerun the linter so the remaining contents are validated by the normal role-specific rules.",
        }),
      }));
  }
}

function sourceRootStructuredRemediationMessage(input: {
  readonly summary: string;
  readonly categories: readonly string[];
  readonly signs: readonly string[];
  readonly architecturalNote: string;
  readonly destination: string;
  readonly decomposition: string;
}): string {
  return `${input.summary} Likely categories: ${input.categories.join("; ")}; signs: ${input.signs.join("; ")}; architectural note: ${input.architecturalNote}; destination: ${input.destination}; explicit decomposition guidance: ${input.decomposition}`;
}

function isInfrastructureDirectoryPath(
  directoryPath: string,
  input: {
    readonly configuration: ArchitectureLinterConfiguration;
  },
): boolean {
  const [topLevelEntry] = directoryPath.split("/");
  if (!topLevelEntry) {
    return false;
  }

  return (
    normalizedValue(topLevelEntry) ===
    normalizedValue(input.configuration.layerDirectoryNames.infrastructure)
  );
}

function normalizedValue(value: string): string {
  return value.toLowerCase();
}
