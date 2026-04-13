import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  ArchitectureLinter,
  ArchitectureLintScope,
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  DefaultArchitecturePolicies,
  lintProject,
} from "../../src/App/index.ts";

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

test("public library API reports empty directories through project policies", () => {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "arch-lint-public-api-"));

  try {
    fs.mkdirSync(path.join(rootPath, "Infrastructure", "Analyzers"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(rootPath, "App"), { recursive: true });
    fs.writeFileSync(
      path.join(rootPath, "App", "main.ts"),
      "export const main = true;\n",
      "utf8",
    );

    const result = lintProject({
      rootURL: rootPath,
      scope: ArchitectureLintScope.All,
    });

    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.ruleID === "infrastructure.empty_directory" &&
          diagnostic.path === "Infrastructure/Analyzers",
      ),
    );
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});
