import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { SourceFileDiscoveryPortProtocol } from "../../application/ports/protocols/SourceFileDiscoveryPortProtocol.ts";
import { ArchitectureLinterInfrastructureError } from "../errors/ArchitectureLinterInfrastructureError.ts";
import { LinterRepoRelativePathModel } from "../translation/LinterRepoRelativePathModel.ts";

export class SourceFileDiscoveryGateway
  implements SourceFileDiscoveryPortProtocol
{
  private readonly sourceExtensions: readonly string[];
  private readonly excludedPrefixes: readonly string[];
  private readonly repoRelativePathModel: LinterRepoRelativePathModel;

  constructor(
    sourceExtensions: readonly string[] = [".ts"],
    excludedPrefixes: readonly string[] = [
      ".build/",
      ".git/",
      ".derivedData",
      "Tools/",
    ],
  ) {
    this.sourceExtensions = sourceExtensions;
    this.excludedPrefixes = excludedPrefixes;
    this.repoRelativePathModel = new LinterRepoRelativePathModel();
  }

  discoverSourceFiles(in_: URL): readonly URL[] {
    const rootPath = fileURLToPath(in_);

    if (!fs.existsSync(rootPath)) {
      throw ArchitectureLinterInfrastructureError.invalidRootDirectory(rootPath);
    }

    const stat = fs.statSync(rootPath);
    if (!stat.isDirectory()) {
      throw ArchitectureLinterInfrastructureError.invalidRootDirectory(rootPath);
    }

    try {
      fs.accessSync(rootPath, fs.constants.R_OK);
    } catch {
      throw ArchitectureLinterInfrastructureError.invalidRootDirectory(rootPath);
    }

    const results: URL[] = [];
    this.walk(in_, in_, results);

    return results.sort((lhs, rhs) =>
      this.repoRelativePathModel
        .fromURLs(lhs, in_)
        .localeCompare(this.repoRelativePathModel.fromURLs(rhs, in_)),
    );
  }

  private walk(rootURL: URL, currentURL: URL, results: URL[]): void {
    const currentPath = fileURLToPath(currentURL);
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) {
        continue;
      }

      const nextPath = `${currentPath}/${entry.name}`;
      const nextURL = pathToFileURL(nextPath);
      const repoRelativePath = this.repoRelativePathModel.fromURLs(nextURL, rootURL);

      if (this.shouldSkip(repoRelativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        this.walk(rootURL, nextURL, results);
        continue;
      }

      if (
        !entry.isFile() ||
        entry.name.endsWith(".d.ts") ||
        !this.sourceExtensions.some((extension) => entry.name.endsWith(extension))
      ) {
        continue;
      }

      results.push(nextURL);
    }
  }

  private shouldSkip(repoRelativePath: string): boolean {
    if (this.isExcludedUITestPath(repoRelativePath)) {
      return true;
    }

    return this.excludedPrefixes.some((prefix) =>
      repoRelativePath.startsWith(prefix),
    );
  }

  private isExcludedUITestPath(repoRelativePath: string): boolean {
    const [firstComponent] = repoRelativePath.split("/");
    return firstComponent?.endsWith("UITests") ?? false;
  }
}
