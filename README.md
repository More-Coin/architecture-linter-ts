# architecture-linter-ts

`architecture-linter-ts` is a TypeScript clean architecture linter powered by `ts-morph`. It can run as a CLI from `node_modules/.bin` in another project, or it can be imported as a small programmatic API.

## Requirements

- Node.js 20 or newer
- A `tsconfig.json` in the consuming repository
- TypeScript source files under `./src` by default, unless you pass a different root path

## Install From GitHub

### npm

```bash
npm install --save-dev github:More-Coin/architecture-linter-ts#v0.1.0
```

### pnpm

```bash
pnpm add --save-dev github:More-Coin/architecture-linter-ts#v0.1.0
```

### yarn

```bash
yarn add --dev github:More-Coin/architecture-linter-ts#v0.1.0
```

## Run From a Consuming Project

Add a script in the consuming project's `package.json`:

```json
{
  "scripts": {
    "lint:architecture": "architecture-linter"
  }
}
```

Then run:

```bash
npm run lint:architecture
```

The packaged CLI supports these forms:

```bash
architecture-linter
architecture-linter ./src
architecture-linter . --config .architecture-linter.json
architecture-linter --scope tests
```

`architecture-linter` exits with:

- `0` when no diagnostics are emitted
- `1` when diagnostics are emitted or when the CLI encounters an argument, config, or runtime error

Diagnostics are rendered one per line in this format:

```text
path/to/file.ts:10:5: [rule.id] Explanation of the problem.
```

## Configuration

If present, the CLI loads `.architecture-linter.json` from the lint root unless you override it with `--config`.

Minimal example:

```json
{
  "testRootName": "<ProjectName>Tests",
  "runtimeNamespaceSegments": [],
  "diagnosticsSubpath": "Diagnostics/ArchitectureLinter",
  "sourceExtensions": [".ts"],
  "tsConfigFilePath": "tsconfig.json",
  "moduleAliases": {
    "runtimeSurface": [],
    "commandSurface": [],
    "diagnostics": ["architecture-linter-ts"]
  },
  "disabledRuleIDs": [],
  "disabledRulePrefixes": []
}
```

## Library Usage

You can also call the linter directly:

```ts
import {
  ArchitectureLintScope,
  lintProject,
} from "architecture-linter-ts";

const result = lintProject({
  rootURL: process.cwd(),
  scope: ArchitectureLintScope.All,
});

for (const diagnostic of result.diagnostics) {
  console.log(diagnostic.ruleID, diagnostic.message);
}
```

If you want direct control over instantiation, the package also exports `ArchitectureLinter`, `DefaultArchitecturePolicies`, `DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION`, and the `ArchitectureLinterConfiguration` / `ArchitectureLintResult` types.
