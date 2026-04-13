import test from "node:test";
import assert from "node:assert/strict";

import {
  PresentationControllerShapePolicy,
  PresentationControllersFunctionSeamPolicy,
  PresentationControllersUseCaseReferencePolicy,
  PresentationDTOsShapePolicy,
  PresentationErrorsPlacementPolicy,
  PresentationInfrastructureReferencePolicy,
  makePresentationArchitecturePolicies,
} from "../../src/Domain/Policies/PresentationArchitecturePolicies.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("presentation controller shape flags controller files without a controller type", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderHandler.ts",
    roleFolder: RoleFolder.PresentationControllers,
    topLevelDeclarations: [
      {
        name: "OrderHandler",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new PresentationControllerShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, PresentationControllerShapePolicy.ruleID);
});

test("presentation controllers use case reference flags direct use case dependencies", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    typeReferences: [{ name: "FetchOrderUseCase", coordinate: coordinate(7) }],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "FetchOrderUseCase",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationUseCases,
      repoRelativePath:
        "Symphony/Application/UseCases/FetchOrderUseCase.ts",
    }),
  ]);

  const diagnostics = new PresentationControllersUseCaseReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationControllersUseCaseReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 7);
});

test("presentation controllers function seam flags closure-based workflow seams", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderController.ts",
    roleFolder: RoleFolder.PresentationControllers,
    functionTypeOccurrences: [{ coordinate: coordinate(11) }],
  });

  const diagnostics = new PresentationControllersFunctionSeamPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationControllersFunctionSeamPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 11);
});

test("presentation DTO shape flags behavioral and misnamed DTO declarations", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/DTOs/OrderPayload.ts",
    roleFolder: RoleFolder.PresentationDTOs,
    topLevelDeclarations: [
      {
        name: "OrderPayload",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(3),
      },
    ],
  });

  const diagnostics = new PresentationDTOsShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, PresentationDTOsShapePolicy.ruleID);
  assert.equal(diagnostics[1]?.ruleID, PresentationDTOsShapePolicy.ruleID);
});

test("presentation errors placement flags presentation errors outside Presentation/Errors", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/Controllers/OrderPresentationError.ts",
    roleFolder: RoleFolder.PresentationControllers,
    topLevelDeclarations: [
      {
        name: "OrderPresentationError",
        kind: NominalKind.Enum,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: coordinate(5),
      },
    ],
  });

  const diagnostics = new PresentationErrorsPlacementPolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationErrorsPlacementPolicy.ruleID,
  );
});

test("presentation infrastructure reference flags direct infrastructure dependencies once per type", () => {
  const file = makeFile({
    repoRelativePath:
      "Symphony/Presentation/ViewModels/OrderViewModel.ts",
    roleFolder: RoleFolder.PresentationViewModels,
    typeReferences: [
      { name: "OrderGateway", coordinate: coordinate(9) },
      { name: "OrderGateway", coordinate: coordinate(12) },
    ],
  });
  const context = new ProjectContext([
    indexedDeclaration({
      name: "OrderGateway",
      layer: ArchitectureLayer.Infrastructure,
      roleFolder: RoleFolder.InfrastructureGateways,
      repoRelativePath:
        "Symphony/Infrastructure/Gateways/OrderGateway.ts",
    }),
  ]);

  const diagnostics = new PresentationInfrastructureReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    PresentationInfrastructureReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 9);
});

test("makePresentationArchitecturePolicies returns the full presentation rule set", () => {
  assert.equal(makePresentationArchitecturePolicies().length, 15);
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly roleFolder: RoleFolder;
  readonly layer?: ArchitectureLayer;
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
  readonly typeReferences?: ConstructorParameters<typeof ArchitectureFile>[0]["typeReferences"];
  readonly functionTypeOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["functionTypeOccurrences"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer ?? ArchitectureLayer.Presentation,
      roleFolder: input.roleFolder,
      pathComponents: input.repoRelativePath.split("/"),
      fileName: input.repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
    }),
    imports: [],
    functionTypeOccurrences: input.functionTypeOccurrences ?? [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: input.typeReferences ?? [],
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    nestedNominalDeclarations: [],
  });
}

function indexedDeclaration(input: {
  readonly name: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly repoRelativePath: string;
}) {
  return {
    name: input.name,
    kind: NominalKind.Struct,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: input.repoRelativePath,
    layer: input.layer,
    roleFolder: input.roleFolder,
  } as const;
}

function coordinate(line: number) {
  return { line, column: 1 } as const;
}
