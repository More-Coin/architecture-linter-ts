import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/app/configuration/ArchitectureLinterConfiguration.ts";
import { SourceRootLayoutPolicy } from "../../src/domain/policies/SourceRootArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/domain/value-objects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/domain/value-objects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/domain/value-objects/FileClassification.ts";
import { ProjectContext } from "../../src/domain/value-objects/ProjectContext.ts";
import { RoleFolder } from "../../src/domain/value-objects/RoleFolder.ts";

test("source root layout policy rejects loose files at the lint root", () => {
  const policy = new SourceRootLayoutPolicy(
    DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  );

  const diagnostics = policy.evaluate(
    makeFile("cli.ts"),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, SourceRootLayoutPolicy.ruleID);
  assert.match(diagnostics[0]?.message ?? "", /Loose source-root file/);
});

test("source root layout policy rejects wrong-case top-level entries once", () => {
  const policy = new SourceRootLayoutPolicy(
    DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  );

  const firstDiagnostics = policy.evaluate(
    makeFile("app/main.ts"),
    new ProjectContext([]),
  );
  const secondDiagnostics = policy.evaluate(
    makeFile("app/configuration/Foo.ts"),
    new ProjectContext([]),
  );

  assert.equal(firstDiagnostics.length, 1);
  assert.match(firstDiagnostics[0]?.message ?? "", /canonical casing 'App'/);
  assert.equal(secondDiagnostics.length, 0);
});

test("source root layout policy rejects unknown top-level entries", () => {
  const policy = new SourceRootLayoutPolicy({
    ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    sourceRootLayout: {
      ...DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION.sourceRootLayout,
      allowedTopLevelEntries: ["Alpha", "Beta"],
    },
  });

  const diagnostics = policy.evaluate(
    makeFile("shared/Foo.ts"),
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0]?.message ?? "", /Allowed top-level entries are Alpha, Beta/);
});

function makeFile(repoRelativePath: string): ArchitectureFile {
  const pathComponents = repoRelativePath.split("/");

  return new ArchitectureFile({
    repoRelativePath,
    classification: new FileClassification({
      repoRelativePath,
      layer: ArchitectureLayer.Other,
      roleFolder: RoleFolder.None,
      pathComponents,
      fileName: pathComponents.at(-1) ?? "unknown.ts",
      fileStem: (pathComponents.at(-1) ?? "unknown.ts").replace(/\.[^.]+$/, ""),
    }),
  });
}
