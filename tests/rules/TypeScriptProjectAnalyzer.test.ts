import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { ArchitectureLinter } from "../../src/App/dependency-injection/ArchitectureLinter.ts";
import {
  ApplicationUseCasesAbstractionDelegationPolicy,
} from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import { PresentationControllersUseCaseReferencePolicy } from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
import { SourceFileDiscoveryGateway } from "../../src/Infrastructure/gateways/SourceFileDiscoveryGateway.ts";
import { TypeScriptProjectAnalyzer } from "../../src/Infrastructure/analyzers/TypeScriptProjectAnalyzer.ts";

const fixtureRootPath = path.resolve(
  "tests/fixtures/type-script-lint-project",
);
const fixtureRootURL = pathToFileURL(`${fixtureRootPath}/`);

test("ts-morph analyzer extracts constructors, parameter properties, and helper-mediated dependency calls", () => {
  const configuration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
  const discovery = new SourceFileDiscoveryGateway(configuration.sourceExtensions);
  const fileURLs = discovery.discoverSourceFiles(fixtureRootURL);
  const files = new TypeScriptProjectAnalyzer(configuration).analyzeProject(
    fixtureRootURL,
    fileURLs,
  );

  const useCaseFile = files.find((file) =>
    file.repoRelativePath.endsWith("Application/UseCases/FetchOrderUseCase.ts"),
  );

  assert.ok(useCaseFile);
  assert.equal(useCaseFile?.constructorDeclarations.length, 1);
  assert.deepEqual(
    useCaseFile?.storedMemberDeclarations.map((declaration) => declaration.name),
    ["ordersRepository"],
  );
  assert.deepEqual(
    useCaseFile?.methodDeclarations.map((declaration) => declaration.name).sort(),
    ["execute", "load"],
  );
  assert.equal(
    useCaseFile?.operationalUseOccurrences.some(
      (occurrence) =>
        occurrence.enclosingMethodName === "load" &&
        occurrence.baseName === "ordersRepository" &&
        occurrence.memberName === "fetch",
    ),
    true,
  );
  assert.equal(
    useCaseFile?.operationalUseOccurrences.some(
      (occurrence) =>
        occurrence.enclosingMethodName === "execute" &&
        occurrence.baseName === "load" &&
        occurrence.memberName === "load",
    ),
    true,
  );
});

test("linter end-to-end flags a presentation controller that depends directly on a use case", () => {
  const linter = new ArchitectureLinter({
    configuration: DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
    policies: [
      new PresentationControllersUseCaseReferencePolicy(),
      new ApplicationUseCasesAbstractionDelegationPolicy(),
    ],
  });

  const result = linter.lintProject(fixtureRootURL);
  const presentationDiagnostic = result.diagnostics.find((diagnostic) =>
    diagnostic.ruleID === PresentationControllersUseCaseReferencePolicy.ruleID,
  );
  const useCaseDiagnostic = result.diagnostics.find((diagnostic) =>
    diagnostic.ruleID === ApplicationUseCasesAbstractionDelegationPolicy.ruleID,
  );

  assert.ok(presentationDiagnostic);
  assert.equal(
    presentationDiagnostic?.path,
    "src/Presentation/Controllers/OrderController.ts",
  );
  assert.ok(useCaseDiagnostic);
  assert.equal(
    useCaseDiagnostic?.path,
    "src/Application/UseCases/FetchOrderUseCase.ts",
  );
});
