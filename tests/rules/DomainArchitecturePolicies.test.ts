import test from "node:test";
import assert from "node:assert/strict";

import {
  DomainDurableStructurePolicy,
  DomainErrorsPlacementPolicy,
  DomainErrorsShapePolicy,
  DomainForbiddenImportPolicy,
  RepositoryProtocolPlacementPolicy,
} from "../../src/Domain/Policies/DomainArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("domain forbidden import policy flags framework imports", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderPolicy.ts",
    roleFolder: RoleFolder.DomainPolicies,
    imports: [{ moduleName: "node:fs", coordinate: coordinate(1) }],
    topLevelDeclarations: [
      {
        name: "OrderPolicy",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new DomainForbiddenImportPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainForbiddenImportPolicy.ruleID);
});

test("domain durable structure policy flags unsupported domain subfolders", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Services/OrderPolicy.ts",
    roleFolder: RoleFolder.None,
    topLevelDeclarations: [
      {
        name: "OrderPolicy",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new DomainDurableStructurePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainDurableStructurePolicy.ruleID);
});

test("domain errors shape policy requires StructuredErrorProtocol and required members", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Errors/OrderError.ts",
    roleFolder: RoleFolder.DomainErrors,
    topLevelDeclarations: [
      {
        name: "OrderError",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: ["code", "message"],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new DomainErrorsShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, DomainErrorsShapePolicy.ruleID);
  assert.equal(diagnostics[1]?.ruleID, DomainErrorsShapePolicy.ruleID);
});

test("domain errors placement policy flags structured errors outside Domain/Errors", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Domain/Policies/OrderError.ts",
    roleFolder: RoleFolder.DomainPolicies,
    topLevelDeclarations: [
      {
        name: "OrderError",
        kind: NominalKind.Struct,
        inheritedTypeNames: ["StructuredErrorProtocol"],
        memberNames: ["code", "message", "retryable", "details"],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new DomainErrorsPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, DomainErrorsPlacementPolicy.ruleID);
});

test("repository protocol placement flags repository protocols outside Domain/Protocols", () => {
  const file = makeFile({
    repoRelativePath: "Symphony/Application/Ports/Protocols/OrderRepositoryProtocol.ts",
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationPortsProtocols,
    topLevelDeclarations: [
      {
        name: "OrderRepositoryProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(1),
      },
    ],
  });

  const diagnostics = new RepositoryProtocolPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, RepositoryProtocolPlacementPolicy.ruleID);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer?: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly imports?: ConstructorParameters<typeof ArchitectureFile>[0]["imports"];
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer ?? ArchitectureLayer.Domain,
      roleFolder: input.roleFolder,
      pathComponents: input.repoRelativePath.split("/"),
      fileName: input.repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
    }),
    imports: input.imports ?? [],
    functionTypeOccurrences: [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    nestedNominalDeclarations: [],
  });
}

function coordinate(line: number) {
  return { line, column: 1 } as const;
}
