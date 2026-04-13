import test from "node:test";
import assert from "node:assert/strict";

import { ArchitectureLintScope } from "../../src/application/contracts/workflow/ArchitectureLintScope.ts";
import { ArchitectureLinterCommandDTO } from "../../src/presentation/dtos/ArchitectureLinterCommandDTO.ts";

test("command DTO defaults the lint root to ./src", () => {
  const command = new ArchitectureLinterCommandDTO(
    [],
    "/workspace/project",
  );

  assert.equal(command.rootURL.href, "file:///workspace/project/src");
  assert.equal(command.scope, ArchitectureLintScope.All);
  assert.equal(command.helpRequested, false);
});

test("command DTO still accepts an explicit root path override", () => {
  const command = new ArchitectureLinterCommandDTO(
    ["tests"],
    "/workspace/project",
  );

  assert.equal(command.rootURL.href, "file:///workspace/project/tests");
  assert.equal(command.scope, ArchitectureLintScope.All);
  assert.equal(command.helpRequested, false);
});

test("command DTO treats help flags as a help request", () => {
  const command = new ArchitectureLinterCommandDTO(
    ["--help"],
    "/workspace/project",
  );

  assert.equal(command.helpRequested, true);
  assert.equal(command.rootURL.href, "file:///workspace/project/src");
  assert.equal(command.scope, ArchitectureLintScope.All);
  assert.equal(command.configURL, undefined);
});
