import assert from "node:assert/strict";
import test from "node:test";

import {
  endsWithAmbiguousApplicationSuffix,
} from "../../src/Domain/Policies/shared/AmbiguousApplicationSuffixes.ts";
import {
  DEPENDENCY_RESOLUTION_BASE_NAMES,
  DEPENDENCY_RESOLUTION_DECORATOR_NAMES,
  DEPENDENCY_RESOLUTION_MEMBER_NAMES,
  isDependencyResolutionAccess,
  isDependencyResolutionDecoratorName,
} from "../../src/Domain/Policies/shared/DependencyResolutionDetection.ts";
import { isForbiddenUseCaseBoundaryTypeName } from "../../src/Domain/Policies/shared/ForbiddenUseCaseBoundaryTypes.ts";
import {
  RICH_REMEDIATION_MARKERS,
  richRemediationMessage,
} from "../../src/Domain/Policies/shared/RichRemediationMessage.ts";
import {
  endsWithTechnicalDependencySuffix,
  endsWithTechnicalSeamSuffix,
} from "../../src/Domain/Policies/shared/TechnicalSeamSuffixes.ts";

test("richRemediationMessage emits all five Swift-parity markers in order", () => {
  const message = richRemediationMessage({
    summary: "Top-level type 'FooService' is misplaced.",
    categories: ["c1", "c2"],
    signs: ["s1", "s2"],
    architecturalNote: "n1",
    destination: "d1",
    decomposition: "g1",
  });

  for (const marker of RICH_REMEDIATION_MARKERS) {
    assert.ok(
      message.includes(marker),
      `expected marker '${marker}' in message: ${message}`,
    );
  }

  // Verify ordering: the markers must appear in the canonical order.
  const indices = RICH_REMEDIATION_MARKERS.map((marker) => message.indexOf(marker));
  for (let i = 1; i < indices.length; i++) {
    assert.ok(
      indices[i]! > indices[i - 1]!,
      `marker '${RICH_REMEDIATION_MARKERS[i]}' must follow '${RICH_REMEDIATION_MARKERS[i - 1]}'`,
    );
  }

  assert.ok(message.startsWith("Top-level type 'FooService' is misplaced."));
  assert.ok(message.includes("Likely categories: c1; c2"));
  assert.ok(message.includes("signs: s1; s2"));
  assert.ok(message.endsWith("explicit decomposition guidance: g1"));
});

test("technical seam suffix list covers Protocol, Interface, and Port variants", () => {
  assert.ok(endsWithTechnicalSeamSuffix("OrderRepositoryProtocol"));
  assert.ok(endsWithTechnicalSeamSuffix("OrderRepositoryInterface"));
  assert.ok(endsWithTechnicalSeamSuffix("OrderRepositoryPort"));
  assert.ok(endsWithTechnicalSeamSuffix("PaymentGatewayProtocol"));
  assert.ok(endsWithTechnicalSeamSuffix("HttpClientInterface"));
  assert.ok(endsWithTechnicalSeamSuffix("MetricsAdapterPort"));
  assert.ok(endsWithTechnicalSeamSuffix("ConfigProviderProtocol"));
  assert.ok(endsWithTechnicalSeamSuffix("AuthPortProtocol"));
  assert.ok(endsWithTechnicalSeamSuffix("AuthPortInterface"));
  assert.ok(endsWithTechnicalSeamSuffix("AuthPort"));

  assert.ok(!endsWithTechnicalSeamSuffix("OrderService"));
  assert.ok(!endsWithTechnicalSeamSuffix("OrderRepository"));
  assert.ok(!endsWithTechnicalSeamSuffix("OrderUseCase"));
});

test("technical dependency suffix list includes seams plus concrete forms", () => {
  assert.ok(endsWithTechnicalDependencySuffix("OrderRepository"));
  assert.ok(endsWithTechnicalDependencySuffix("PaymentGateway"));
  assert.ok(endsWithTechnicalDependencySuffix("HttpClient"));
  assert.ok(endsWithTechnicalDependencySuffix("MetricsAdapter"));
  assert.ok(endsWithTechnicalDependencySuffix("ConfigProvider"));
  assert.ok(endsWithTechnicalDependencySuffix("ServiceLocator"));
  assert.ok(endsWithTechnicalDependencySuffix("DependencyContainer"));
  assert.ok(endsWithTechnicalDependencySuffix("AppGraph"));

  assert.ok(!endsWithTechnicalDependencySuffix("OrderUseCase"));
  assert.ok(!endsWithTechnicalDependencySuffix("OrderService"));
  assert.ok(!endsWithTechnicalDependencySuffix("Order"));
});

test("ambiguous application suffix list matches Swift verbatim", () => {
  for (const suffix of [
    "Manager",
    "Helper",
    "Provider",
    "Client",
    "Coordinator",
    "Adapter",
    "Repository",
    "Gateway",
  ]) {
    assert.ok(
      endsWithAmbiguousApplicationSuffix(`Order${suffix}`),
      `Order${suffix} should be ambiguous`,
    );
  }

  assert.ok(!endsWithAmbiguousApplicationSuffix("OrderUseCase"));
  assert.ok(!endsWithAmbiguousApplicationSuffix("OrderService"));
  assert.ok(!endsWithAmbiguousApplicationSuffix("OrderPortProtocol"));
});

test("DI resolution access predicate fires on container/locator base + resolve/get/shared/live", () => {
  assert.ok(isDependencyResolutionAccess("Container", "resolve"));
  assert.ok(isDependencyResolutionAccess("ServiceLocator", "get"));
  assert.ok(isDependencyResolutionAccess("DependencyContainer", "register"));
  assert.ok(isDependencyResolutionAccess("Resolver", "resolve"));
  assert.ok(isDependencyResolutionAccess("Registry", "get"));
  assert.ok(isDependencyResolutionAccess("Injector", "get"));
  assert.ok(isDependencyResolutionAccess("AppGraph", "resolve"));
  assert.ok(isDependencyResolutionAccess("Dependencies", "live"));

  // suffix-matched bases also count
  assert.ok(isDependencyResolutionAccess("OrderRepository", "shared"));
  assert.ok(isDependencyResolutionAccess("PaymentGateway", "default"));

  // lowercase variable instances
  assert.ok(isDependencyResolutionAccess("container", "resolve"));
  assert.ok(isDependencyResolutionAccess("registry", "get"));

  // non-DI base or non-DI member is not flagged
  assert.ok(!isDependencyResolutionAccess("Greeting", "value"));
  assert.ok(!isDependencyResolutionAccess("Container", "fooBar"));
  assert.ok(!isDependencyResolutionAccess("Order", "id"));
});

test("DI decorator predicate matches Inject/Injected/Dependency/Provided", () => {
  for (const name of DEPENDENCY_RESOLUTION_DECORATOR_NAMES) {
    assert.ok(
      isDependencyResolutionDecoratorName(name),
      `${name} should be a DI decorator`,
    );
  }

  assert.ok(!isDependencyResolutionDecoratorName("Component"));
  assert.ok(!isDependencyResolutionDecoratorName("Controller"));
});

test("forbidden UseCase boundary type names cover Node/browser/Express/Next + DI", () => {
  for (const name of [
    "Request",
    "Response",
    "Headers",
    "URL",
    "Buffer",
    "IncomingMessage",
    "ServerResponse",
    "NextRequest",
    "NextResponse",
    "Container",
    "DependencyContainer",
    "ServiceLocator",
    "Resolver",
    "Registry",
    "Injector",
  ]) {
    assert.ok(isForbiddenUseCaseBoundaryTypeName(name), `${name} should be forbidden`);
  }

  assert.ok(!isForbiddenUseCaseBoundaryTypeName("Order"));
  assert.ok(!isForbiddenUseCaseBoundaryTypeName("OrderContract"));
});

test("DI constants stay frozen and stable", () => {
  assert.ok(DEPENDENCY_RESOLUTION_BASE_NAMES.has("Container"));
  assert.ok(DEPENDENCY_RESOLUTION_MEMBER_NAMES.has("resolve"));
  assert.ok(DEPENDENCY_RESOLUTION_DECORATOR_NAMES.has("Inject"));
});
