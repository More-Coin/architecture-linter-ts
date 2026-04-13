import path from "node:path";
import { pathToFileURL } from "node:url";

import { ArchitectureLintScope } from "../../application/contracts/workflow/ArchitectureLintScope.ts";
import { ArchitectureLinterPresentationError } from "../errors/ArchitectureLinterPresentationError.ts";

export class ArchitectureLinterCommandDTO {
  readonly rootURL: URL;
  readonly scope: ArchitectureLintScope;
  readonly configURL?: URL;

  constructor(
    arguments_: readonly string[],
    currentWorkingDirectory = process.cwd(),
  ) {
    const userArguments = ArchitectureLinterCommandDTO.userArguments(arguments_);
    if (userArguments.includes("--help") || userArguments.includes("-h")) {
      throw ArchitectureLinterPresentationError.invalidArguments();
    }

    let rootPath = currentWorkingDirectory;
    let scope = ArchitectureLintScope.All;
    let configPath: string | undefined;
    let hasSeenScope = false;
    let index = 0;

    while (index < userArguments.length) {
      const argument = userArguments[index];

      switch (argument) {
        case "--scope": {
          const value = userArguments[index + 1];
          if (hasSeenScope || !ArchitectureLinterCommandDTO.isScopeValue(value)) {
            throw ArchitectureLinterPresentationError.invalidArguments();
          }

          scope = value;
          hasSeenScope = true;
          index += 2;
          break;
        }

        case "--config": {
          const value = userArguments[index + 1];
          if (
            configPath ||
            !ArchitectureLinterCommandDTO.isFlagValue(value)
          ) {
            throw ArchitectureLinterPresentationError.invalidArguments();
          }

          configPath = value;
          index += 2;
          break;
        }

        default: {
          if (argument.startsWith("--") || rootPath !== currentWorkingDirectory) {
            throw ArchitectureLinterPresentationError.invalidArguments();
          }

          rootPath = argument;
          index += 1;
        }
      }
    }

    this.rootURL = pathToFileURL(
      path.resolve(currentWorkingDirectory, rootPath),
    );
    this.scope = scope;
    this.configURL = configPath
      ? pathToFileURL(path.resolve(currentWorkingDirectory, configPath))
      : undefined;
  }

  private static userArguments(arguments_: readonly string[]): readonly string[] {
    if (arguments_.length === 0) {
      return [];
    }

    const [firstArgument, secondArgument] = arguments_;
    if (this.looksLikeRuntimeExecutable(firstArgument) && secondArgument) {
      return arguments_.slice(2);
    }

    if (this.looksLikeCLIExecutable(firstArgument)) {
      return arguments_.slice(1);
    }

    return [...arguments_];
  }

  private static isFlagValue(value: string | undefined): value is string {
    return Boolean(value && !value.startsWith("--"));
  }

  private static isScopeValue(
    value: string | undefined,
  ): value is ArchitectureLintScope {
    return (
      value === ArchitectureLintScope.All || value === ArchitectureLintScope.Tests
    );
  }

  private static looksLikeRuntimeExecutable(argument: string): boolean {
    const executableName = path.basename(argument).toLowerCase();

    return new Set([
      "node",
      "node.exe",
      "tsx",
      "tsx.cmd",
      "ts-node",
      "ts-node.cmd",
      "ts-node-esm",
      "ts-node-esm.cmd",
      "bun",
      "bun.exe",
    ]).has(executableName);
  }

  private static looksLikeCLIExecutable(argument: string): boolean {
    const executableName = path.basename(argument, path.extname(argument));
    return executableName === "architecture-linter";
  }
}
