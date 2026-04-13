import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  type ArchitectureLinterConfiguration,
} from "./app/configuration/ArchitectureLinterConfiguration.ts";
import { ArchitectureLinter } from "./app/dependency-injection/ArchitectureLinter.ts";
import type { ArchitectureLintResult } from "./application/contracts/ports/ArchitectureLintResultContract.ts";
import { ArchitectureLintScope } from "./application/contracts/workflow/ArchitectureLintScope.ts";
import { DefaultArchitecturePolicies } from "./domain/policies/DefaultArchitecturePolicies.ts";

export interface LintProjectInput {
  readonly rootURL: URL | string;
  readonly scope?: ArchitectureLintScope;
  readonly configuration?: ArchitectureLinterConfiguration;
}

export function lintProject(input: LintProjectInput): ArchitectureLintResult {
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
