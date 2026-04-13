import test from "node:test";
import assert from "node:assert/strict";

import { DefaultArchitecturePolicies } from "../../src/domain/policies/DefaultArchitecturePolicies.ts";
import { ArchitectureLinterCLIEntrypoint } from "../../src/presentation/entrypoints/ArchitectureLinterCLIEntrypoint.ts";

test("CLI help prints usage and exits successfully", () => {
  const loggedLines: string[] = [];
  const originalLog = console.log;

  console.log = (...arguments_: unknown[]) => {
    loggedLines.push(arguments_.join(" "));
  };

  try {
    const exitCode = ArchitectureLinterCLIEntrypoint.run(
      ["architecture-linter", "--help"],
      DefaultArchitecturePolicies.make,
    );

    assert.equal(exitCode, 0);
    assert.match(loggedLines.join("\n"), /Usage: architecture-linter/);
    assert.match(loggedLines.join("\n"), /Defaults to \.\/src/);
  } finally {
    console.log = originalLog;
  }
});
