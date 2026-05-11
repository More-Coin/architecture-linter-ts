import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { SourceFileDiscoveryGateway } from "../../src/Infrastructure/gateways/SourceFileDiscoveryGateway.ts";
import { TypeScriptProjectPortAdapter } from "../../src/Infrastructure/port-adapters/TypeScriptProjectPortAdapter.ts";

test("ts-morph analyzer collects every NewExpression as a construction occurrence", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Application/services/OrderService.ts",
      [
        "export class FetchOrderUseCase {}",
        "export class OrderService {",
        "  run(): FetchOrderUseCase {",
        "    return new FetchOrderUseCase();",
        "  }",
        "  static factory(): OrderService {",
        "    const helper = new FetchOrderUseCase();",
        "    return new OrderService();",
        "  }",
        "}",
        "export const topLevel = new FetchOrderUseCase();",
        "",
      ].join("\n"),
    );

    const file = analyzeOne(rootURL, "src/Application/services/OrderService.ts");
    const typeNames = file.constructionOccurrences
      .map((occurrence) => occurrence.typeName)
      .sort();

    assert.deepEqual(typeNames, [
      "FetchOrderUseCase",
      "FetchOrderUseCase",
      "FetchOrderUseCase",
      "OrderService",
    ]);

    const useCaseOccurrence = file.constructionOccurrences.find(
      (occurrence) => occurrence.typeName === "FetchOrderUseCase",
    );
    assert.ok(useCaseOccurrence);
    assert.ok(useCaseOccurrence.coordinate.line >= 1);
    assert.ok(useCaseOccurrence.coordinate.column >= 1);
  });
});

test("ts-morph analyzer collects non-call PropertyAccessExpression as static-member access", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Application/services/OrderService.ts",
      [
        "declare const Container: { resolve(): unknown; shared: unknown };",
        "declare const Foo: { live: unknown };",
        "export class OrderService {",
        "  run(): void {",
        "    const a = Container.shared;",
        "    const b = Foo.live;",
        "    Container.resolve();", // call form — should NOT appear in static-access
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const file = analyzeOne(rootURL, "src/Application/services/OrderService.ts");
    const pairs = file.staticMemberAccessOccurrences
      .map((occurrence) => `${occurrence.baseName}.${occurrence.memberName}`)
      .sort();

    assert.ok(
      pairs.includes("Container.shared"),
      `expected Container.shared in ${JSON.stringify(pairs)}`,
    );
    assert.ok(
      pairs.includes("Foo.live"),
      `expected Foo.live in ${JSON.stringify(pairs)}`,
    );
    assert.ok(
      !pairs.includes("Container.resolve"),
      "Container.resolve is a call expression and must not be in staticMemberAccessOccurrences",
    );
  });
});

test("ts-morph analyzer skips lowercase-base property accesses for static-member surface", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Application/services/OrderService.ts",
      [
        "declare const container: { shared: unknown };",
        "export class OrderService {",
        "  run(): void {",
        "    const a = container.shared;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const file = analyzeOne(rootURL, "src/Application/services/OrderService.ts");
    const lowercaseAccesses = file.staticMemberAccessOccurrences.filter(
      (occurrence) => occurrence.baseName === "container",
    );

    assert.equal(lowercaseAccesses.length, 0);
  });
});

test("ts-morph analyzer collects decorators by trailing identifier", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Application/services/OrderService.ts",
      [
        "declare function Inject(target: unknown): unknown;",
        "declare function Injected(target: unknown): unknown;",
        "declare const di: { Dependency(target: unknown): unknown };",
        "@Inject",
        "export class OrderService {",
        "  @Injected",
        "  helper?: unknown;",
        "  @di.Dependency",
        "  build(): void {}",
        "}",
        "",
      ].join("\n"),
    );

    const file = analyzeOne(rootURL, "src/Application/services/OrderService.ts");
    const names = file.decoratorOccurrences
      .map((occurrence) => occurrence.name)
      .sort();

    assert.deepEqual(names, ["Dependency", "Inject", "Injected"]);
  });
});

test("ts-morph analyzer composes dependencyResolutionOccurrences from calls, accesses, and decorators", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Application/services/OrderService.ts",
      [
        "declare const Container: { resolve(name: string): unknown };",
        "declare const OrderRepository: { shared: unknown };",
        "declare function Inject(target: unknown): unknown;",
        "@Inject",
        "export class OrderService {",
        "  run(): void {",
        "    const a = Container.resolve('x');", // member-call DI
        "    const b = OrderRepository.shared;", // static-member-access DI (suffix-matched base)
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const file = analyzeOne(rootURL, "src/Application/services/OrderService.ts");
    const dependencyPairs = file.dependencyResolutionOccurrences
      .map(
        (occurrence) =>
          `${occurrence.baseName}${occurrence.memberName ? `.${occurrence.memberName}` : ""}`,
      )
      .sort();

    assert.ok(
      dependencyPairs.includes("Container.resolve"),
      `expected Container.resolve in ${JSON.stringify(dependencyPairs)}`,
    );
    assert.ok(
      dependencyPairs.includes("OrderRepository.shared"),
      `expected OrderRepository.shared in ${JSON.stringify(dependencyPairs)}`,
    );
    assert.ok(
      dependencyPairs.includes("Inject"),
      `expected Inject decorator in ${JSON.stringify(dependencyPairs)}`,
    );
  });
});

test("ts-morph analyzer skips non-DI accesses on capitalized identifiers", () => {
  withTemporaryProject((rootPath, rootURL) => {
    writeProjectFile(
      rootPath,
      "src/Application/services/OrderService.ts",
      [
        "declare const Greeting: { value: string };",
        "export class OrderService {",
        "  run(): void {",
        "    const a = Greeting.value;",
        "  }",
        "}",
        "",
      ].join("\n"),
    );

    const file = analyzeOne(rootURL, "src/Application/services/OrderService.ts");
    const di = file.dependencyResolutionOccurrences;

    assert.equal(di.length, 0);
  });
});

function analyzeOne(rootURL: URL, repoRelativePath: string) {
  const configuration = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
  const discovery = new SourceFileDiscoveryGateway(configuration.sourceExtensions);
  const fileURLs = discovery.discoverSourceFiles(rootURL);
  const files = new TypeScriptProjectPortAdapter(configuration).analyzeProject(
    rootURL,
    fileURLs,
  );
  const file = files.find((candidate) => candidate.repoRelativePath === repoRelativePath);
  assert.ok(file, `expected to find analyzed file at ${repoRelativePath}`);
  return file;
}

function withTemporaryProject(
  run: (rootPath: string, rootURL: URL) => void,
): void {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "arch-lint-stage2-"));

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
