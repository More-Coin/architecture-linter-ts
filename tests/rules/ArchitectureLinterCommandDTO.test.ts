import test from "node:test";
import assert from "node:assert/strict";

import { ArchitectureLintScope } from "../../src/Application/contracts/workflow/ArchitectureLintScope.ts";
import { parseArchitectureLinterCommandDTO } from "../../src/Presentation/dtos/ArchitectureLinterCommandDTO.ts";

test("command DTO defaults the lint root to ./src", () => {
  const command = parseArchitectureLinterCommandDTO(
    [],
    "/workspace/project",
  );

  assert.equal(command.rootURL.href, "file:///workspace/project/src");
  assert.equal(command.scope, ArchitectureLintScope.All);
  assert.equal(command.helpRequested, false);
});

test("command DTO still accepts an explicit root path override", () => {
  const command = parseArchitectureLinterCommandDTO(
    ["tests"],
    "/workspace/project",
  );

  assert.equal(command.rootURL.href, "file:///workspace/project/tests");
  assert.equal(command.scope, ArchitectureLintScope.All);
  assert.equal(command.helpRequested, false);
});

test("command DTO treats help flags as a help request", () => {
  const command = parseArchitectureLinterCommandDTO(
    ["--help"],
    "/workspace/project",
  );

  assert.equal(command.helpRequested, true);
  assert.equal(command.rootURL.href, "file:///workspace/project/src");
  assert.equal(command.scope, ArchitectureLintScope.All);
  assert.equal(command.configURL, undefined);
});
