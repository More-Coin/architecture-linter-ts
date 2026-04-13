import test from "node:test";
import assert from "node:assert/strict";

import {
  ApplicationPortProtocolsShapePolicy,
  ApplicationServicesSurfacePolicy,
} from "../../src/Domain/Policies/ApplicationArchitecturePolicies.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";
import type { IndexedDeclaration } from "../../src/Domain/ValueObjects/IndexedDeclaration.ts";

test("service projection pipeline fails when service emits projection contracts through sink port", () => {
  const file = applicationServiceFile({
    storedMembers: [
      {
        enclosingTypeName: "ProjectionService",
        name: "sink",
        typeNames: ["TelemetryPortProtocol"],
        isStatic: false,
        coordinate: coordinate(2),
      },
    ],
    methodDeclarations: [
      {
        enclosingTypeName: "ProjectionService",
        name: "handle",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: ["ExecutionResultContract"],
        hasExplicitReturnType: false,
        returnTypeNames: [],
        returnsVoidLike: true,
        coordinate: coordinate(3),
      },
    ],
    operationalUseOccurrences: [
      {
        enclosingTypeName: "ProjectionService",
        enclosingMethodName: "handle",
        baseName: "LogEventContract",
        memberName: "new",
        coordinate: coordinate(4),
      },
      {
        enclosingTypeName: "ProjectionService",
        enclosingMethodName: "handle",
        baseName: "sink",
        memberName: "emit",
        coordinate: coordinate(5),
      },
    ],
  });

  const diagnostics = new ApplicationServicesSurfacePolicy().evaluate(
    file,
    projectionContext(),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, ApplicationServicesSurfacePolicy.ruleID);
});

test("service using port protocol without projection pipeline passes", () => {
  const file = applicationServiceFile({
    storedMembers: [
      {
        enclosingTypeName: "ProjectionService",
        name: "sink",
        typeNames: ["TelemetryPortProtocol"],
        isStatic: false,
        coordinate: coordinate(2),
      },
    ],
    methodDeclarations: [
      {
        enclosingTypeName: "ProjectionService",
        name: "handle",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: ["ExecutionResultContract"],
        hasExplicitReturnType: false,
        returnTypeNames: [],
        returnsVoidLike: true,
        coordinate: coordinate(3),
      },
    ],
  });

  const diagnostics = new ApplicationServicesSurfacePolicy().evaluate(
    file,
    projectionContext(),
  );

  assert.deepEqual(diagnostics, []);
});

test("nested projection helper fails when it handles source and returns projection contract", () => {
  const file = applicationServiceFile({
    storedMembers: [
      {
        enclosingTypeName: "Projector",
        name: "sink",
        typeNames: ["TelemetryPortProtocol"],
        isStatic: false,
        coordinate: coordinate(21),
      },
    ],
    methodDeclarations: [
      {
        enclosingTypeName: "Projector",
        name: "project",
        isStatic: false,
        isPublicOrOpen: false,
        isPrivateOrFileprivate: true,
        parameterTypeNames: ["ExecutionResultContract"],
        hasExplicitReturnType: true,
        returnTypeDescription: "LogEventContract",
        returnTypeNames: ["LogEventContract"],
        returnsVoidLike: false,
        coordinate: coordinate(22),
      },
    ],
    nestedDeclarations: [
      {
        enclosingTypeName: "ProjectionService",
        name: "Projector",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: ["project"],
        coordinate: coordinate(20),
      },
    ],
  });

  const diagnostics = new ApplicationServicesSurfacePolicy().evaluate(
    file,
    projectionContext(),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.line, 20);
});

test("sink shaped port protocol passes when each method accepts exactly one application contract", () => {
  const file = applicationPortProtocolFile({
    topLevelName: "TelemetryPortProtocol",
    methodDeclarations: [
      {
        enclosingTypeName: "TelemetryPortProtocol",
        name: "emit",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: ["LogEventContract"],
        hasExplicitReturnType: false,
        returnTypeNames: [],
        returnsVoidLike: true,
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new ApplicationPortProtocolsShapePolicy().evaluate(
    file,
    protocolContext([
      {
        returnsVoidLike: true,
        parameterTypeNames: ["LogEventContract"],
      },
    ]),
  );

  assert.deepEqual(diagnostics, []);
});

test("sink shaped port protocol fails when method mixes contract and payload parameters", () => {
  const file = applicationPortProtocolFile({
    topLevelName: "TelemetryPortProtocol",
    methodDeclarations: [
      {
        enclosingTypeName: "TelemetryPortProtocol",
        name: "emit",
        isStatic: false,
        isPublicOrOpen: true,
        isPrivateOrFileprivate: false,
        parameterTypeNames: ["LogEventContract", "Int"],
        hasExplicitReturnType: false,
        returnTypeNames: [],
        returnsVoidLike: true,
        coordinate: coordinate(2),
      },
    ],
  });

  const diagnostics = new ApplicationPortProtocolsShapePolicy().evaluate(
    file,
    protocolContext([
      {
        returnsVoidLike: true,
        parameterTypeNames: ["LogEventContract", "Int"],
      },
    ]),
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    ApplicationPortProtocolsShapePolicy.ruleID,
  );
});

test("protocol with no methods is not treated as sink", () => {
  const file = applicationPortProtocolFile({
    topLevelName: "TelemetryPortProtocol",
    methodDeclarations: [],
  });

  const diagnostics = new ApplicationPortProtocolsShapePolicy().evaluate(
    file,
    protocolContext([]),
  );

  assert.deepEqual(diagnostics, []);
});

function projectionContext(): ProjectContext {
  return new ProjectContext([
    {
      name: "ExecutionResultContract",
      kind: NominalKind.Struct,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath:
        "Symphony/Application/Contracts/Workflow/ExecutionResultContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    },
    {
      name: "LogEventContract",
      kind: NominalKind.Struct,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath:
        "Symphony/Application/Contracts/Workflow/LogEventContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    },
    {
      name: "TelemetryPortProtocol",
      kind: NominalKind.Protocol,
      inheritedTypeNames: [],
      methodShapes: [
        {
          returnsVoidLike: true,
          parameterTypeNames: ["ExecutionResultContract"],
        },
        {
          returnsVoidLike: true,
          parameterTypeNames: ["LogEventContract"],
        },
      ],
      repoRelativePath:
        "Symphony/Application/Ports/Protocols/Telemetry/TelemetryPortProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    },
  ]);
}

function protocolContext(
  methodShapes: IndexedDeclaration["methodShapes"],
): ProjectContext {
  return new ProjectContext([
    {
      name: "LogEventContract",
      kind: NominalKind.Struct,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath:
        "Symphony/Application/Contracts/Workflow/LogEventContract.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationContractsWorkflow,
    },
    {
      name: "TelemetryPortProtocol",
      kind: NominalKind.Protocol,
      inheritedTypeNames: [],
      methodShapes,
      repoRelativePath:
        "Symphony/Application/Ports/Protocols/Telemetry/TelemetryPortProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    },
  ]);
}

function applicationServiceFile(input: {
  readonly storedMembers?: ConstructorParameters<typeof ArchitectureFile>[0]["storedMemberDeclarations"];
  readonly methodDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["methodDeclarations"];
  readonly operationalUseOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["operationalUseOccurrences"];
  readonly nestedDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["nestedNominalDeclarations"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: "Symphony/Application/Services/ProjectionService.ts",
    classification: new FileClassification({
      repoRelativePath: "Symphony/Application/Services/ProjectionService.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationServices,
      pathComponents: [
        "Symphony",
        "Application",
        "Services",
        "ProjectionService.ts",
      ],
      fileName: "ProjectionService.ts",
      fileStem: "ProjectionService",
    }),
    imports: [],
    functionTypeOccurrences: [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: input.methodDeclarations ?? [],
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: input.storedMembers ?? [],
    operationalUseOccurrences: input.operationalUseOccurrences ?? [],
    typeReferences: [],
    topLevelDeclarations: [
      {
        name: "ProjectionService",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: ["handle"],
        coordinate: coordinate(1),
      },
    ],
    nestedNominalDeclarations: input.nestedDeclarations ?? [],
  });
}

function applicationPortProtocolFile(input: {
  readonly topLevelName: string;
  readonly methodDeclarations: ConstructorParameters<typeof ArchitectureFile>[0]["methodDeclarations"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath:
      "Symphony/Application/Ports/Protocols/Telemetry/TelemetryPortProtocol.ts",
    classification: new FileClassification({
      repoRelativePath:
        "Symphony/Application/Ports/Protocols/Telemetry/TelemetryPortProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
      pathComponents: [
        "Symphony",
        "Application",
        "Ports",
        "Protocols",
        "Telemetry",
        "TelemetryPortProtocol.ts",
      ],
      fileName: "TelemetryPortProtocol.ts",
      fileStem: "TelemetryPortProtocol",
    }),
    imports: [],
    functionTypeOccurrences: [],
    identifierOccurrences: [],
    stringLiteralOccurrences: [],
    typedMemberOccurrences: [],
    memberCallOccurrences: [],
    methodDeclarations: input.methodDeclarations,
    constructorDeclarations: [],
    computedPropertyDeclarations: [],
    storedMemberDeclarations: [],
    operationalUseOccurrences: [],
    typeReferences: [],
    topLevelDeclarations: [
      {
        name: input.topLevelName,
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: input.methodDeclarations.map((declaration) => declaration.name),
        coordinate: coordinate(1),
      },
    ],
    nestedNominalDeclarations: [],
  });
}

function coordinate(line: number) {
  return { line, column: 1 } as const;
}
