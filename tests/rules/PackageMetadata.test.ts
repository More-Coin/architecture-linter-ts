import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
  readonly bin?: Record<string, string>;
  readonly exports?: Record<string, { readonly import?: string; readonly types?: string }>;
  readonly files?: readonly string[];
};

test("package metadata exposes the installable CLI and curated root export", () => {
  assert.equal(packageJSON.bin?.["architecture-linter"], "./dist/cli.js");
  assert.equal(packageJSON.exports?.["."].import, "./dist/index.js");
  assert.equal(packageJSON.exports?.["."].types, "./dist/index.d.ts");
  assert.deepEqual(packageJSON.files, ["dist", "README.md"]);
});
