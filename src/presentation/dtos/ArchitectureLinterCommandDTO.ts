import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ArchitectureLintScope,
  ArchitectureLintScopeContract,
} from "../../Application/contracts/workflow/ArchitectureLintScope.ts";
import { ArchitectureLinterPresentationErrors } from "../errors/ArchitectureLinterPresentationError.ts";

export type ArchitectureLinterCommandDTO = Readonly<{
  rootURL: URL;
  scope: ArchitectureLintScopeContract;
  configURL?: URL;
  helpRequested: boolean;
}>;

export function parseArchitectureLinterCommandDTO(
  arguments_: readonly string[],
  currentWorkingDirectory = process.cwd(),
): ArchitectureLinterCommandDTO {
  const defaultRootPath = "./src";
  const userArguments = architectureLinterUserArguments(arguments_);
  const helpRequested =
    userArguments.includes("--help") || userArguments.includes("-h");

  let rootPath = defaultRootPath;
  let scope = ArchitectureLintScopeContract.All;
  let configPath: string | undefined;
  let hasSeenScope = false;
  let index = 0;

  if (helpRequested) {
    return {
      rootURL: pathToFileURL(
        path.resolve(currentWorkingDirectory, defaultRootPath),
      ),
      scope,
      helpRequested,
    };
  }

  while (index < userArguments.length) {
    const argument = userArguments[index];

    switch (argument) {
      case "--scope": {
        const value = userArguments[index + 1];
        if (hasSeenScope || !isScopeValue(value)) {
          throw ArchitectureLinterPresentationErrors.invalidArguments();
        }

        scope = value;
        hasSeenScope = true;
        index += 2;
        break;
      }

      case "--config": {
        const value = userArguments[index + 1];
        if (configPath || !isFlagValue(value)) {
          throw ArchitectureLinterPresentationErrors.invalidArguments();
        }

        configPath = value;
        index += 2;
        break;
      }

      default: {
        if (argument.startsWith("--") || rootPath !== defaultRootPath) {
          throw ArchitectureLinterPresentationErrors.invalidArguments();
        }

        rootPath = argument;
        index += 1;
      }
    }
  }

  return {
    rootURL: pathToFileURL(path.resolve(currentWorkingDirectory, rootPath)),
    scope,
    configURL: configPath
      ? pathToFileURL(path.resolve(currentWorkingDirectory, configPath))
      : undefined,
    helpRequested,
  };
}

function architectureLinterUserArguments(
  arguments_: readonly string[],
): readonly string[] {
  if (arguments_.length === 0) {
    return [];
  }

  const [firstArgument, secondArgument] = arguments_;
  if (looksLikeRuntimeExecutable(firstArgument) && secondArgument) {
    return arguments_.slice(2);
  }

  if (looksLikeCLIExecutable(firstArgument)) {
    return arguments_.slice(1);
  }

  return [...arguments_];
}

function isFlagValue(value: string | undefined): value is string {
  return Boolean(value && !value.startsWith("--"));
}

function isScopeValue(
  value: string | undefined,
): value is ArchitectureLintScopeContract {
  return value === ArchitectureLintScope.All || value === ArchitectureLintScope.Tests;
}

function looksLikeRuntimeExecutable(argument: string): boolean {
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

function looksLikeCLIExecutable(argument: string): boolean {
  const executableName = path.basename(argument, path.extname(argument));
  return executableName === "architecture-linter";
}
