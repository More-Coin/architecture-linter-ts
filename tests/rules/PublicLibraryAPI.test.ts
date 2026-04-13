import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ArchitectureLinter,
  ArchitectureLintScope,
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  DefaultArchitecturePolicies,
  lintProject,
} from "../../src/index.ts";

const fixtureRoot = path.resolve(
  "tests/fixtures/type-script-lint-project",
);

test("public library API exposes lintProject and architecture primitives", () => {
  const result = lintProject({
    rootURL: fixtureRoot,
    scope: ArchitectureLintScope.All,
  });

  assert.ok(Array.isArray(result.diagnostics));
  assert.ok(result.diagnostics.length > 0);
});

test("public library API allows direct ArchitectureLinter usage", () => {
  const configuration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
  const linter = new ArchitectureLinter({
    configuration,
    policies: DefaultArchitecturePolicies.make(configuration),
  });

  const result = linter.lintProject(pathToFileURL(fixtureRoot));
  assert.ok(Array.isArray(result.diagnostics));
});
