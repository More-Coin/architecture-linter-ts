import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../src/App/configuration/ArchitectureLinterConfiguration.ts";
import { ArchitecturePathClassificationPolicy } from "../../src/Domain/Policies/ArchitecturePathClassificationPolicy.ts";
import { ArchitectureLayer } from "../../src/Domain/ValueObjects/ArchitectureLayer.ts";
import { RoleFolder } from "../../src/Domain/ValueObjects/RoleFolder.ts";

test("path classification recognizes lowercase source folders using configured layer names", () => {
  const classifier = new ArchitecturePathClassificationPolicy(
    DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  );

  const appFile = classifier.classify("app/main.ts");
  const useCaseFile = classifier.classify("application/use-cases/FooUseCase.ts");
  const gatewayFile = classifier.classify("infrastructure/port-adapters/FooAdapter.ts");
  const controllerFile = classifier.classify("presentation/controllers/FooController.ts");
  const domainFile = classifier.classify("domain/policies/FooPolicy.ts");

  assert.equal(appFile.layer, ArchitectureLayer.App);
  assert.equal(appFile.roleFolder, RoleFolder.AppEntrypoint);
  assert.equal(useCaseFile.layer, ArchitectureLayer.Application);
  assert.equal(useCaseFile.roleFolder, RoleFolder.ApplicationUseCases);
  assert.equal(gatewayFile.layer, ArchitectureLayer.Infrastructure);
  assert.equal(gatewayFile.roleFolder, RoleFolder.InfrastructurePortAdapters);
  assert.equal(controllerFile.layer, ArchitectureLayer.Presentation);
  assert.equal(controllerFile.roleFolder, RoleFolder.PresentationControllers);
  assert.equal(domainFile.layer, ArchitectureLayer.Domain);
  assert.equal(domainFile.roleFolder, RoleFolder.DomainPolicies);
});
