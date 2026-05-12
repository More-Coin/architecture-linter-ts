# architecture-linter-ts

`architecture-linter-ts` is a TypeScript/TSX clean architecture linter powered by `ts-morph`. It can run as a CLI from `node_modules/.bin` in another project, or it can be imported as a small programmatic API.

## Requirements

- Node.js 20 or newer
- A `tsconfig.json` in the consuming repository
- TypeScript or TSX source files under `./src` by default, unless you pass a different root path

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
  "sourceExtensions": [".ts", ".tsx"],
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

## Architectural Rule Families

`architecture-linter-ts` mirrors the rule coverage of the Swift reference linter (`More-Coin/ArchitectureLinter`). After Stage 6 the registered rule families are:

- **Domain** — forbidden imports, outer-layer references, dependency-resolution detection, durable structure, policy purity, policy shape, protocol naming, structured-error shape and placement, repository-protocol placement.
- **Cross-architecture** — service-role placement (`*Service` only in `Application/Services`) and technical-seam-protocol placement (`*Protocol` / `*Interface` / `*Port` family in `Application/Ports/Protocols` or `Domain/Protocols`).
- **Application** — contracts (shape, ownership, error taxonomy, no collaborator dependencies, nested-error placement, no state-transition or error-mapping surfaces), port-protocol shape, errors, passive-file dependency-resolution detection, ambiguous-role-name suffixes, services (shape, no protocols, port-protocol reference, service-to-service, use-case construction, dependency resolution, orchestration, surface, infrastructure/repository/platform reference), use cases (shape, no protocols, use-case-to-use-case reference, dependency resolution, boundary-type reference, operation shape, abstraction delegation, surface, infrastructure/platform/service reference).
- **Presentation** — controllers (shape, service reference, function-seam), routes/DTOs/presenters/renderers/middleware/view-models/views/styles/errors shape, errors placement, broad `presentation.usecase_reference` covering every Presentation file kind, port-protocol reference, composition-root reference, dependency-resolution detection, infrastructure reference.
- **App composition** — configuration, runtime, dependency-injection, composition-root inward-reference.
- **Infrastructure** — repositories (shape + role-fit), gateways (shape + role-fit + inline-shape-violation family), port-adapters (shape + inline-shape-violation family), evaluators (shape + execution/translation surface exclusions), translation models + DTOs (shape + boundary surface exclusions), translation directional naming, infrastructure errors and forbidden-presentation-dependency, cross-layer protocol conformance, application-contract-behavior attachment.
- **Tests** — legacy root, runtime layered location, diagnostics location, shared-support placement, mega/mixed-responsibility suite blocks, test-doubles-only support, import ownership, linter-harness extraction.

Every registered diagnostic now uses the Swift-parity 5-marker remediation format (`Likely categories`, `signs`, `architectural note`, `destination`, `explicit decomposition guidance`).

### TypeScript-specific extras

These rules exist in TS only — they are not in the Swift linter:

- `source_root.layout` — validates the top-level `src/` layout against the canonical clean-architecture layout.
- `source_root.empty_directory` (project-level) — flags empty source-root directories that hide whether work is finished or partially removed.
- `infrastructure.empty_directory` (project-level) — same hygiene check, scoped to Infrastructure.
- `infrastructure.role_folder_structure` — flags unsupported first-level role folders under `Infrastructure/`. **TS translation of Swift's `infrastructure.unknown_subdirectory`.**
- `infrastructure.translation.structure` — flags loose files directly under `Infrastructure/Translation/` (outside `Models/` and `DTOs/`). **Companion to the above for the Translation subtree.**

### Configuration parity notes

If you are porting an `.architecture-linter.json` config from the Swift linter, three rule-id renames matter:

- **`infrastructure.unknown_subdirectory` is not a TS rule ID.** TypeScript translates the Swift behavior into two TS-specific rules: `infrastructure.role_folder_structure` and `infrastructure.translation.structure`. A `disabledRuleIDs: ["infrastructure.unknown_subdirectory"]` entry copied from a Swift config will be **inert** in TS — disable the two TS rule IDs explicitly, or disable the `infrastructure.` prefix.
- **`presentation.controllers.usecase_reference` is no longer registered by default.** The TS class is still exported for manual/custom policy construction, but the default registry ships only the broader `presentation.usecase_reference` rule (which covers every Presentation file kind, including controllers). Mirrors Swift's deprecated-but-defined stance.
- **`tests.swiftpm_test_targets_must_point_to_repo_test_root` is intentionally not applicable.** TypeScript has no equivalent of a SwiftPM `testTarget.path` field; honest translations (package.json scripts, vitest/jest config, tsconfig paths) carry meaningfully different semantics and a non-trivial false-positive risk. The other Swift `tests.*` rules (`tests.no_active_tests_under_legacy_tests_root`, `tests.runtime_suite_must_follow_layered_location`, `tests.linter_suite_must_live_under_diagnostics`, …) are all ported.

A full parity matrix lives at [`PARITY.md`](./PARITY.md).
