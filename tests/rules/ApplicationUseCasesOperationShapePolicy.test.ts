import test from "node:test";
import assert from "node:assert/strict";

import { ApplicationUseCasesOperationShapePolicy } from "../../src/domain/policies/ApplicationArchitecturePolicies.ts";
import { ProjectContext } from "../../src/domain/value-objects/ProjectContext.ts";
import { ArchitectureFile } from "../../src/domain/value-objects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/domain/value-objects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/domain/value-objects/FileClassification.ts";
import { NominalKind } from "../../src/domain/value-objects/NominalKind.ts";
import { RoleFolder } from "../../src/domain/value-objects/RoleFolder.ts";
import type { IndexedDeclaration } from "../../src/domain/value-objects/IndexedDeclaration.ts";

test("use case returning application contract counts as operation surface", () => {
  const diagnostics = new ApplicationUseCasesOperationShapePolicy().evaluate(
    useCaseFile("ProcessOrderResultContract"),
    useCaseContext(applicationWorkflowContract("ProcessOrderResultContract")),
  );

  assert.deepEqual(diagnostics, []);
});

test("use case returning domain entity counts as operation surface", () => {
  const diagnostics = new ApplicationUseCasesOperationShapePolicy().evaluate(
    useCaseFile("Order"),
    useCaseContext(domainEntity("Order")),
  );

  assert.deepEqual(diagnostics, []);
});

test("use case returning non-entity domain type fails operation surface", () => {
  const diagnostics = new ApplicationUseCasesOperationShapePolicy().evaluate(
    useCaseFile("OrderPolicy"),
    useCaseContext(domainPolicy("OrderPolicy")),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    ApplicationUseCasesOperationShapePolicy.ruleID,
  );
});

function useCaseContext(resultDeclaration: IndexedDeclaration): ProjectContext {
  return new ProjectContext([resultDeclaration]);
}

function useCaseFile(returnTypeName: string): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: "Symphony/Application/UseCases/ProcessOrderUseCase.ts",
    classification: new FileClassification({
      repoRelativePath: "Symphony/Application/UseCases/ProcessOrderUseCase.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
      pathComponents: [
        "Symphony",
        "Application",
        "UseCases",
        "ProcessOrderUseCase.ts",
      ],
      fileName: "ProcessOrderUseCase.ts",
      fileStem: "ProcessOrderUseCase",
    }),
    imports: [],
    functionTypeOccurrences: [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: [
      {
        enclosingTypeName: "ProcessOrderUseCase",
        name: "execute",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: [],
        hasExplicitReturnType: true,
        returnTypeDescription: returnTypeName,
        returnTypeNames: [returnTypeName],
        returnsVoidLike: false,
        coordinate: coordinate(2),
      },
    ],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: [],
    topLevelDeclarations: [
      {
        name: "ProcessOrderUseCase",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: ["execute"],
        coordinate: coordinate(1),
      },
    ],
    nestedNominalDeclarations: [],
  });
}

function applicationWorkflowContract(name: string): IndexedDeclaration {
  return {
    name,
    kind: NominalKind.Struct,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: `Symphony/Application/Contracts/Workflow/${name}.ts`,
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationContractsWorkflow,
  };
}

function domainEntity(name: string): IndexedDeclaration {
  return {
    name,
    kind: NominalKind.Struct,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: `Symphony/Domain/Entities/${name}.ts`,
    layer: ArchitectureLayer.Domain,
    roleFolder: RoleFolder.None,
  };
}

function domainPolicy(name: string): IndexedDeclaration {
  return {
    name,
    kind: NominalKind.Struct,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: `Symphony/Domain/Policies/${name}.ts`,
    layer: ArchitectureLayer.Domain,
    roleFolder: RoleFolder.DomainPolicies,
  };
}

function coordinate(line: number) {
  return { line, column: 1 } as const;
}
