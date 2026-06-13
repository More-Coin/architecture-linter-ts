import test from "node:test";
import assert from "node:assert/strict";

import {
  AppApplicationBoundaryOperationPolicy,
  AppMultiServiceOrchestrationPolicy,
  AppPortProtocolConformancePolicy,
  AppConfigurationShapePolicy,
  AppDependencyInjectionShapePolicy,
  AppRuntimeShapePolicy,
  CompositionRootInwardReferencePolicy,
  makeAppCompositionPolicies,
} from "../../src/Domain/Policies/AppCompositionPolicies.ts";
import { DefaultArchitecturePolicies } from "../../src/Domain/Policies/DefaultArchitecturePolicies.ts";
import { ProjectContext } from "../../src/Domain/ValueObjects/ProjectContext.ts";
import { ArchitectureFile } from "../../src/Domain/ValueObjects/ArchitectureFile.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { FileClassification } from "../../src/Domain/ValueObjects/FileClassification.ts";
import { NominalKind } from "../../src/Domain/ValueObjects/NominalKind.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("AppConfigurationShapePolicy flags protocol declarations in App/Configuration", () => {
  const file = makeFile({
    repoRelativePath: "src/app/configuration/BadConfig.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppConfiguration,
    topLevelDeclarations: [
      {
        name: "ConfigurationLoaderProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 4, column: 1 },
      },
    ],
  });

  const diagnostics = new AppConfigurationShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0]?.ruleID, AppConfigurationShapePolicy.ruleID);
  assert.match(diagnostics[0]?.message ?? "", /declares protocol/);
  assert.match(diagnostics[1]?.message ?? "", /exposes no concrete type ending in 'Configuration'/);
});

test("AppRuntimeShapePolicy ignores files outside App/Runtime", () => {
  const file = makeFile({
    repoRelativePath: "src/app/configuration/ArchitectureLinterConfiguration.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppConfiguration,
    topLevelDeclarations: [
      {
        name: "ArchitectureLinterConfiguration",
        kind: NominalKind.Struct,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 1, column: 1 },
      },
    ],
  });

  const diagnostics = new AppRuntimeShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.deepEqual(diagnostics, []);
});

test("AppDependencyInjectionShapePolicy requires a DI suffix", () => {
  const file = makeFile({
    repoRelativePath: "src/app/dependency-injection/ArchitectureLinter.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppDependencyInjection,
    topLevelDeclarations: [
      {
        name: "ArchitectureLinter",
        kind: NominalKind.Class,
        inheritedTypeNames: [],
        memberNames: [],
        coordinate: { line: 3, column: 1 },
      },
    ],
  });

  const diagnostics = new AppDependencyInjectionShapePolicy().evaluate(
    file,
    new ProjectContext([]),
  );

  assert.equal(diagnostics.length, 2);
  assert.match(diagnostics[0]?.message ?? "", /does not end in 'DI'/);
  assert.match(diagnostics[1]?.message ?? "", /exposes no concrete type ending in 'DI'/);
});

test("CompositionRootInwardReferencePolicy flags app-layer references from presentation once per type", () => {
  const file = makeFile({
    repoRelativePath: "src/presentation/controllers/ArchitectureLinterController.ts",
    layer: ArchitectureLayer.Presentation,
    roleFolder: RoleFolder.PresentationControllers,
    typeReferences: [
      { name: "ArchitectureLinterDI", coordinate: { line: 7, column: 10 } },
      { name: "ArchitectureLinterDI", coordinate: { line: 10, column: 2 } },
    ],
  });
  const context = new ProjectContext([
    {
      name: "ArchitectureLinterDI",
      kind: NominalKind.Class,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/app/dependency-injection/ArchitectureLinterDI.ts",
      layer: ArchitectureLayer.App,
      roleFolder: RoleFolder.AppDependencyInjection,
    },
  ]);

  const diagnostics = new CompositionRootInwardReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    CompositionRootInwardReferencePolicy.ruleID,
  );
  assert.match(
    diagnostics[0]?.message ?? "",
    /must not be referenced from presentation/,
  );
  assert.equal(diagnostics[0]?.line, 7);
});

test("app.inward_reference flags ambiguous same-name app declarations", () => {
  const file = makeFile({
    repoRelativePath: "src/presentation/controllers/ArchitectureLinterController.ts",
    layer: ArchitectureLayer.Presentation,
    roleFolder: RoleFolder.PresentationControllers,
    typeReferences: [
      { name: "RuntimeBootstrap", coordinate: { line: 9, column: 14 } },
    ],
  });
  const context = new ProjectContext([
    {
      name: "RuntimeBootstrap",
      kind: NominalKind.Class,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/presentation/controllers/RuntimeBootstrap.ts",
      layer: ArchitectureLayer.Presentation,
      roleFolder: RoleFolder.PresentationControllers,
    },
    {
      name: "RuntimeBootstrap",
      kind: NominalKind.Class,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/app/runtime/RuntimeBootstrap.ts",
      layer: ArchitectureLayer.App,
      roleFolder: RoleFolder.AppRuntime,
    },
  ]);

  const diagnostics = new CompositionRootInwardReferencePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    CompositionRootInwardReferencePolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 9);
  assert.match(diagnostics[0]?.message ?? "", /composition-root type/);
});

test("AppPortProtocolConformancePolicy flags App classes implementing Application port protocols", () => {
  const file = makeFile({
    repoRelativePath: "src/app/dependency-injection/OrdersDI.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppDependencyInjection,
    topLevelDeclarations: [
      {
        name: "OrdersDI",
        kind: NominalKind.Class,
        inheritedTypeNames: ["OrdersRepositoryProtocol"],
        memberNames: [],
        coordinate: { line: 5, column: 14 },
      },
    ],
  });
  const context = new ProjectContext([
    {
      name: "OrdersRepositoryProtocol",
      kind: NominalKind.Protocol,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/application/ports/protocols/OrdersRepositoryProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    },
  ]);

  const diagnostics = new AppPortProtocolConformancePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, AppPortProtocolConformancePolicy.ruleID);
  assert.equal(diagnostics[0]?.line, 5);
  assert.match(diagnostics[0]?.message ?? "", /App-layer type 'OrdersDI'/);
  assert.match(
    diagnostics[0]?.message ?? "",
    /Application\/Ports\/Protocols/,
  );
});

test("AppPortProtocolConformancePolicy flags App classes implementing Domain protocols", () => {
  const file = makeFile({
    repoRelativePath: "src/app/runtime/RuntimeClock.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppRuntime,
    topLevelDeclarations: [
      {
        name: "RuntimeClock",
        kind: NominalKind.Class,
        inheritedTypeNames: ["ClockProtocol"],
        memberNames: [],
        coordinate: { line: 7, column: 14 },
      },
    ],
  });
  const context = new ProjectContext([
    {
      name: "ClockProtocol",
      kind: NominalKind.Protocol,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/domain/protocols/ClockProtocol.ts",
      layer: ArchitectureLayer.Domain,
      roleFolder: RoleFolder.DomainProtocols,
    },
  ]);

  const diagnostics = new AppPortProtocolConformancePolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]?.ruleID, AppPortProtocolConformancePolicy.ruleID);
  assert.match(diagnostics[0]?.message ?? "", /ClockProtocol/);
  assert.match(diagnostics[0]?.message ?? "", /Domain\/Protocols/);
});

test("AppPortProtocolConformancePolicy ignores App interface declarations", () => {
  const file = makeFile({
    repoRelativePath: "src/app/dependency-injection/OrdersDI.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppDependencyInjection,
    topLevelDeclarations: [
      {
        name: "OrdersDIProtocol",
        kind: NominalKind.Protocol,
        inheritedTypeNames: ["OrdersRepositoryProtocol"],
        memberNames: [],
        coordinate: { line: 3, column: 18 },
      },
    ],
  });
  const context = new ProjectContext([
    {
      name: "OrdersRepositoryProtocol",
      kind: NominalKind.Protocol,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/application/ports/protocols/OrdersRepositoryProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    },
  ]);

  const diagnostics = new AppPortProtocolConformancePolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("AppPortProtocolConformancePolicy ignores non-App conforming classes", () => {
  const file = makeFile({
    repoRelativePath: "src/infrastructure/port-adapters/OrdersPortAdapter.ts",
    layer: ArchitectureLayer.Infrastructure,
    roleFolder: RoleFolder.InfrastructurePortAdapters,
    topLevelDeclarations: [
      {
        name: "OrdersPortAdapter",
        kind: NominalKind.Class,
        inheritedTypeNames: ["OrdersRepositoryProtocol"],
        memberNames: [],
        coordinate: { line: 3, column: 14 },
      },
    ],
  });
  const context = new ProjectContext([
    {
      name: "OrdersRepositoryProtocol",
      kind: NominalKind.Protocol,
      inheritedTypeNames: [],
      methodShapes: [],
      repoRelativePath: "src/application/ports/protocols/OrdersRepositoryProtocol.ts",
      layer: ArchitectureLayer.Application,
      roleFolder: RoleFolder.ApplicationPortsProtocols,
    },
  ]);

  const diagnostics = new AppPortProtocolConformancePolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("AppApplicationBoundaryOperationPolicy flags App/Runtime stored Application boundary dependencies", () => {
  const file = makeFile({
    repoRelativePath: "src/app/runtime/OrdersRuntime.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppRuntime,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrdersRuntime",
        name: "useCase",
        typeNames: ["FetchOrderUseCase"],
        isStatic: false,
        coordinate: { line: 4, column: 20 },
      },
      {
        enclosingTypeName: "OrdersRuntime",
        name: "orders",
        typeNames: ["OrdersRepositoryProtocol"],
        isStatic: false,
        coordinate: { line: 5, column: 20 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationDeclaration("FetchOrderUseCase", RoleFolder.ApplicationUseCases),
    applicationDeclaration(
      "OrdersRepositoryProtocol",
      RoleFolder.ApplicationPortsProtocols,
    ),
  ]);

  const diagnostics = new AppApplicationBoundaryOperationPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 2);
  assert.equal(
    diagnostics[0]?.ruleID,
    AppApplicationBoundaryOperationPolicy.ruleID,
  );
  assert.match(diagnostics[0]?.message ?? "", /stores or invokes/);
  assert.match(diagnostics[1]?.message ?? "", /OrdersRepositoryProtocol/);
});

test("AppApplicationBoundaryOperationPolicy flags App method calls on Application boundary bindings", () => {
  const file = makeFile({
    repoRelativePath: "src/app/dependency-injection/OrdersDI.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppDependencyInjection,
    constructionOccurrences: [
      {
        typeName: "FetchOrderUseCase",
        assignedName: "useCase",
        coordinate: { line: 6, column: 21 },
      },
    ],
    memberCallOccurrences: [
      {
        baseName: "useCase",
        memberName: "execute",
        coordinate: { line: 7, column: 5 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationDeclaration("FetchOrderUseCase", RoleFolder.ApplicationUseCases),
  ]);

  const diagnostics = new AppApplicationBoundaryOperationPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    AppApplicationBoundaryOperationPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 7);
  assert.match(diagnostics[0]?.message ?? "", /useCase/);
});

test("AppApplicationBoundaryOperationPolicy allows App/DependencyInjection construction without operation", () => {
  const file = makeFile({
    repoRelativePath: "src/app/dependency-injection/OrdersDI.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppDependencyInjection,
    constructionOccurrences: [
      {
        typeName: "FetchOrderUseCase",
        assignedName: "useCase",
        coordinate: { line: 6, column: 21 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationDeclaration("FetchOrderUseCase", RoleFolder.ApplicationUseCases),
  ]);

  const diagnostics = new AppApplicationBoundaryOperationPolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("AppApplicationBoundaryOperationPolicy ignores non-App files", () => {
  const file = makeFile({
    repoRelativePath: "src/presentation/controllers/OrdersController.ts",
    layer: ArchitectureLayer.Presentation,
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrdersController",
        name: "useCase",
        typeNames: ["FetchOrderUseCase"],
        isStatic: false,
        coordinate: { line: 4, column: 20 },
      },
    ],
    memberCallOccurrences: [
      {
        baseName: "useCase",
        memberName: "execute",
        coordinate: { line: 8, column: 5 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationDeclaration("FetchOrderUseCase", RoleFolder.ApplicationUseCases),
  ]);

  const diagnostics = new AppApplicationBoundaryOperationPolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("AppMultiServiceOrchestrationPolicy flags the second distinct Application service call in App", () => {
  const file = makeFile({
    repoRelativePath: "src/app/runtime/OrdersRuntime.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppRuntime,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrdersRuntime",
        name: "orders",
        typeNames: ["OrdersService"],
        isStatic: false,
        coordinate: { line: 4, column: 20 },
      },
    ],
    typedMemberOccurrences: [
      {
        name: "billing",
        typeNames: ["BillingService"],
        coordinate: { line: 9, column: 11 },
      },
    ],
    memberCallOccurrences: [
      {
        baseName: "orders",
        memberName: "checkout",
        coordinate: { line: 12, column: 5 },
      },
      {
        baseName: "orders",
        memberName: "refresh",
        coordinate: { line: 13, column: 5 },
      },
      {
        baseName: "billing",
        memberName: "capture",
        coordinate: { line: 14, column: 5 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationServiceDeclaration("OrdersService"),
    applicationServiceDeclaration("BillingService"),
  ]);

  const diagnostics = new AppMultiServiceOrchestrationPolicy().evaluate(
    file,
    context,
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(
    diagnostics[0]?.ruleID,
    AppMultiServiceOrchestrationPolicy.ruleID,
  );
  assert.equal(diagnostics[0]?.line, 14);
  assert.match(diagnostics[0]?.message ?? "", /operates 2 distinct Application services/);
  assert.match(diagnostics[0]?.message ?? "", /'orders', 'billing'/);
});

test("AppMultiServiceOrchestrationPolicy allows a single Application service call", () => {
  const file = makeFile({
    repoRelativePath: "src/app/runtime/OrdersRuntime.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppRuntime,
    constructionOccurrences: [
      {
        typeName: "OrdersService",
        assignedName: "orders",
        coordinate: { line: 6, column: 20 },
      },
    ],
    memberCallOccurrences: [
      {
        baseName: "orders",
        memberName: "checkout",
        coordinate: { line: 8, column: 5 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationServiceDeclaration("OrdersService"),
  ]);

  const diagnostics = new AppMultiServiceOrchestrationPolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("AppMultiServiceOrchestrationPolicy allows pure DI construction without service calls", () => {
  const file = makeFile({
    repoRelativePath: "src/app/dependency-injection/OrdersDI.ts",
    layer: ArchitectureLayer.App,
    roleFolder: RoleFolder.AppDependencyInjection,
    constructionOccurrences: [
      {
        typeName: "OrdersService",
        assignedName: "orders",
        coordinate: { line: 6, column: 20 },
      },
      {
        typeName: "BillingService",
        assignedName: "billing",
        coordinate: { line: 7, column: 20 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationServiceDeclaration("OrdersService"),
    applicationServiceDeclaration("BillingService"),
  ]);

  const diagnostics = new AppMultiServiceOrchestrationPolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("AppMultiServiceOrchestrationPolicy ignores non-App service calls", () => {
  const file = makeFile({
    repoRelativePath: "src/presentation/controllers/OrdersController.ts",
    layer: ArchitectureLayer.Presentation,
    roleFolder: RoleFolder.PresentationControllers,
    storedMemberDeclarations: [
      {
        enclosingTypeName: "OrdersController",
        name: "orders",
        typeNames: ["OrdersService"],
        isStatic: false,
        coordinate: { line: 4, column: 20 },
      },
      {
        enclosingTypeName: "OrdersController",
        name: "billing",
        typeNames: ["BillingService"],
        isStatic: false,
        coordinate: { line: 5, column: 20 },
      },
    ],
    memberCallOccurrences: [
      {
        baseName: "orders",
        memberName: "checkout",
        coordinate: { line: 8, column: 5 },
      },
      {
        baseName: "billing",
        memberName: "capture",
        coordinate: { line: 9, column: 5 },
      },
    ],
  });
  const context = new ProjectContext([
    applicationServiceDeclaration("OrdersService"),
    applicationServiceDeclaration("BillingService"),
  ]);

  const diagnostics = new AppMultiServiceOrchestrationPolicy().evaluate(
    file,
    context,
  );

  assert.deepEqual(diagnostics, []);
});

test("AppApplicationBoundaryOperationPolicy is included in the default registry", () => {
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) =>
        policy.constructor === AppApplicationBoundaryOperationPolicy,
    ),
  );
});

test("AppMultiServiceOrchestrationPolicy is included in the default registry", () => {
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) => policy.constructor === AppMultiServiceOrchestrationPolicy,
    ),
  );
});

test("AppPortProtocolConformancePolicy is included in the default registry", () => {
  assert.ok(
    DefaultArchitecturePolicies.make().some(
      (policy) => policy.constructor === AppPortProtocolConformancePolicy,
    ),
  );
});

test("makeAppCompositionPolicies returns the full app composition rule set", () => {
  assert.equal(makeAppCompositionPolicies().length, 7);
  assert.ok(
    makeAppCompositionPolicies().some(
      (policy) =>
        policy.constructor === AppApplicationBoundaryOperationPolicy,
    ),
  );
  assert.ok(
    makeAppCompositionPolicies().some(
      (policy) => policy.constructor === AppMultiServiceOrchestrationPolicy,
    ),
  );
  assert.ok(
    makeAppCompositionPolicies().some(
      (policy) => policy.constructor === AppPortProtocolConformancePolicy,
    ),
  );
});

function makeFile(input: {
  readonly repoRelativePath: string;
  readonly layer: ArchitectureLayer;
  readonly roleFolder: RoleFolder;
  readonly topLevelDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["topLevelDeclarations"];
  readonly typeReferences?: ConstructorParameters<typeof ArchitectureFile>[0]["typeReferences"];
  readonly storedMemberDeclarations?: ConstructorParameters<typeof ArchitectureFile>[0]["storedMemberDeclarations"];
  readonly typedMemberOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["typedMemberOccurrences"];
  readonly memberCallOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["memberCallOccurrences"];
  readonly constructionOccurrences?: ConstructorParameters<typeof ArchitectureFile>[0]["constructionOccurrences"];
}): ArchitectureFile {
  return new ArchitectureFile({
    repoRelativePath: input.repoRelativePath,
    classification: new FileClassification({
      repoRelativePath: input.repoRelativePath,
      layer: input.layer,
      roleFolder: input.roleFolder,
      pathComponents: input.repoRelativePath.split("/"),
      fileName: input.repoRelativePath.split("/").at(-1) ?? "unknown.ts",
      fileStem:
        input.repoRelativePath.split("/").at(-1)?.replace(/\.[^.]+$/, "") ??
        "unknown",
    }),
    topLevelDeclarations: input.topLevelDeclarations ?? [],
    typeReferences: input.typeReferences ?? [],
    storedMemberDeclarations: input.storedMemberDeclarations ?? [],
    typedMemberOccurrences: input.typedMemberOccurrences ?? [],
    memberCallOccurrences: input.memberCallOccurrences ?? [],
    constructionOccurrences: input.constructionOccurrences ?? [],
  });
}

function applicationDeclaration(name: string, roleFolder: RoleFolder) {
  return {
    name,
    kind: name.endsWith("Protocol") ? NominalKind.Protocol : NominalKind.Class,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath:
      roleFolder === RoleFolder.ApplicationUseCases
        ? `src/application/use-cases/${name}.ts`
        : `src/application/ports/protocols/${name}.ts`,
    layer: ArchitectureLayer.Application,
    roleFolder,
  };
}

function applicationServiceDeclaration(name: string) {
  return {
    name,
    kind: NominalKind.Class,
    inheritedTypeNames: [],
    methodShapes: [],
    repoRelativePath: `src/application/services/${name}.ts`,
    layer: ArchitectureLayer.Application,
    roleFolder: RoleFolder.ApplicationServices,
  };
}
