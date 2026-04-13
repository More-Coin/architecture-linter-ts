import test from "node:test";
import assert from "node:assert/strict";

import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
import { LintProjectUseCase } from "../../src/Application/use-cases/LintProjectUseCase.ts";
import { ArchitectureLinterConfigurationPortAdapter } from "../../src/Infrastructure/port-adapters/ArchitectureLinterConfigurationPortAdapter.ts";
import { ArchitectureLinterPortAdapter } from "../../src/Infrastructure/port-adapters/ArchitectureLinterPortAdapter.ts";
import { ArchitectureLinterService } from "../../src/Application/services/ArchitectureLinterService.ts";
import { ArchitectureLinterCLIEntrypoint } from "../../src/Presentation/entrypoints/ArchitectureLinterCLIEntrypoint.ts";

test("CLI help prints usage and exits successfully", () => {
  const loggedLines: string[] = [];
  const originalLog = console.log;

  console.log = (...arguments_: unknown[]) => {
    loggedLines.push(arguments_.join(" "));
  };

  try {
    const exitCode = ArchitectureLinterCLIEntrypoint.run(
      ["architecture-linter", "--help"],
      new ArchitectureLinterService(
        new LintProjectUseCase(
          new ArchitectureLinterPortAdapter({
            policies: DefaultArchitecturePolicies.make(),
          }),
        ),
        new ArchitectureLinterConfigurationPortAdapter(),
      ),
    );

    assert.equal(exitCode, 0);
    assert.match(loggedLines.join("\n"), /Usage: architecture-linter/);
    assert.match(loggedLines.join("\n"), /Defaults to \.\/src/);
  } finally {
    console.log = originalLog;
  }
});
