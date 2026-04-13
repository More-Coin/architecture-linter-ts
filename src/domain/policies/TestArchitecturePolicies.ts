import type { ArchitectureLinterConfiguration } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../ValueObjects/ArchitectureLinterConfiguration.ts";
import type { ArchitecturePolicyProtocol } from "../Protocols/ArchitecturePolicyProtocol.ts";
import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../ValueObjects/ArchitectureFile.ts";
import type { ArchitectureImportOccurrence } from "../ValueObjects/ArchitectureImportOccurrence.ts";
import type { ArchitectureMethodDeclaration } from "../ValueObjects/ArchitectureMethodDeclaration.ts";
import type { ArchitectureNestedNominalDeclaration } from "../ValueObjects/ArchitectureNestedNominalDeclaration.ts";
import type { ArchitectureTopLevelDeclaration } from "../ValueObjects/ArchitectureTopLevelDeclaration.ts";
import type { ProjectContext } from "../ValueObjects/ProjectContext.ts";

export class TestsLegacyRootPolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID = "tests.no_active_tests_under_legacy_tests_root";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isLegacyTestFile) {
      return [];
    }

    const declaration = primaryTestSuite(file);
    if (!declaration) {
      return [];
    }

    return [
      file.diagnostic(
        TestsLegacyRootPolicy.ruleID,
        testArchitectureMessage({
          summary: `Active test suite '${declaration.name}' still lives under the legacy Tests/ root.`,
          categories: [
            "legacy runtime or diagnostics suite path",
            "half-migrated test tree where active suites remain under Tests/",
            "package manifest or test runner config still points at the old filesystem layout",
          ],
          signs: [
            "repo-relative path begins with Tests/",
            "the file still declares a primary test suite or test-bearing type",
            "the canonical repo test root ending in Tests is not yet the only active location.",
          ],
          architecturalNote:
            "The repo should have exactly one active filesystem root for tests. Leaving active suites under Tests/ creates split ownership, weakens lint guidance, and makes migration harder for both humans and agents.",
          destination: legacyDestinationGuidance(file, this.configuration),
          decomposition:
            `move the suite into its canonical layered bucket under the repo test root ending in Tests, move reusable spies, builders, and temp-workspace support into ${testDoublesCanonicalPrefix(file, this.configuration)} when needed, then repoint the package manifest or test runner config so the legacy Tests/ root becomes empty.`,
        }),
        declaration.coordinate,
      ),
    ];
  }
}

export class TestsRuntimeLayeredLocationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "tests.runtime_suite_must_follow_layered_location";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isRuntimeTestFile(file, this.configuration)) {
      return [];
    }

    const inferredBuckets = inferredRuntimeBuckets(file, this.configuration);
    if (inferredBuckets.length !== 1) {
      return [];
    }

    const bucket = inferredBuckets[0];
    if (!bucket) {
      return [];
    }

    const expectedPrefix = runtimeBucketCanonicalPrefix(
      bucket,
      file,
      this.configuration,
    );
    if (file.repoRelativePath.startsWith(expectedPrefix)) {
      return [];
    }

    const declaration = primaryTestSuite(file);
    return [
      file.diagnostic(
        TestsRuntimeLayeredLocationPolicy.ruleID,
        testArchitectureMessage({
          summary: `Runtime suite '${declaration?.name ?? file.classification.fileStem}' is not placed in the canonical ${bucket} test bucket.`,
          categories: [
            `${bucket} runtime suite`,
            "legacy runtime suite path",
            "layer-aligned test ownership mismatch",
          ],
          signs: [
            "the suite imports project runtime or command-surface modules, or its path and member names point at one runtime ownership bucket",
            `the suite name and member names point at ${runtimeBucketSignDescription(bucket)}`,
            `the repo-relative path does not begin with ${expectedPrefix}.`,
          ],
          architecturalNote:
            "Runtime tests should mirror the production architecture buckets so ownership stays obvious: Application tests with application responsibilities, Infrastructure tests with boundary behaviors, Domain tests with policies, Presentation tests with presentation seams, and App tests with bootstrap or wiring responsibilities.",
          destination: `place this suite under ${expectedPrefix}.`,
          decomposition: runtimeBucketDecompositionGuidance(bucket),
        }),
        declaration?.coordinate,
      ),
    ];
  }
}

export class TestsDiagnosticsLocationPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "tests.linter_suite_must_live_under_diagnostics";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isDiagnosticsTestFile(file, this.configuration)) {
      return [];
    }

    const expectedPrefix = diagnosticsCanonicalPrefix(file, this.configuration);
    if (file.repoRelativePath.startsWith(expectedPrefix)) {
      return [];
    }

    const declaration = primaryTestSuite(file);
    return [
      file.diagnostic(
        TestsDiagnosticsLocationPolicy.ruleID,
        testArchitectureMessage({
          summary: `Architecture-linter suite '${declaration?.name ?? file.classification.fileStem}' is not rooted under Diagnostics.`,
          categories: [
            "diagnostics suite rooted outside the canonical Diagnostics test tree",
            "legacy architecture-linter suite path",
            "test ownership mismatch between runtime coverage and diagnostics coverage",
          ],
          signs: [
            "the file imports diagnostics-only modules or otherwise behaves like architecture-linter coverage",
            "the file behaves like diagnostics coverage rather than runtime feature coverage",
            `the repo-relative path does not begin with ${expectedPrefix}.`,
          ],
          architecturalNote:
            "Architecture-linter tests are diagnostics coverage, not runtime feature tests. They should live under a dedicated Diagnostics root so agents can distinguish structural lint coverage from project runtime coverage.",
          destination: `move diagnostics suites under ${expectedPrefix}.`,
          decomposition:
            `split diagnostics coverage by rule family under ${expectedPrefix}, keep reusable harness code in a Support subtree under that diagnostics root, and keep runtime suites out of Diagnostics entirely.`,
        }),
        declaration?.coordinate,
      ),
    ];
  }
}

export class TestsSharedSupportPlacementPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "tests.shared_support_must_live_in_test_doubles";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isRuntimeTestFile(file, this.configuration) || isTestDoublesFile(file)) {
      return [];
    }

    const supportDeclarations = supportNominalDeclarations(file);
    const supportHelpers = supportHelperMethods(file);
    if (supportDeclarations.length === 0 && supportHelpers.length < 3) {
      return [];
    }

    const renderedNames = [...supportDeclarations, ...supportHelpers]
      .map((declaration) => declaration.name)
      .slice(0, 6)
      .join(", ");
    const firstCoordinate =
      supportDeclarations[0]?.coordinate ?? supportHelpers[0]?.coordinate;

    return [
      file.diagnostic(
        TestsSharedSupportPlacementPolicy.ruleID,
        testArchitectureMessage({
          summary: `Runtime suite '${file.classification.fileStem}' still embeds reusable test support (${renderedNames}).`,
          categories: [
            "embedded spies or fakes in an active runtime suite",
            "embedded builders, fixtures, or temp-workspace helpers in a runtime suite",
            "runtime support ownership that should live in TestDoubles",
          ],
          signs: [
            "the file declares support-shaped types such as Spy, Fake, Builder, Recorder, Environment, or Transport, or it carries multiple private helper builders",
            "the suite mixes scenario assertions with reusable support infrastructure",
            `the support does not live under ${testDoublesCanonicalPrefix(file, this.configuration)}.`,
          ],
          architecturalNote:
            "Large runtime suites become hard to decompose when support infrastructure stays embedded. Shared or reusable test support should live in the dedicated TestDoubles tree so scenario suites can stay focused on one responsibility family.",
          destination:
            `move reusable support to ${testDoublesCanonicalPrefix(file, this.configuration)} and keep only scenario-specific assertions in the active suite file.`,
          decomposition:
            "extract spies, fakes, builders, fake transports, fixture builders, and temp-workspace helpers to TestDoubles first; then trim the suite down to the specific scenarios that still need to stay together.",
        }),
        firstCoordinate,
      ),
    ];
  }
}

export class TestsMegaArchitectureLinterSuitePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "tests.no_mega_architecture_linter_suite";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isDiagnosticsTestFile(file, this.configuration)) {
      return [];
    }

    const hasMegaSuite =
      file.classification.fileStem === "ArchitectureLinterTests" ||
      file.topLevelDeclarations.some(
        (declaration) => declaration.name === "ArchitectureLinterTests",
      );
    if (!hasMegaSuite) {
      return [];
    }

    const declaration = primaryTestSuite(file);
    return [
      file.diagnostic(
        TestsMegaArchitectureLinterSuitePolicy.ruleID,
        testArchitectureMessage({
          summary:
            "Diagnostics coverage still relies on a single mega-suite named ArchitectureLinterTests.",
          categories: [
            "single diagnostics mega-suite",
            "mixed rule-family coverage in one diagnostics file",
            "extracted harness and support still hidden inside the main architecture-linter suite",
          ],
          signs: [
            "the file name or primary suite name is ArchitectureLinterTests",
            "the suite acts as the catch-all entry point for multiple architecture policy families",
            "support collectors or harness helpers are still colocated with the main diagnostics scenarios.",
          ],
          architecturalNote:
            "Diagnostics suites should be split by rule family so failures point directly at the owning architectural area and so agents can remediate one family at a time.",
          destination:
            `split diagnostics coverage under ${diagnosticsCanonicalPrefix(file, this.configuration)} into Domain, ApplicationContracts, ApplicationServicesUseCases, Infrastructure, PresentationApp, and Support or Harness files.`,
          decomposition:
            "first extract reusable lint harness and syntax collectors to a Support subtree, then split rule-family scenarios into separate diagnostics files, and finally remove the single ArchitectureLinterTests mega-suite entry point.",
        }),
        declaration?.coordinate,
      ),
    ];
  }
}

export class TestsMixedResponsibilityRuntimeSuitePolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "tests.no_mixed_responsibility_runtime_suites";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isRuntimeTestFile(file, this.configuration)) {
      return [];
    }

    const families = runtimeResponsibilityFamilies(file, this.configuration);
    if (families.length <= 1) {
      return [];
    }

    const declaration = primaryTestSuite(file);
    const renderedFamilies = families.join(", ");
    const destinations = families
      .map((family) =>
        responsibilityFamilyCanonicalPrefix(family, file, this.configuration),
      )
      .join(", ");

    return [
      file.diagnostic(
        TestsMixedResponsibilityRuntimeSuitePolicy.ruleID,
        testArchitectureMessage({
          summary: `Runtime suite '${declaration?.name ?? file.classification.fileStem}' mixes multiple responsibility families (${renderedFamilies}).`,
          categories: [
            "application plus presentation responsibilities in one file",
            "application plus app-bootstrap responsibilities in one file",
            "cross-layer runtime coverage hidden behind one suite name",
          ],
          signs: [
            "member names or imports indicate more than one ownership family across Application, Infrastructure, Domain, Presentation, or App",
            "the suite cannot move cleanly into one canonical layer bucket without splitting",
            `multiple remediation destinations are implied: ${destinations}.`,
          ],
          architecturalNote:
            "A runtime suite should tell one ownership story. When one file mixes DTO parsing, controller rendering, service validation, runtime wiring, or gateway behavior, the resulting failures stop pointing to a single architectural owner.",
          destination:
            `split the suite into separate files under the canonical family buckets: ${destinations}.`,
          decomposition:
            "slice the file by responsibility family first, then move each slice into its matching canonical directory, and finally extract any shared support to TestDoubles instead of leaving it in one umbrella suite.",
        }),
        declaration?.coordinate,
      ),
    ];
  }
}

export class TestsTestDoublesOnlySupportPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "tests.only_test_support_in_test_doubles";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isTestDoublesFile(file)) {
      return [];
    }

    const suiteDeclaration = primaryTestSuite(file);
    if (!suiteDeclaration) {
      return [];
    }

    return [
      file.diagnostic(
        TestsTestDoublesOnlySupportPolicy.ruleID,
        testArchitectureMessage({
          summary: `Test-doubles file '${file.classification.fileStem}' still declares active suite '${suiteDeclaration.name}'.`,
          categories: [
            "real test suite placed in TestDoubles",
            "support folder owning active scenarios instead of reusable helpers",
            "test-support boundary violation",
          ],
          signs: [
            `the file lives under ${canonicalTestRootName(file, this.configuration)}/TestDoubles/...`,
            "it still exposes a top-level declaration ending in Tests",
            "the file is carrying active scenarios instead of pure reusable support.",
          ],
          architecturalNote:
            "TestDoubles is the ownership home for reusable support only. Scenario suites should stay in their layer-aligned directories, while TestDoubles stays reserved for spies, fakes, builders, fixtures, and temp-workspace helpers.",
          destination:
            `move the active suite out of TestDoubles and leave only support types in ${canonicalTestRootName(file, this.configuration)}/TestDoubles/...`,
          decomposition:
            "extract any reusable support from the suite, keep that support in TestDoubles, then move the scenario file into its layer-aligned Application, Infrastructure, Domain, Presentation, App, or Diagnostics location.",
        }),
        suiteDeclaration.coordinate,
      ),
    ];
  }
}

export class TestsImportOwnershipPolicy implements ArchitecturePolicyProtocol {
  static readonly ruleID =
    "tests.test_files_should_import_only_needed_runtime_targets";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!file.classification.isTestFile || isUITestFile(file)) {
      return [];
    }

    const diagnostics: ArchitectureDiagnostic[] = [];

    if (isDiagnosticsTestFile(file, this.configuration)) {
      const occurrence = firstRuntimeOrCommandSurfaceImport(
        file,
        this.configuration,
      );
      if (occurrence) {
        diagnostics.push(
          file.diagnostic(
            TestsImportOwnershipPolicy.ruleID,
            testArchitectureMessage({
              summary: `Diagnostics test file '${file.classification.fileStem}' imports runtime module '${occurrence.moduleName}'.`,
              categories: [
                "diagnostics suite with runtime dependency bleed",
                "misclassified runtime scenarios under diagnostics",
                "test-module ownership mismatch",
              ],
              signs: [
                "the file already behaves like an architecture-linter suite",
                "a runtime module import appears alongside diagnostics imports",
                "the suite is not isolated to architecture-linter diagnostics ownership.",
              ],
              architecturalNote:
                "Diagnostics suites should stay focused on linter behavior and should not accrete runtime module dependencies unless the suite has been misclassified and should move out of Diagnostics.",
              destination:
                `keep diagnostics suites limited to architecture-linter-related imports and move runtime scenarios to ${runtimeBucketDestinationSummary(file, this.configuration)} instead.`,
              decomposition:
                "separate runtime scenarios from diagnostics assertions first, move the runtime scenarios to their layer-aligned buckets, and leave only diagnostics-focused imports in the Diagnostics tree.",
            }),
            occurrence.coordinate,
          ),
        );
      }
    }

    if (isRuntimeTestFile(file, this.configuration)) {
      const occurrence = firstDiagnosticsImport(file, this.configuration);
      if (occurrence) {
        diagnostics.push(
          file.diagnostic(
            TestsImportOwnershipPolicy.ruleID,
            testArchitectureMessage({
              summary: `Runtime test file '${file.classification.fileStem}' imports diagnostics-only module '${occurrence.moduleName}'.`,
              categories: [
                "runtime suite carrying diagnostics dependencies",
                "misclassified architecture-linter coverage in a runtime suite",
                "test-module ownership mismatch",
              ],
              signs: [
                "the file otherwise behaves like project runtime coverage",
                "an architecture-linter or parser module import appears in the runtime suite",
                "the suite likely belongs in Diagnostics or needs to be split.",
              ],
              architecturalNote:
                "Runtime suites should depend on runtime modules only. Diagnostics dependencies inside a runtime suite are a signal that diagnostics coverage has leaked out of the dedicated Diagnostics tree.",
              destination:
                `move diagnostics-focused assertions to ${diagnosticsCanonicalPrefix(file, this.configuration)} and keep runtime suites limited to their needed project runtime or command-surface modules.`,
              decomposition:
                "extract diagnostics-specific assertions into dedicated Diagnostics files, remove parser or linter imports from the runtime suite, and keep only the runtime-target imports the scenario actually exercises.",
            }),
            occurrence.coordinate,
          ),
        );
      }
    }

    if (
      isRuntimeTestFile(file, this.configuration) &&
      !file.repoRelativePath.startsWith(appBucketPrefix(file, this.configuration)) &&
      hasRuntimeSurfaceImport(file, this.configuration) &&
      hasCommandSurfaceImport(file, this.configuration)
    ) {
      const occurrence = firstCommandSurfaceImport(file, this.configuration);
      if (occurrence) {
        diagnostics.push(
          file.diagnostic(
            TestsImportOwnershipPolicy.ruleID,
            testArchitectureMessage({
              summary:
                `Runtime suite '${file.classification.fileStem}' imports both runtime-surface and command-surface modules outside the App test bucket.`,
              categories: [
                "application plus app-bootstrap responsibilities in one runtime suite",
                "suite that still mixes runtime wiring with lower-level scenarios",
                "cross-layer import ownership mismatch",
              ],
              signs: [
                "runtime-surface and command-surface modules are both imported in the same non-App suite",
                "the suite likely covers runtime behavior plus bootstrap or command-surface behavior together",
                "the file cannot stay in one non-App canonical bucket without splitting.",
              ],
              architecturalNote:
                "Non-App runtime suites should generally test one layer-facing surface. Pulling command-surface imports alongside runtime-surface imports usually means the suite mixes bootstrap or command-surface behavior with lower-level runtime responsibilities.",
              destination:
                `move bootstrap or command-surface scenarios to ${appBucketPrefix(file, this.configuration)} and leave lower-level runtime scenarios in their Application, Infrastructure, Domain, or Presentation bucket.`,
              decomposition:
                "separate App-facing command-surface or bootstrap scenarios first, move them to the App test bucket, then leave the remaining runtime scenarios with only the lower-level runtime-surface dependency.",
            }),
            occurrence.coordinate,
          ),
        );
      }
    }

    return diagnostics;
  }
}

export class TestsLinterHarnessExtractionPolicy
  implements ArchitecturePolicyProtocol
{
  static readonly ruleID = "tests.linter_harness_support_must_be_extracted";

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  ) {}

  evaluate(
    file: ArchitectureFile,
    _context: ProjectContext,
  ): readonly ArchitectureDiagnostic[] {
    if (!isDiagnosticsTestFile(file, this.configuration)) {
      return [];
    }

    if (
      file.repoRelativePath.startsWith(
        diagnosticsSupportPrefix(file, this.configuration),
      )
    ) {
      return [];
    }

    const harnessDeclarations = harnessSupportDeclarations(file);
    const harnessMethods = harnessSupportMethods(file);
    if (harnessDeclarations.length === 0 && harnessMethods.length === 0) {
      return [];
    }

    const coordinate =
      harnessDeclarations[0]?.coordinate ?? harnessMethods[0]?.coordinate;
    const names = [...harnessDeclarations, ...harnessMethods]
      .map((declaration) => declaration.name)
      .slice(0, 8)
      .join(", ");

    return [
      file.diagnostic(
        TestsLinterHarnessExtractionPolicy.ruleID,
        testArchitectureMessage({
          summary: `Diagnostics suite '${file.classification.fileStem}' still embeds reusable lint harness support (${names}).`,
          categories: [
            "embedded lint harness helpers in the main diagnostics suite",
            "embedded syntax collectors or repo-fixture builders in the main diagnostics suite",
            "diagnostics support ownership that should be extracted",
          ],
          signs: [
            "the file declares collector, harness, repo-fixture, or lint-helper types and methods",
            "support code sits beside diagnostics scenarios instead of a dedicated Support location",
            "the suite cannot be cleanly split by rule family while support stays embedded.",
          ],
          architecturalNote:
            "Diagnostics suites should not own their shared harness. Extracted harness support makes rule-family files smaller and keeps diagnostics failures focused on architecture behavior instead of parser plumbing.",
          destination:
            `move reusable lint harness code to ${diagnosticsSupportPrefix(file, this.configuration)} and keep rule-family scenarios in separate diagnostics files.`,
          decomposition:
            "extract repo-fixture builders and lint helpers first, extract syntax collectors and reusable analyzer support next, then split the remaining diagnostics scenarios by rule family.",
        }),
        coordinate,
      ),
    ];
  }
}

export function makeTestArchitecturePolicies(
  configuration: ArchitectureLinterConfiguration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
): readonly ArchitecturePolicyProtocol[] {
  return [
    new TestsLegacyRootPolicy(configuration),
    new TestsRuntimeLayeredLocationPolicy(configuration),
    new TestsDiagnosticsLocationPolicy(configuration),
    new TestsSharedSupportPlacementPolicy(configuration),
    new TestsMegaArchitectureLinterSuitePolicy(configuration),
    new TestsMixedResponsibilityRuntimeSuitePolicy(configuration),
    new TestsTestDoublesOnlySupportPolicy(configuration),
    new TestsImportOwnershipPolicy(configuration),
    new TestsLinterHarnessExtractionPolicy(configuration),
  ];
}

enum RuntimeTestBucket {
  Application = "Application",
  Infrastructure = "Infrastructure",
  Domain = "Domain",
  Presentation = "Presentation",
  App = "App",
}

enum RuntimeResponsibilityFamily {
  Application = "Application",
  Infrastructure = "Infrastructure",
  Domain = "Domain",
  Presentation = "Presentation",
  App = "App",
}

function testArchitectureMessage(input: {
  readonly summary: string;
  readonly categories: readonly string[];
  readonly signs: readonly string[];
  readonly architecturalNote: string;
  readonly destination: string;
  readonly decomposition: string;
}): string {
  return `${input.summary} Likely categories: ${input.categories.join("; ")}; signs: ${input.signs.join("; ")}; architectural note: ${input.architecturalNote}; destination: ${input.destination}; explicit decomposition guidance: ${input.decomposition}`;
}

function primaryTestSuite(
  file: ArchitectureFile,
): ArchitectureTopLevelDeclaration | undefined {
  return file.topLevelDeclarations.find((declaration) =>
    declaration.name.endsWith("Tests"),
  );
}

function importedModules(file: ArchitectureFile): ReadonlySet<string> {
  return new Set(file.imports.map((occurrence) => occurrence.moduleName));
}

const COMMAND_SURFACE_MODULE_TERMS = ["cli", "command"] as const;
const RUNTIME_SURFACE_MODULE_TERMS = ["runtime"] as const;

function isUITestFile(file: ArchitectureFile): boolean {
  return file.classification.isUITestFile;
}

function diagnosticsModuleNames(
  configuration: ArchitectureLinterConfiguration,
): ReadonlySet<string> {
  return new Set(configuration.moduleAliases.diagnostics);
}

function isDiagnosticsModuleName(
  moduleName: string,
  configuration: ArchitectureLinterConfiguration,
): boolean {
  return diagnosticsModuleNames(configuration).has(moduleName);
}

function isDiagnosticsTestFile(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): boolean {
  if (!file.classification.isTestFile) {
    return false;
  }

  const modules = importedModules(file);
  return (
    Array.from(modules).some((moduleName) =>
      isDiagnosticsModuleName(moduleName, configuration),
    ) ||
    file.repoRelativePath.includes("/Diagnostics/") ||
    file.classification.fileStem.includes("ArchitectureLinter")
  );
}

function isRuntimeTestFile(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): boolean {
  return (
    file.classification.isTestFile &&
    !isUITestFile(file) &&
    !isDiagnosticsTestFile(file, configuration) &&
    !isTestDoublesFile(file) &&
    primaryTestSuite(file) !== undefined
  );
}

function isTestDoublesFile(file: ArchitectureFile): boolean {
  return (
    file.classification.isCanonicalRepoTestFile &&
    file.classification.pathComponentsFromTestRoot.slice(1)[0] === "TestDoubles"
  );
}

function legacyDestinationGuidance(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): string {
  if (isDiagnosticsTestFile(file, configuration)) {
    return `move diagnostics suites under ${diagnosticsCanonicalPrefix(file, configuration)}.`;
  }

  const inferred = inferredRuntimeBuckets(file, configuration);
  if (inferred.length !== 1 || !inferred[0]) {
    return `move runtime suites under ${runtimeBucketDestinationSummary(file, configuration)} based on the owning responsibility family.`;
  }

  return `move the suite under ${runtimeBucketCanonicalPrefix(inferred[0], file, configuration)}.`;
}

function canonicalTestRootName(
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string {
  const root = file?.classification.testRootComponent;
  if (
    root &&
    root !== "Tests" &&
    root.endsWith("Tests") &&
    !root.endsWith("UITests")
  ) {
    return root;
  }

  return configuration.testRootName;
}

function testContainerPrefix(file: ArchitectureFile | undefined): string {
  const testRootIndex = file?.classification.testRootIndex;
  if (file && testRootIndex !== undefined && testRootIndex > 0) {
    return `${file.classification.pathComponents.slice(0, testRootIndex).join("/")}/`;
  }

  return "";
}

function normalizedDiagnosticsSubpath(
  configuration: ArchitectureLinterConfiguration,
): string {
  return configuration.diagnosticsSubpath
    .split("/")
    .filter((segment) => segment.length > 0)
    .join("/");
}

function diagnosticsCanonicalPrefix(
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string {
  return `${testContainerPrefix(file)}${canonicalTestRootName(file, configuration)}/${normalizedDiagnosticsSubpath(configuration)}/`;
}

function diagnosticsSupportPrefix(
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string {
  return `${diagnosticsCanonicalPrefix(file, configuration)}Support/`;
}

function configuredRuntimeNamespaceSegment(
  configuration: ArchitectureLinterConfiguration,
): string | undefined {
  return configuration.runtimeNamespaceSegments.find(
    (segment) => segment.length > 0,
  );
}

function testDoublesCanonicalPrefix(
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string {
  const base = `${testContainerPrefix(file)}${canonicalTestRootName(file, configuration)}/TestDoubles/`;
  const namespaceSegment = runtimeNamespaceSegment(file, configuration);
  return namespaceSegment ? `${base}${namespaceSegment}/` : base;
}

function appBucketPrefix(
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string {
  return runtimeBucketCanonicalPrefix(RuntimeTestBucket.App, file, configuration);
}

function runtimeBucketDestinationSummary(
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string {
  const testRootPrefix = `${testContainerPrefix(file)}${canonicalTestRootName(file, configuration)}`;
  return `${testRootPrefix}/Application|Infrastructure|Domain|Presentation|App/...`;
}

function runtimeBucketCanonicalPrefix(
  bucket: RuntimeTestBucket,
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string {
  const namespaceSegment = runtimeNamespaceSegment(file, configuration);
  const base = `${canonicalTestRootName(file, configuration)}/${bucket}/`;
  const bucketPrefix = namespaceSegment ? `${base}${namespaceSegment}/` : base;
  return `${testContainerPrefix(file)}${bucketPrefix}`;
}

function responsibilityFamilyCanonicalPrefix(
  family: RuntimeResponsibilityFamily,
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): string {
  return runtimeBucketCanonicalPrefix(
    runtimeBucketForFamily(family),
    file,
    configuration,
  );
}

function inferredRuntimeBuckets(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): readonly RuntimeTestBucket[] {
  const stem = file.classification.fileStem.toLowerCase();
  const stemTokens = identifierTokens(file.classification.fileStem);
  const path = file.repoRelativePath.toLowerCase();
  const buckets = new Set<RuntimeTestBucket>();

  if (
    stem.includes("gateway") ||
    stem.includes("portadapter") ||
    stem.includes("workspacelifecycle") ||
    stem.includes("reloadmonitor") ||
    stem.includes("tracker")
  ) {
    buckets.add(RuntimeTestBucket.Infrastructure);
  }
  if (stem.includes("policy") || path.includes("/domain/")) {
    buckets.add(RuntimeTestBucket.Domain);
  }
  if (
    !stem.includes("portadapter") &&
    (stem.includes("controller") ||
      stem.includes("renderer") ||
      stem.includes("dto") ||
      stem.includes("presenter") ||
      stem.includes("view"))
  ) {
    buckets.add(RuntimeTestBucket.Presentation);
  }
  if (
    stem.includes("service") ||
    stem.includes("usecase") ||
    stem.includes("contract") ||
    stem.includes("configuration") ||
    stem.includes("carrier") ||
    stem.includes("orchestrator") ||
    stem.includes("workerattempt") ||
    stem.includes("dispatchpreflight")
  ) {
    buckets.add(RuntimeTestBucket.Application);
  }
  if (
    stem.includes("startupflow") ||
    stem.includes("cli") ||
    stem.includes("bootstrap") ||
    stemTokens.has("main") ||
    path.includes("/app/") ||
    hasCommandSurfaceImport(file, configuration)
  ) {
    buckets.add(RuntimeTestBucket.App);
  }

  if (buckets.size === 0) {
    for (const family of runtimeResponsibilityFamilies(file, configuration)) {
      buckets.add(runtimeBucketForFamily(family));
    }
  }

  return RUNTIME_BUCKET_ORDER.filter((bucket) => buckets.has(bucket));
}

function runtimeResponsibilityFamilies(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): readonly RuntimeResponsibilityFamily[] {
  const stem = file.classification.fileStem.toLowerCase();
  const stemTokens = identifierTokens(file.classification.fileStem);
  const methodTokens = testMethodTokens(file);
  const path = file.repoRelativePath.toLowerCase();
  const families = new Set<RuntimeResponsibilityFamily>();

  if (
    stem.includes("gateway") ||
    stem.includes("portadapter") ||
    stem.includes("workspacelifecycle") ||
    stem.includes("reloadmonitor") ||
    stem.includes("tracker") ||
    methodTokens.has("gateway") ||
    methodTokens.has("portadapter") ||
    path.includes("/infrastructure/") ||
    (path.includes("/testdoubles/") && stem.includes("gateway"))
  ) {
    families.add(RuntimeResponsibilityFamily.Infrastructure);
  }

  if (stem.includes("policy") || path.includes("/domain/")) {
    families.add(RuntimeResponsibilityFamily.Domain);
  }

  if (
    !stem.includes("portadapter") &&
    (stem.includes("controller") ||
      stem.includes("renderer") ||
      stem.includes("dto") ||
      stem.includes("presenter") ||
      stem.includes("view") ||
      methodTokens.has("controller") ||
      methodTokens.has("renderer") ||
      methodTokens.has("dto") ||
      methodTokens.has("presenter") ||
      methodTokens.has("view") ||
      path.includes("/presentation/"))
  ) {
    families.add(RuntimeResponsibilityFamily.Presentation);
  }

  if (
    !stem.includes("portadapter") &&
    !methodTokens.has("portadapter") &&
    (stem.includes("service") ||
      stem.includes("usecase") ||
      stem.includes("dispatchpreflight") ||
      stem.includes("contract") ||
      stem.includes("configuration") ||
      stem.includes("carrier") ||
      stem.includes("orchestrator") ||
      stem.includes("workerattempt") ||
      methodTokens.has("service") ||
      methodTokens.has("usecase") ||
      methodTokens.has("contract") ||
      methodTokens.has("configuration") ||
      methodTokens.has("carrier") ||
      methodTokens.has("orchestrator") ||
      path.includes("/application/"))
  ) {
    families.add(RuntimeResponsibilityFamily.Application);
  }

  if (
    stem.includes("startupflow") ||
    stem.includes("cliruntime") ||
    stem.includes("bootstrap") ||
    stemTokens.has("main") ||
    path.includes("/app/") ||
    hasCommandSurfaceImport(file, configuration)
  ) {
    families.add(RuntimeResponsibilityFamily.App);
  }

  return RESPONSIBILITY_FAMILY_ORDER.filter((family) => families.has(family));
}

function normalizedModuleName(moduleName: string): string {
  return identifierTokenList(moduleName).join("");
}

function isCommandSurfaceModuleName(
  moduleName: string,
  configuration: ArchitectureLinterConfiguration,
): boolean {
  if (configuration.moduleAliases.commandSurface.includes(moduleName)) {
    return true;
  }

  const normalized = normalizedModuleName(moduleName);
  return COMMAND_SURFACE_MODULE_TERMS.some((term) => normalized.includes(term));
}

function isRuntimeSurfaceModuleName(
  moduleName: string,
  configuration: ArchitectureLinterConfiguration,
): boolean {
  if (configuration.moduleAliases.runtimeSurface.includes(moduleName)) {
    return true;
  }

  const normalized = normalizedModuleName(moduleName);
  return RUNTIME_SURFACE_MODULE_TERMS.some((term) => normalized.includes(term));
}

function firstRuntimeOrCommandSurfaceImport(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): ArchitectureImportOccurrence | undefined {
  return file.imports.find(
    (occurrence) =>
      isRuntimeSurfaceModuleName(occurrence.moduleName, configuration) ||
      isCommandSurfaceModuleName(occurrence.moduleName, configuration),
  );
}

function firstCommandSurfaceImport(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): ArchitectureImportOccurrence | undefined {
  return file.imports.find((occurrence) =>
    isCommandSurfaceModuleName(occurrence.moduleName, configuration),
  );
}

function firstDiagnosticsImport(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): ArchitectureImportOccurrence | undefined {
  return file.imports.find((occurrence) =>
    isDiagnosticsModuleName(occurrence.moduleName, configuration),
  );
}

function hasRuntimeSurfaceImport(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): boolean {
  return file.imports.some((occurrence) =>
    isRuntimeSurfaceModuleName(occurrence.moduleName, configuration),
  );
}

function hasCommandSurfaceImport(
  file: ArchitectureFile,
  configuration: ArchitectureLinterConfiguration,
): boolean {
  return file.imports.some((occurrence) =>
    isCommandSurfaceModuleName(occurrence.moduleName, configuration),
  );
}

function runtimeNamespaceSegment(
  file: ArchitectureFile | undefined,
  configuration: ArchitectureLinterConfiguration,
): string | undefined {
  if (
    !file ||
    file.classification.pathComponentsFromTestRoot.length < 4 ||
    file.classification.testRootComponent === "Tests"
  ) {
    return configuredRuntimeNamespaceSegment(configuration);
  }

  const components = file.classification.pathComponentsFromTestRoot;
  const candidate = components[2];
  switch (components[1]) {
    case "Application":
    case "Infrastructure":
    case "Domain":
    case "Presentation":
    case "App":
    case "TestDoubles":
      return candidate?.endsWith(".ts")
        ? configuredRuntimeNamespaceSegment(configuration)
        : candidate ?? configuredRuntimeNamespaceSegment(configuration);
    default:
      return configuredRuntimeNamespaceSegment(configuration);
  }
}

function identifierTokenList(value: string): readonly string[] {
  const tokens: string[] = [];
  let current = "";

  for (const character of value) {
    if (/[A-Za-z0-9]/.test(character)) {
      if (/[A-Z]/.test(character) && current.length > 0) {
        tokens.push(current.toLowerCase());
        current = character;
      } else {
        current += character;
      }
    } else if (current.length > 0) {
      tokens.push(current.toLowerCase());
      current = "";
    }
  }

  if (current.length > 0) {
    tokens.push(current.toLowerCase());
  }

  return tokens.filter((token) => token.length > 0);
}

function identifierTokens(value: string): ReadonlySet<string> {
  return new Set(identifierTokenList(value));
}

function testMethodTokens(file: ArchitectureFile): ReadonlySet<string> {
  return new Set(
    file.methodDeclarations.flatMap((declaration) =>
      identifierTokenList(declaration.name),
    ),
  );
}

function supportNominalDeclarations(
  file: ArchitectureFile,
): readonly ArchitectureNestedNominalDeclaration[] {
  return file.nestedNominalDeclarations.filter((declaration) =>
    isSupportTypeName(declaration.name),
  );
}

function supportHelperMethods(
  file: ArchitectureFile,
): readonly ArchitectureMethodDeclaration[] {
  return file.methodDeclarations.filter(
    (declaration) =>
      declaration.isPrivateOrFileprivate && isSupportHelperName(declaration.name),
  );
}

function harnessSupportDeclarations(
  file: ArchitectureFile,
): readonly ArchitectureNestedNominalDeclaration[] {
  return file.nestedNominalDeclarations.filter((declaration) => {
    const lowercasedName = declaration.name.toLowerCase();
    return (
      lowercasedName.includes("collector") ||
      lowercasedName.includes("record") ||
      lowercasedName.includes("fixture") ||
      lowercasedName.includes("repo")
    );
  });
}

function harnessSupportMethods(
  file: ArchitectureFile,
): readonly ArchitectureMethodDeclaration[] {
  return file.methodDeclarations.filter(
    (declaration) =>
      declaration.isPrivateOrFileprivate && isHarnessHelperName(declaration.name),
  );
}

function isSupportTypeName(name: string): boolean {
  const lowercasedName = name.toLowerCase();
  return (
    lowercasedName.endsWith("spy") ||
    lowercasedName.endsWith("fake") ||
    lowercasedName.endsWith("builder") ||
    lowercasedName.endsWith("fixture") ||
    lowercasedName.endsWith("support") ||
    lowercasedName.endsWith("transport") ||
    lowercasedName.endsWith("environment") ||
    lowercasedName.endsWith("recorder")
  );
}

function isSupportHelperName(name: string): boolean {
  const lowercasedName = name.toLowerCase();
  return (
    lowercasedName.startsWith("make") ||
    lowercasedName.startsWith("temporary") ||
    lowercasedName.startsWith("capture") ||
    lowercasedName.startsWith("withtemporary") ||
    lowercasedName.startsWith("waitfor") ||
    lowercasedName.startsWith("replace")
  );
}

function isHarnessHelperName(name: string): boolean {
  const lowercasedName = name.toLowerCase();
  return (
    lowercasedName === "lint" ||
    lowercasedName === "maketemporaryrepo" ||
    lowercasedName === "buildprojectcontext" ||
    lowercasedName === "loadsourcefile" ||
    lowercasedName === "makereporelativepath" ||
    lowercasedName.startsWith("collect") ||
    lowercasedName === "hasmodifier" ||
    lowercasedName === "extractedtypenames" ||
    lowercasedName === "isvoidlike" ||
    lowercasedName === "rootbasename"
  );
}

function runtimeBucketForFamily(
  family: RuntimeResponsibilityFamily,
): RuntimeTestBucket {
  switch (family) {
    case RuntimeResponsibilityFamily.Application:
      return RuntimeTestBucket.Application;
    case RuntimeResponsibilityFamily.Infrastructure:
      return RuntimeTestBucket.Infrastructure;
    case RuntimeResponsibilityFamily.Domain:
      return RuntimeTestBucket.Domain;
    case RuntimeResponsibilityFamily.Presentation:
      return RuntimeTestBucket.Presentation;
    case RuntimeResponsibilityFamily.App:
      return RuntimeTestBucket.App;
  }
}

function runtimeBucketSignDescription(bucket: RuntimeTestBucket): string {
  switch (bucket) {
    case RuntimeTestBucket.Application:
      return "application services, use cases, contracts, state, or workflow behavior";
    case RuntimeTestBucket.Infrastructure:
      return "gateways, port adapters, workspace, reload-monitor, transport, or provider boundary behavior";
    case RuntimeTestBucket.Domain:
      return "domain policies or pure domain invariants";
    case RuntimeTestBucket.Presentation:
      return "controllers, DTOs, renderers, presenters, or other presentation seams";
    case RuntimeTestBucket.App:
      return "bootstrap, runtime wiring, dependency-injection, or CLI-surface behavior";
  }
}

function runtimeBucketDecompositionGuidance(bucket: RuntimeTestBucket): string {
  switch (bucket) {
    case RuntimeTestBucket.Application:
      return "keep one responsibility family per file inside Application/, then move shared support to TestDoubles so services, use cases, contracts, and state suites do not stay bundled together.";
    case RuntimeTestBucket.Infrastructure:
      return "separate gateway, port-adapter, workspace, transport, and provider-specific scenarios by file, then move reusable boundary fakes or spies to TestDoubles.";
    case RuntimeTestBucket.Domain:
      return "keep pure policy or invariant coverage in Domain/Policies/, and move any collaborator-driven behavior out toward Application or Infrastructure before migrating the suite.";
    case RuntimeTestBucket.Presentation:
      return "split DTO, controller, renderer, presenter, and other presentation seams into their own files under Presentation/ so each file points at one presentation owner.";
    case RuntimeTestBucket.App:
      return "keep bootstrap or command-surface scenarios in App/, and split out any lower-level Application, Infrastructure, or Presentation behavior that leaked into the same file.";
  }
}

const RUNTIME_BUCKET_ORDER: readonly RuntimeTestBucket[] = [
  RuntimeTestBucket.Application,
  RuntimeTestBucket.Infrastructure,
  RuntimeTestBucket.Domain,
  RuntimeTestBucket.Presentation,
  RuntimeTestBucket.App,
];

const RESPONSIBILITY_FAMILY_ORDER: readonly RuntimeResponsibilityFamily[] = [
  RuntimeResponsibilityFamily.Application,
  RuntimeResponsibilityFamily.Infrastructure,
  RuntimeResponsibilityFamily.Domain,
  RuntimeResponsibilityFamily.Presentation,
  RuntimeResponsibilityFamily.App,
];
