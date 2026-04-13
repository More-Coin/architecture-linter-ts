import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  type ArchitectureLinterConfiguration,
} from "../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";
import { ArchitectureLinter } from "./dependency-injection/ArchitectureLinter.ts";
import type { ArchitectureLintResultContract } from "../Application/contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLintScopeContract } from "../Application/contracts/workflow/ArchitectureLintScope.ts";
import { ArchitectureLintScope } from "../Application/contracts/workflow/ArchitectureLintScope.ts";
import { DefaultArchitecturePolicies } from "../Domain/Policies/DefaultArchitecturePolicies.ts";

export interface LintProjectInput {
  readonly rootURL: URL | string;
  readonly scope?: ArchitectureLintScopeContract;
  readonly configuration?: ArchitectureLinterConfiguration;
}

export function lintProject(
  input: LintProjectInput,
): ArchitectureLintResultContract {
  const configuration =
    input.configuration ?? DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;

  return new ArchitectureLinter({
    configuration,
    policies: DefaultArchitecturePolicies.make(configuration),
  }).lintProject(
    lintRootURL(input.rootURL),
    input.scope ?? ArchitectureLintScope.All,
  );
}

function lintRootURL(rootURL: URL | string): URL {
  if (rootURL instanceof URL) {
    return rootURL;
  }

  return pathToFileURL(path.resolve(rootURL));
}
