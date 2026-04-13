import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const tempRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "architecture-linter-package-"),
);

let tarballPath;

try {
  const packOutput = execFileSync("npm", ["pack", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const [packResult] = JSON.parse(packOutput);

  tarballPath = path.join(repoRoot, packResult.filename);
  assert.ok(fs.existsSync(tarballPath));

  const tarEntries = execFileSync("tar", ["-tf", tarballPath], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim().split("\n");

  assert.ok(tarEntries.includes("package/dist/cli.js"));
  assert.ok(tarEntries.includes("package/dist/index.js"));
  assert.ok(tarEntries.includes("package/package.json"));
  assert.ok(tarEntries.includes("package/README.md"));
  assert.ok(!tarEntries.some((entry) => entry.startsWith("package/src/")));

  const consumerDir = path.join(tempRoot, "consumer");
  fs.mkdirSync(consumerDir, { recursive: true });
  fs.mkdirSync(path.join(consumerDir, "src"), { recursive: true });

  fs.writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify({
      name: "architecture-linter-consumer-smoke",
      private: true,
      type: "module",
      scripts: {
        "lint:architecture": "architecture-linter",
      },
    }, null, 2),
  );
  fs.writeFileSync(
    path.join(consumerDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      include: ["src/**/*.ts"],
    }, null, 2),
  );
  fs.writeFileSync(
    path.join(consumerDir, "src", "index.ts"),
    "export const smokeCheck = true;\n",
  );
  fs.writeFileSync(
    path.join(consumerDir, "verify-library.mjs"),
    [
      "import assert from \"node:assert/strict\";",
      "import {",
      "  ArchitectureLinter,",
      "  ArchitectureLintScope,",
      "  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,",
      "  DefaultArchitecturePolicies,",
      "  lintProject,",
      "} from \"architecture-linter-ts\";",
      "",
      "const lintResult = lintProject({",
      "  rootURL: process.cwd(),",
      "  scope: ArchitectureLintScope.All,",
      "});",
      "assert.ok(Array.isArray(lintResult.diagnostics));",
      "assert.equal(lintResult.diagnostics.length, 0);",
      "",
      "const configuration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;",
      "const linter = new ArchitectureLinter({",
      "  configuration,",
      "  policies: DefaultArchitecturePolicies.make(configuration),",
      "});",
      "const directResult = linter.lintProject(new URL(`file://${process.cwd()}/`));",
      "assert.ok(Array.isArray(directResult.diagnostics));",
    ].join("\n"),
  );

  execFileSync("npm", ["install", "--save-dev", tarballPath], {
    cwd: consumerDir,
    stdio: "inherit",
  });

  const npxOutput = execFileSync("npx", ["architecture-linter"], {
    cwd: consumerDir,
    encoding: "utf8",
  });
  assert.equal(npxOutput.trim(), "");

  const scriptOutput = execFileSync("npm", ["run", "lint:architecture"], {
    cwd: consumerDir,
    encoding: "utf8",
  });
  assert.equal(scriptOutput.trim(), "");

  execFileSync("node", ["./verify-library.mjs"], {
    cwd: consumerDir,
    stdio: "inherit",
  });
} finally {
  if (tarballPath && fs.existsSync(tarballPath)) {
    fs.rmSync(tarballPath, { force: true });
  }
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
