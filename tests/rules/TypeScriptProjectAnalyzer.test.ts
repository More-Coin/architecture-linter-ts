import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { ArchitectureLinter } from "../../src/App/dependency-injection/ArchitectureLinter.ts";
import {
  ApplicationUseCasesAbstractionDelegationPolicy,
} from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import {
  PresentationControllersFunctionSeamPolicy,
  PresentationControllersUseCaseReferencePolicy,
  PresentationInfrastructureReferencePolicy,
  PresentationViewsShapePolicy,
} from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
import { SourceFileDiscoveryGateway } from "../../src/Infrastructure/gateways/SourceFileDiscoveryGateway.ts";
import { TypeScriptProjectPortAdapter } from "../../src/Infrastructure/port-adapters/TypeScriptProjectPortAdapter.ts";

const fixtureRootPath = path.resolve(
  "tests/fixtures/type-script-lint-project",
);
const fixtureRootURL = pathToFileURL(`${fixtureRootPath}/`);

test("default configuration and discovery include TSX source files", () => {
  assert.deepEqual(
    DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION.sourceExtensions,
    [".ts", ".tsx"],
  );

  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(rootPath, "App/main.ts", "export const main = true;\n");
    writeProjectFile(
      rootPath,
      "Presentation/Views/OrderView.tsx",
      "export function OrderView() { return <div />; }\n",
    );
    writeProjectFile(
      rootPath,
      "Presentation/Views/GeneratedTypes.d.ts",
      "export interface GeneratedTypes {}\n",
    );

    const sourceFilePaths = new SourceFileDiscoveryGateway()
      .discoverSourceFiles(rootURL)
      .map((fileURL) =>
        path
          .relative(rootPath, fileURLToPath(fileURL))
          .split(path.sep)
          .join("/"),
      );

    assert.deepEqual(sourceFilePaths, [
      "App/main.ts",
      "Presentation/Views/OrderView.tsx",
    ]);
  });
});

test("ts-morph analyzer extracts constructors, parameter properties, and helper-mediated dependency calls", () => {
  const configuration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
  const discovery = new SourceFileDiscoveryGateway(configuration.sourceExtensions);
  const fileURLs = discovery.discoverSourceFiles(fixtureRootURL);
  const files = new TypeScriptProjectPortAdapter(configuration).analyzeProject(
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

test("ts-morph analyzer extracts TSX top-level value declarations without a tsconfig", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "Presentation/Views/OrderView.tsx",
      [
        "export function OrderView() { return <div />; }",
        "export const OrderSummaryView = () => <section />;",
        "export default function DefaultOrderView() { return <main />; }",
        "const InternalView = () => <aside />;",
        "",
      ].join("\n"),
    );
    writeProjectFile(
      rootPath,
      "Presentation/Views/AnonymousView.tsx",
      "export default () => <div />;\n",
    );

    const configuration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
    const fileURLs = new SourceFileDiscoveryGateway()
      .discoverSourceFiles(rootURL);
    const files = new TypeScriptProjectPortAdapter(configuration).analyzeProject(
      rootURL,
      fileURLs,
    );
    const orderViewFile = files.find((file) =>
      file.repoRelativePath.endsWith("Presentation/Views/OrderView.tsx"),
    );
    const anonymousViewFile = files.find((file) =>
      file.repoRelativePath.endsWith("Presentation/Views/AnonymousView.tsx"),
    );

    assert.ok(orderViewFile);
    assert.deepEqual(
      orderViewFile?.topLevelValueDeclarations.map((declaration) => ({
        name: declaration.name,
        kind: declaration.kind,
        isExported: declaration.isExported,
      })),
      [
        { name: "OrderView", kind: "function", isExported: true },
        { name: "OrderSummaryView", kind: "const", isExported: true },
        { name: "DefaultOrderView", kind: "function", isExported: true },
        { name: "InternalView", kind: "const", isExported: false },
      ],
    );
    assert.deepEqual(anonymousViewFile?.topLevelValueDeclarations, []);
  });
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

test("linter end-to-end evaluates architecture rules inside TSX view files", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Infrastructure/Gateways/OrderGateway.ts",
      "export class OrderGateway {}\n",
    );
    writeProjectFile(
      rootPath,
      "src/Presentation/Views/OrderView.tsx",
      [
        'import type { OrderGateway } from "../../Infrastructure/Gateways/OrderGateway.ts";',
        "export function OrderView(props: { gateway: OrderGateway }) {",
        "  return <div>{String(props.gateway)}</div>;",
        "}",
        "",
      ].join("\n"),
    );

    const linter = new ArchitectureLinter({
      configuration: DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      policies: [
        new PresentationViewsShapePolicy(),
        new PresentationInfrastructureReferencePolicy(),
      ],
    });
    const result = linter.lintProject(rootURL);
    const viewShapeDiagnostics = result.diagnostics.filter(
      (diagnostic) =>
        diagnostic.ruleID === PresentationViewsShapePolicy.ruleID &&
        diagnostic.path === "src/Presentation/Views/OrderView.tsx",
    );
    const infrastructureDiagnostic = result.diagnostics.find(
      (diagnostic) =>
        diagnostic.ruleID === PresentationInfrastructureReferencePolicy.ruleID &&
        diagnostic.path === "src/Presentation/Views/OrderView.tsx",
    );

    assert.deepEqual(viewShapeDiagnostics, []);
    assert.ok(infrastructureDiagnostic);
  });
});

test("linter end-to-end flags a misnamed TSX presentation view", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Presentation/Views/OrderScreen.tsx",
      [
        "export const OrderScreen = () => {",
        "  return <div />;",
        "};",
        "",
      ].join("\n"),
    );

    const linter = new ArchitectureLinter({
      configuration: DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      policies: [new PresentationViewsShapePolicy()],
    });
    const result = linter.lintProject(rootURL);
    const diagnostic = result.diagnostics.find(
      (candidate) =>
        candidate.ruleID === PresentationViewsShapePolicy.ruleID &&
        candidate.path === "src/Presentation/Views/OrderScreen.tsx",
    );

    assert.ok(diagnostic);
    assert.equal(diagnostic.line, 1);
  });
});

test("linter end-to-end flags direct use case references inside TSX controllers", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Application/UseCases/FetchOrderUseCase.ts",
      "export class FetchOrderUseCase {}\n",
    );
    writeProjectFile(
      rootPath,
      "src/Presentation/Controllers/OrderController.tsx",
      [
        'import type { FetchOrderUseCase } from "../../Application/UseCases/FetchOrderUseCase.ts";',
        "export function OrderController(props: { useCase: FetchOrderUseCase }) {",
        "  return <button>{String(props.useCase)}</button>;",
        "}",
        "",
      ].join("\n"),
    );

    const linter = new ArchitectureLinter({
      configuration: DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      policies: [new PresentationControllersUseCaseReferencePolicy()],
    });
    const result = linter.lintProject(rootURL);
    const diagnostic = result.diagnostics.find(
      (candidate) =>
        candidate.ruleID === PresentationControllersUseCaseReferencePolicy.ruleID &&
        candidate.path === "src/Presentation/Controllers/OrderController.tsx",
    );

    assert.ok(diagnostic);
    assert.equal(diagnostic.line, 2);
  });
});

test("linter end-to-end flags function seams inside TSX controllers", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Presentation/Controllers/OrderController.tsx",
      [
        "type OrderControllerProps = {",
        "  onFetch: () => void;",
        "};",
        "export function OrderController(props: OrderControllerProps) {",
        "  return <button onClick={props.onFetch}>Fetch</button>;",
        "}",
        "",
      ].join("\n"),
    );

    const linter = new ArchitectureLinter({
      configuration: DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
      policies: [new PresentationControllersFunctionSeamPolicy()],
    });
    const result = linter.lintProject(rootURL);
    const diagnostic = result.diagnostics.find(
      (candidate) =>
        candidate.ruleID === PresentationControllersFunctionSeamPolicy.ruleID &&
        candidate.path === "src/Presentation/Controllers/OrderController.tsx",
    );

    assert.ok(diagnostic);
    assert.equal(diagnostic.line, 2);
  });
});

function withTemporaryProject(
  run: (rootPath: string, rootURL: URL) => void,
): void {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "arch-lint-tsx-"));

  try {
    run(rootPath, pathToFileURL(`${rootPath}/`));
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
}

function writeProjectFile(
  rootPath: string,
  repoRelativePath: string,
  contents: string,
): void {
  const filePath = path.join(rootPath, repoRelativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}
