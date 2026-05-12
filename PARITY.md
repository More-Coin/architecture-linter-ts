# Swift ↔ TypeScript Architecture-Linter Parity Matrix

This document tracks the gap between the Swift reference linter (`More-Coin/ArchitectureLinter`) and the TypeScript implementation in this repo. It is the working artifact for the Swift-parity initiative.

- **Swift source of truth:** `ArchitectureLinter/ArchitectureLinterRules/Sources/*.swift` (version `0.2.5`)
- **TypeScript source of truth:** `src/domain/policies/*.ts`
- **Last refreshed:** 2026-05-12 (v3)

> **Read this section first.** Throughout this document, **registered** means "included by default in one of the policy factories" — specifically:
> - `DefaultArchitecturePolicies.make()` for file-level architectural policies, and
> - `DefaultArchitecturePolicies.makeProjectPolicies()` for project-level TS-specific policies that operate on the whole tree (e.g. empty-directory checks).
>
> A registered rule actually runs unless a user adds it to `disabledRuleIDs` / `disabledRulePrefixes`. **Defined** means the policy class exists in source but may or may not be registered. The two are *not* the same — Swift deprecates `presentation.controllers.usecase_reference` and keeps the class around, but it is not registered, so users never see diagnostics from it by default. The parity work targets *registered* parity.

---

## 1. Headline counts

| Side | Defined standalone policy ruleIDs in source | Registered (default) | Defined-but-not-registered |
|------|---|---|---|
| Swift `0.2.5` | 121 | 120 (all via `DefaultArchitecturePolicies.make()`) | 1 (`presentation.controllers.usecase_reference`, deprecated) |
| TypeScript    | 109 | **107 total** — 105 file policies via `DefaultArchitecturePolicies.make()` + 2 project policies via `DefaultArchitecturePolicies.makeProjectPolicies()` (`SourceRootEmptyDirectoryPolicy`, `InfrastructureEmptyDirectoryPolicy`) | 2 (`ArchitectureDiagnosticOrderingPolicy`, `ArchitecturePathClassificationPolicy` — utility classifiers, not architectural rules) |

The "defined standalone policy ruleIDs" column counts the primary `ruleID` of each policy class. It excludes the secondary `surfaceRuleID` strings (`domain.errors.surface`, `application.errors.surface`) emitted by existing policies — those are catalogued in §3.9.

**Registered-vs-registered parity gap:** TS is missing 19 Swift-registered ruleIDs. TS additionally registers 6 ruleIDs that Swift does not register (4 legitimate TS-specific extras + 1 deprecated-in-Swift rule TS still ships + 1 TS-specific Translation-structure rule). See §2.

The brief's original "18 Swift-only" count was off-by-one against current `main`: it missed `infrastructure.repositories.role_fit`, which Swift `0.2.5` registers but TS does not.

---

## 2. Diff summary (registered-vs-registered)

### 2.1 Swift-registered rule IDs missing from TS — 19

```
application.ambiguous_role_name
application.passive_dependency_resolution
application.services.dependency_resolution
application.services.port_protocol_reference
application.services.service_reference
application.services.usecase_construction
application.usecases.boundary_type_reference
application.usecases.dependency_resolution
application.usecases.usecase_reference
architecture.service_role_placement
architecture.technical_seam_protocol_placement
domain.dependency_resolution
infrastructure.repositories.role_fit                              ← surfaced in Swift 0.2.5; was missed in v1 of this matrix
infrastructure.unknown_subdirectory
presentation.composition_reference
presentation.dependency_resolution
presentation.port_protocol_reference
presentation.usecase_reference
tests.swiftpm_test_targets_must_point_to_repo_test_root
```

### 2.2 TS-registered rule IDs that Swift does not register — 6

```
infrastructure.empty_directory          — TS-specific project-level rule (no Swift analog)
infrastructure.role_folder_structure    — TS-specific translation of infrastructure.unknown_subdirectory
infrastructure.translation.structure    — TS-specific Translation-subtree rule (no Swift analog)
presentation.controllers.usecase_reference  — Swift defines this but deprecates it and does NOT register it; TS still registers it. See §2.3 and §3.3.
source_root.empty_directory             — TS-specific project-level rule (no Swift analog)
source_root.layout                      — TS-specific src/ layout rule (no Swift analog)
```

Plus 2 secondary `surfaceRuleID` strings emitted by existing TS policies (not standalone rules and not in `DefaultArchitecturePolicies.make()`): `domain.errors.surface`, `application.errors.surface`. These are *defined* but emitted alongside their parent rule's primary ID.

### 2.3 Defined-but-not-registered Swift policies — 1

| Swift class | Swift rule ID | Swift status | TS status | Decision |
|---|---|---|---|---|
| `PresentationControllersUseCaseReferencePolicy` | `presentation.controllers.usecase_reference` | Defined in source, marked `@available(*, deprecated, message: "Use PresentationUseCaseReferencePolicy; it applies the same boundary to every Presentation role.")`, **not registered** in `DefaultArchitecturePolicies.make()` | Currently **registered** in `DefaultArchitecturePolicies.ts` | When Stage 5 adds the broad `presentation.usecase_reference` policy to TS, **remove the controllers-specific policy from the TS default registry** to mirror Swift behavior. Optionally keep the class exported for manual/custom policy construction, matching Swift's defined-but-unregistered stance. (Note: `disabledRuleIDs` cannot opt a rule *in*; it only opts rules *out* — an unregistered rule can only be re-enabled by constructing the policy list manually.) Without this change, controller files would fire **both** rules and produce duplicate diagnostics. |

---

## 3. Full parity matrix

Columns:
- **Swift class** — declaration in Swift sources
- **Swift rule ID** — string ID
- **Swift reg.** — registered in `DefaultArchitecturePolicies.make()`? (✅ / ⛔ defined-but-not-registered)
- **TS class** — current TS counterpart, or — if none
- **TS reg.** — registered in `DefaultArchitecturePolicies.ts`? (✅ / ⛔ defined-but-not-registered / — none)
- **Status** — `present` · `present but weaker` · `missing` · `TS-specific equivalent` · `intentionally not applicable` · `TS over-registers vs Swift`
- **Action** — what stage 2+ must do
- **Tests** — required test coverage

### 3.1 Domain & cross-architecture

| Swift class | Swift rule ID | Swift reg. | TS class | TS reg. | Status | Action | Tests |
|---|---|---|---|---|---|---|---|
| DomainForbiddenImportPolicy | `domain.forbidden_import` | ✅ | DomainForbiddenImportPolicy | ✅ | present | none | covered |
| DomainOuterLayerReferencePolicy | `domain.outer_layer_reference` | ✅ | same | ✅ | present | none | covered |
| DomainDependencyResolutionPolicy | `domain.dependency_resolution` | ✅ | — | — | **missing** | Implement using shared DI helper (Stage 3) | violating fixture + valid fixture + rich-remediation assertion + coord test + disabled-ID test |
| DomainDurableStructurePolicy | `domain.durable_structure` | ✅ | same | ✅ | present | none | covered |
| DomainPolicyPurityPolicy | `domain.policy_forbidden_api` | ✅ | same | ✅ | present | none | covered |
| DomainPolicyShapePolicy | `domain.policy_shape` | ✅ | same | ✅ | present | none | covered |
| DomainProtocolNamingPolicy | `domain.protocol_naming` | ✅ | same | ✅ | present | none | covered |
| DomainErrorsShapePolicy | `domain.errors.shape` (+ TS `domain.errors.surface` secondary) | ✅ | DomainErrorsShapePolicy | ✅ | present | TS emits a second ruleID via `surfaceRuleID`; keep as documented TS extra | covered |
| DomainErrorsPlacementPolicy | `domain.errors.placement` | ✅ | same | ✅ | present | none | covered |
| RepositoryProtocolPlacementPolicy | `domain.repository_protocol_placement` | ✅ | same | ✅ | present | none | covered |
| ArchitectureServiceRolePlacementPolicy | `architecture.service_role_placement` | ✅ | — | — | **missing** | New cross-architecture policy (Stage 3). Catch `*Service` top-level types outside `Application/Services`; skip test files. Reuse rich-remediation helper. Decide source-file home (proposal: new `CrossArchitecturePolicies.ts`). | fixture per layer (Domain/Infrastructure/Presentation having `*Service`) + valid Application/Services fixture + remediation + coord + disabled-prefix |
| TechnicalSeamProtocolPlacementPolicy | `architecture.technical_seam_protocol_placement` | ✅ | — | — | **missing** | New cross-architecture policy (Stage 3). Catch interfaces/types ending in `RepositoryProtocol|GatewayProtocol|ClientProtocol|AdapterProtocol|ProviderProtocol|PortProtocol`/`Interface`/`Port` variants outside `Application/Ports/Protocols` (PortProtocol family) or `Domain/Protocols` (RepositoryProtocol). Widen Swift's suffix list to include `*Interface` and `*Port` because TS rarely uses `*Protocol`; document the widening. | per-suffix violating fixture + valid placement fixtures (Application/Ports/Protocols + Domain/Protocols) + Infrastructure-seam-next-to-impl fixture + remediation + coord + disabled-ID |

### 3.2 Application

| Swift class | Swift rule ID | Swift reg. | TS class | TS reg. | Status | Action | Tests |
|---|---|---|---|---|---|---|---|
| ApplicationOuterLayerReferencePolicy | `application.outer_layer_reference` | ✅ | same | ✅ | present | none | covered |
| ApplicationPortProtocolsShapePolicy | `application.port_protocols.shape` | ✅ | same | ✅ | present | none | covered |
| ApplicationContractsShapePolicy | `application.contracts.shape` | ✅ | same | ✅ | present | none | covered |
| ApplicationContractsNestedErrorPlacementPolicy | `application.contracts.nested_error_placement` | ✅ | same | ✅ | present | none | covered |
| ApplicationContractsNoErrorMappingSurfacePolicy | `application.contracts.no_error_mapping_surface` | ✅ | same | ✅ | present | none | covered |
| ApplicationContractsNoCollaboratorDependenciesPolicy | `application.contracts.no_collaborator_dependencies` | ✅ | same | ✅ | present | none | covered |
| ApplicationContractsOwnershipPolicy | `application.contracts.ownership` | ✅ | same | ✅ | present | none | covered |
| ApplicationContractsNoStateTransitionSurfacePolicy | `application.contracts.no_state_transition_surface` | ✅ | same | ✅ | present | none | covered |
| ApplicationContractsErrorTaxonomyPolicy | `application.contracts.error_taxonomy` | ✅ | same | ✅ | present | none | covered |
| ApplicationPassiveDependencyResolutionPolicy | `application.passive_dependency_resolution` | ✅ | — | — | **missing** | Implement via shared DI helper, gating on `isApplicationContractFile \|\| isApplicationErrorFile \|\| isApplicationStateTransitionFile` (Stage 4). | fixture per gated file role + valid fixture + remediation + coord + disabled-ID |
| ApplicationProtocolPlacementPolicy | `application.protocol_placement` | ✅ | same | ✅ | present | none | covered |
| ApplicationAmbiguousRoleNamePolicy | `application.ambiguous_role_name` | ✅ | — | — | **missing** | Catch top-level Application types ending in `Manager\|Helper\|Provider\|Client\|Coordinator\|Adapter\|Repository\|Gateway`. Skip allowed suffixes per role: `PortProtocol` (ports), `Service` (services), `UseCase` (use cases), `Contract` (contracts). Reuse Swift suffix list verbatim. (Stage 4) | per-suffix violating fixture + allowed-suffix valid fixture per role + remediation + coord + disabled-ID |
| ApplicationErrorsShapePolicy | `application.errors.shape` (+ TS `application.errors.surface` secondary) | ✅ | same | ✅ | present | TS emits a second ruleID via `surfaceRuleID`; document | covered |
| ApplicationErrorsPlacementPolicy | `application.errors.placement` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesShapePolicy | `application.services.shape` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesNoProtocolsPolicy | `application.services.no_protocols` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesPortProtocolReferencePolicy | `application.services.port_protocol_reference` | ✅ | — | — | **missing** | New policy. Walks all reference occurrences (typeRefs + storedMembers + constructor params + method params + method returns + computed prop types + constructions + member calls) and flags declarations in `Application/Ports/Protocols`, declarations in `Infrastructure`, or names matching the technical-dependency suffix list. Excludes `Application/UseCases` declarations. Reuses Swift `isForbiddenApplicationServiceDependency` logic. (Stage 4) | fixture for: constructor-param port + method-param port + return-type port + stored-member port + named-only port (no declaration) + valid usecase injection + remediation + coord + disabled-ID |
| ApplicationServicesServiceReferencePolicy | `application.services.service_reference` | ✅ | — | — | **missing** | New policy. Walks reference occurrences and flags declarations whose `roleFolder === ApplicationServices`, skipping references to the local file's own top-level service names. (Stage 4) | violating + valid (self-service ref) + remediation + coord + disabled-ID |
| ApplicationServicesUseCaseConstructionPolicy | `application.services.usecase_construction` | ✅ | — | — | **missing**. Requires new analyzer surface `constructionOccurrences`. | Stage 2 adds `constructionOccurrences` (a `new Foo(...)` index) to ArchitectureFile. Stage 4 ships the policy: flag construction of declarations where `roleFolder === ApplicationUseCases`. | violating (`new FooUseCase()`) + valid (injected UseCase) + remediation + coord + disabled-ID |
| ApplicationServicesDependencyResolutionPolicy | `application.services.dependency_resolution` | ✅ | — | — | **missing** | Implement via shared DI helper, gated on `isApplicationServiceFile`. (Stage 4) | violating + valid + remediation + coord + disabled-ID |
| ApplicationServicesNoUseCasesPolicy | `application.services.no_usecases` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesOrchestrationPolicy | `application.services.orchestration` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesSurfacePolicy | `application.services.surface` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesInfrastructureReferencePolicy | `application.services.infrastructure_reference` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesRepositoryReferencePolicy | `application.services.repository_reference` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesPlatformAPIPolicy | `application.services.platform_api` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesShapePolicy | `application.usecases.shape` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesNoProtocolsPolicy | `application.usecases.no_protocols` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesUseCaseReferencePolicy | `application.usecases.usecase_reference` | ✅ | — | — | **missing** | New policy. Walks reference occurrences and flags declarations where `roleFolder === ApplicationUseCases`, skipping references to the file's own top-level use-case names. (Stage 4) | violating + valid (self) + remediation + coord + disabled-ID |
| ApplicationUseCasesDependencyResolutionPolicy | `application.usecases.dependency_resolution` | ✅ | — | — | **missing** | Implement via shared DI helper, gated on `isApplicationUseCaseFile`. (Stage 4) | violating + valid + remediation + coord + disabled-ID |
| ApplicationUseCasesBoundaryTypeReferencePolicy | `application.usecases.boundary_type_reference` | ✅ | — | — | **missing** | New policy. For each reference name, fire if name matches the TS translation of `forbiddenUseCasePlatformTypes` OR resolves to a declaration whose layer ∈ {Presentation, Infrastructure, App}. (Stage 4) **TS forbidden-types list** (translation of Swift's): `URLRequest, URLResponse, HTTPURLResponse, URLSession, FileManager, Bundle, UserDefaults, Process, NSWorkspace, NSOpenPanel, UIView, ViewController, ServiceLocator, DependencyContainer, Container, Resolver, Registry` **→** `Request, Response, Headers, Body, URL, URLSearchParams, Buffer, ReadableStream, WritableStream, Express.Request, Express.Response, NextRequest, NextResponse, IncomingMessage, ServerResponse, FormData, FetchResponse, ServiceLocator, DependencyContainer, Container, Resolver, Registry, Injector`. Document the swap. | fixture per category (Presentation DTO, Infra DTO, platform Request/Response, App composition type, container name) + valid Domain/Contract fixture + remediation + coord + disabled-ID |
| ApplicationUseCasesOperationShapePolicy | `application.usecases.operation_shape` | ✅ | same | ✅ | **present but verify** | Re-read Swift implementation in Stage 4 and confirm TS matches: void/Promise<void> allowed when method name is command-shaped AND there is an inner protocol invocation; primitive returns must be flagged; generic `execute()` wrappers calling another semantic public method should be flagged. Extend if needed. | targeted operation-shape parity cases added in Stage 4 |
| ApplicationUseCasesAbstractionDelegationPolicy | `application.usecases.abstraction_delegation` | ✅ | same | ✅ | **present but verify** | Same: confirm semantics match Swift abstraction-delegation policy. | parity cases added in Stage 4 |
| ApplicationUseCasesSurfacePolicy | `application.usecases.surface` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesInfrastructureReferencePolicy | `application.usecases.infrastructure_reference` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesPlatformAPIPolicy | `application.usecases.platform_api` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesServiceReferencePolicy | `application.usecases.service_reference` | ✅ | same | ✅ | present | none | covered |

### 3.3 Presentation

| Swift class | Swift rule ID | Swift reg. | TS class | TS reg. | Status | Action | Tests |
|---|---|---|---|---|---|---|---|
| PresentationControllerShapePolicy | `presentation.controllers.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationControllersServiceReferencePolicy | `presentation.controllers.service_reference` | ✅ | same | ✅ | present | none | covered |
| PresentationControllersUseCaseReferencePolicy | `presentation.controllers.usecase_reference` | ⛔ defined but deprecated; **not registered** by Swift default registry | PresentationControllersUseCaseReferencePolicy | ✅ currently registered | **TS over-registers vs Swift** | When Stage 5 adds broad `presentation.usecase_reference`, **un-register** this controllers-specific policy from `DefaultArchitecturePolicies.ts` so controllers do not produce duplicate diagnostics. Optionally keep the exported class for opt-in. Document in README. | After change: regression test that controller fixtures emit `presentation.usecase_reference` only (not the controllers-specific rule); explicit test that the controllers-specific class is no longer in the default registry list. |
| PresentationUseCaseReferencePolicy | `presentation.usecase_reference` | ✅ | — | — | **missing** | New TS class `PresentationUseCaseReferencePolicy` gated on `isPresentation` (broader than `isControllerFile`). Reuses the same UseCase-declaration check but emits under `presentation.usecase_reference`. (Stage 5) | per-presentation-file-kind violating fixtures (DTO, renderer, presenter, route, middleware, view-model, view, style, error, controller) + valid (depends on a Service) + remediation + coord + disabled-ID |
| PresentationPortProtocolReferencePolicy | `presentation.port_protocol_reference` | ✅ | — | — | **missing** | New policy gated on `isPresentation` that flags references to declarations in `Application/Ports/Protocols`. (Stage 5) | violating + valid + remediation + coord + disabled-ID |
| PresentationCompositionReferencePolicy | `presentation.composition_reference` | ✅ | — | — | **missing** | New policy gated on `isPresentation` that flags references to declarations whose `layer === App` or `roleFolder === AppDependencyInjection`. (Stage 5) | violating + valid + remediation + coord + disabled-ID |
| PresentationDependencyResolutionPolicy | `presentation.dependency_resolution` | ✅ | — | — | **missing** | Implement via shared DI helper, gated on `isPresentation`. (Stage 5) | violating + valid + remediation + coord + disabled-ID |
| PresentationControllersFunctionSeamPolicy | `presentation.controllers.function_seam` | ✅ | same | ✅ | present | none | covered |
| PresentationRouteShapePolicy | `presentation.routes.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationDTOsShapePolicy | `presentation.dtos.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationPresentersShapePolicy | `presentation.presenters.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationRenderersShapePolicy | `presentation.renderers.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationMiddlewareShapePolicy | `presentation.middleware.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationErrorsShapePolicy | `presentation.errors.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationErrorsPlacementPolicy | `presentation.errors.placement` | ✅ | same | ✅ | present | none | covered |
| PresentationViewModelsShapePolicy | `presentation.viewmodels.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationViewsShapePolicy | `presentation.views.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationStylesShapePolicy | `presentation.styles.shape` | ✅ | same | ✅ | present | none | covered |
| PresentationInfrastructureReferencePolicy | `presentation.infrastructure_reference` | ✅ | same | ✅ | present | none | covered |

### 3.4 Tests

| Swift class | Swift rule ID | Swift reg. | TS class | TS reg. | Status | Action | Tests |
|---|---|---|---|---|---|---|---|
| TestsSwiftPMTargetRootPolicy | `tests.swiftpm_test_targets_must_point_to_repo_test_root` | ✅ | — | — | **intentionally not applicable** | Swift implementation scans `Package.swift` string literals starting with `"Tests/"`. TS has no equivalent of a SwiftPM `testTarget.path` field. The honest translations available (package.json scripts, vitest/jest config, tsconfig paths) all carry meaningfully different semantics and a non-trivial false-positive risk for downstream consumers. **Decision: do not add a TS analog under a renamed ruleID.** Document in README + this matrix. | README + matrix note only. No test fixture required for a non-implemented rule. |
| TestsLegacyRootPolicy | `tests.no_active_tests_under_legacy_tests_root` | ✅ | same | ✅ | present | none | covered |
| TestsRuntimeLayeredLocationPolicy | `tests.runtime_suite_must_follow_layered_location` | ✅ | same | ✅ | present | none | covered |
| TestsDiagnosticsLocationPolicy | `tests.linter_suite_must_live_under_diagnostics` | ✅ | same | ✅ | present | none | covered |
| TestsSharedSupportPlacementPolicy | `tests.shared_support_must_live_in_test_doubles` | ✅ | same | ✅ | present | none | covered |
| TestsMegaArchitectureLinterSuitePolicy | `tests.no_mega_architecture_linter_suite` | ✅ | same | ✅ | present | none | covered |
| TestsMixedResponsibilityRuntimeSuitePolicy | `tests.no_mixed_responsibility_runtime_suites` | ✅ | same | ✅ | present | none | covered |
| TestsTestDoublesOnlySupportPolicy | `tests.only_test_support_in_test_doubles` | ✅ | same | ✅ | present | none | covered |
| TestsImportOwnershipPolicy | `tests.test_files_should_import_only_needed_runtime_targets` | ✅ | same | ✅ | present | none | covered |
| TestsLinterHarnessExtractionPolicy | `tests.linter_harness_support_must_be_extracted` | ✅ | same | ✅ | present | none | covered |

### 3.5 Infrastructure

| Swift class | Swift rule ID | Swift reg. | TS class | TS reg. | Status | Action | Tests |
|---|---|---|---|---|---|---|---|
| InfrastructureRepositoriesShapePolicy | `infrastructure.repositories.shape` | ✅ | same | ✅ | present | none | covered |
| **InfrastructureRepositoriesRoleFitPolicy** | `infrastructure.repositories.role_fit` | ✅ | — | — | **missing** | New policy (Stage 6). Gated on `isInfrastructureRepositoryFile`. Two violation paths: (a) **public surface leak** — public repository method parameter or return type resolves to `Infrastructure/Translation/DTOs`, `Infrastructure/Translation/Models`, or `Presentation/DTOs`; (b) **misclassification** — repository-shaped concrete declaration lacks inward `Repository*` protocol/interface conformance, lacks repository data-access verbs, and shows DTO/Mapper/Builder/Parser/Evaluator/Gateway/Adapter evidence. Reuse rich-remediation helper. May need a small helper to walk public method signatures resolved through `ProjectContext.declarations(named:)`. | violating fixture for each path (DTO leak in repo signature + repository-shaped non-repository) + valid concrete-repository fixture (conforms to inner Repository protocol, returns Domain/Application types) + remediation + coord + disabled-ID |
| InfrastructureGatewaysShapePolicy | `infrastructure.gateways.shape` | ✅ | same | ✅ | present | none | covered |
| InfrastructureGatewaysRoleFitPolicy | `infrastructure.gateways.role_fit` | ✅ | same | ✅ | present | none | covered |
| InfrastructureUnknownSubdirectoryPolicy | `infrastructure.unknown_subdirectory` | ✅ | InfrastructureRoleFolderStructurePolicy + InfrastructureTranslationStructurePolicy | ✅ + ✅ | **TS-specific equivalent (already covers the intent under different rule IDs)** | Do not port the Swift name 1:1. Add a parity test that proves: (a) a fixture under `Infrastructure/<UnknownDir>/Foo.ts` fires `infrastructure.role_folder_structure`; (b) a fixture under `Infrastructure/Translation/Loose.ts` fires `infrastructure.translation.structure`. **Required README note** (see §6.5): a user who copies a Swift `disabledRuleIDs: ["infrastructure.unknown_subdirectory"]` config will *not* suppress the equivalent TS behavior — they must disable the two TS-specific IDs or use the `infrastructure.` prefix. | parity test in InfrastructureArchitecturePolicies.test.ts proving both fixtures fire and rich remediation is intact; plus a disable-config test that documents the renamed IDs. |
| (every other Swift infrastructure policy listed in `DefaultArchitecturePolicies.swift`) | various | ✅ | matching TS class | ✅ | present | none | covered |

### 3.6 App composition

| Swift class | Swift rule ID | Swift reg. | TS class | TS reg. | Status | Action | Tests |
|---|---|---|---|---|---|---|---|
| AppConfigurationShapePolicy | `app.configuration.shape` | ✅ | same | ✅ | present | none | covered |
| AppRuntimeShapePolicy | `app.runtime.shape` | ✅ | same | ✅ | present | none | covered |
| AppDependencyInjectionShapePolicy | `app.dependency_injection.shape` | ✅ | same | ✅ | present | none | covered |
| CompositionRootInwardReferencePolicy | `app.inward_reference` | ✅ | same | ✅ | present | none | covered |

### 3.7 TypeScript-only registered extras (retained)

| TS class | TS rule ID | Why kept |
|---|---|---|
| SourceRootLayoutPolicy | `source_root.layout` | TS package-root layout has no Swift analog (Swift uses SwiftPM target layout). Valuable for any TS consumer. |
| SourceRootEmptyDirectoryPolicy | `source_root.empty_directory` | Project-level filesystem hygiene check. No Swift analog. |
| InfrastructureEmptyDirectoryPolicy | `infrastructure.empty_directory` | Project-level filesystem hygiene check. No Swift analog. |
| InfrastructureRoleFolderStructurePolicy | `infrastructure.role_folder_structure` | Translation of `infrastructure.unknown_subdirectory` adapted to TS folder taxonomy (see 3.5). |
| InfrastructureTranslationStructurePolicy | `infrastructure.translation.structure` | Companion to the above for the Translation sub-tree. |

### 3.8 TypeScript-only registered rules to *remove* once parity lands

| TS class | TS rule ID | Why remove |
|---|---|---|
| PresentationControllersUseCaseReferencePolicy | `presentation.controllers.usecase_reference` | Swift defines this class but deprecated it and **does not register it** in `DefaultArchitecturePolicies.make()`. TS currently registers it. Once Stage 5 ships `presentation.usecase_reference` (broader, gated on all Presentation files), controllers would fire **both** rules. Remove from the TS default registry to mirror Swift behavior. Optionally keep the class exported. |

### 3.9 TypeScript-only `surfaceRuleID` emissions (not standalone rules)

| Parent policy | Primary rule ID | Secondary surface ID | Notes |
|---|---|---|---|
| DomainErrorsShapePolicy | `domain.errors.shape` | `domain.errors.surface` | Same policy emits both IDs; ID is observed in tests but not in the default registry list. |
| ApplicationErrorsShapePolicy | `application.errors.shape` | `application.errors.surface` | Same pattern. |

---

## 4. Translation calls

| # | Question | Proposed answer | Rationale |
|---|---|---|---|
| T1 | SwiftPM target-root rule | **Intentionally not applicable.** Documented; no port. | Swift rule reads `Package.swift` string literals; TS has no 1:1 analog and false-positive surface in package.json/vitest/jest configs is high. |
| T2 | What about `PresentationControllersUseCaseReferencePolicy`? | **Un-register from TS once the broad `presentation.usecase_reference` policy lands.** Optionally keep the class exported. Do not register both. | Mirrors Swift's deprecated-but-defined stance. Without this change, controllers fire both rules → duplicate diagnostics. |
| T3 | Should we add `infrastructure.unknown_subdirectory` directly? | **No.** Use the existing TS rules `infrastructure.role_folder_structure` + `infrastructure.translation.structure`. Add a parity test demonstrating equivalence; document the rename in README so users know to disable the TS IDs instead of the Swift one. | TS rules already supersede the Swift behavior with richer remediation. Adding a third rule duplicates coverage and confuses configuration. |
| T4 | TS list of technical-seam protocol suffixes | Use Swift list verbatim plus widened `*Interface` and `*Port` variants. Final list: `RepositoryProtocol, RepositoryInterface, RepositoryPort, GatewayProtocol, GatewayInterface, GatewayPort, ClientProtocol, ClientInterface, ClientPort, AdapterProtocol, AdapterInterface, AdapterPort, ProviderProtocol, ProviderInterface, ProviderPort, PortProtocol, Port, PortInterface`. | Swift code rarely uses `*Interface`/`*Port`; TS frequently does. Widening avoids missed seams. |
| T5 | TS list of ambiguous Application suffixes | Use Swift list verbatim: `Manager, Helper, Provider, Client, Coordinator, Adapter, Repository, Gateway`. | Strict parity; no widening. |
| T6 | TS list of forbidden UseCase platform types | Swap Swift platform/UI types for TS/Node/browser equivalents. See table 3.2 row `ApplicationUseCasesBoundaryTypeReferencePolicy`. | Swift list is iOS/macOS-specific; TS needs Node/browser/Express/Next equivalents. |
| T7 | TS DI/service-locator detection list (base names) | Translate Swift `technicalDependencySuffixes` + `singletonDependencyBaseNames` + `staticDependencyMemberNames` into TS shape. **Base names:** `Container, ServiceLocator, DependencyContainer, Resolver, Registry, Injector, AppGraph, Dependencies, DependencyValues`. **Static members:** `resolve, get, register, make, shared, default, live, instance, standard, current`. **Singleton base names (TS):** drop iOS/macOS classes; keep none initially. **Decorator/attribute names:** `Inject, Injected, Dependency, Provided`. | Translates Swift intent without inheriting Apple platform false-positive risk. |
| T8 | Where does construction-occurrence detection live? | New analyzer surface `constructionOccurrences: readonly { typeName, coordinate }[]` populated by the existing TS ts-morph analyzer, alongside the existing `constructorDeclarations` (which are *declarations*, not call sites). | Required by `application.services.usecase_construction` and is generally useful. Cheap addition with one new VO file. |
| T9 | Rich-remediation helper location | Promote a single shared helper `richRemediationMessage(...)` (currently named `appRemediationMessage` in `AppCompositionPolicies.ts` and `infrastructureStructuredRemediationMessage` in `InfrastructureArchitecturePolicies.ts`) and have all per-layer helpers delegate to it. Keep the per-layer helper names so existing call sites stay stable. | Single source of truth for the Swift-style 6-field format. |
| T10 | Where do the new `architecture.*` cross-architecture policies live in TS source? | Create `src/domain/policies/CrossArchitecturePolicies.ts`. Mirrors Swift's `CleanArchitectureBoundaryPolicies.swift` separation. Imports from existing per-layer files for shared helpers. | Keeps Domain/Application/Presentation/Infrastructure files focused on their own layer. |

---

## 5. Analyzer gaps

The TS analyzer already exposes (verified against `src/Domain/ValueObjects/ArchitectureFile.ts`):

- `typeReferences`, `topLevelDeclarations`, `topLevelValueDeclarations`, `nestedNominalDeclarations`
- `methodDeclarations`, `storedMemberDeclarations`, `computedPropertyDeclarations`
- `constructorDeclarations`, `memberCallOccurrences`, `operationalUseOccurrences`, `typedMemberOccurrences`
- `functionTypeOccurrences`, `identifierOccurrences`, `stringLiteralOccurrences`
- **`imports`** (note: property name is `imports`, **not** `importOccurrences` as the first draft of this doc said)
- `classification` flags for every Domain/Application/Infrastructure/Presentation/Test role
- `ProjectContext.declarations(named:)` with `roleFolder`, `layer`, `kind`

The TS analyzer is missing, and Stage 2 will add:

1. `constructionOccurrences` — `new Foo(...)` call sites, returning `{ typeName, coordinate }`.
2. `staticMemberAccessOccurrences` — property-access expressions where the base is a type identifier (e.g. `Foo.shared`, `Container.resolve` used as a *member-access value*, distinct from a member-call). Shape `{ baseName, memberName, coordinate }`.
3. `decoratorOccurrences` — TS decorator usages (`@Inject`, `@Injected`, `@Dependency`). Shape `{ name, coordinate }`.
4. `dependencyResolutionOccurrences` — composite VO derived from the above, surfacing the DI patterns the new rules need to flag. Shape `{ baseName, memberName?, coordinate }`.

Each will land with its own unit test in `tests/rules/TypeScriptProjectAnalyzer.test.ts` (or a new sibling test file) before being consumed by policies.

---

## 6. Remediation-rich rewrite scope (Stages 3–6)

### 6.1 Per-file scope

| File | Helper today | Action |
|---|---|---|
| DomainArchitecturePolicies.ts | `domainRemediationMessage(summary, destination)` — terse | Rewrite to 6-field rich format everywhere. Migrate all existing Domain message construction. |
| ApplicationArchitecturePolicies.ts | `applicationRemediationMessage(summary, destination)` — terse | Rewrite all terse call sites; existing rich helpers stay. |
| PresentationArchitecturePolicies.ts | `presentationRemediationMessage(summary, destination)` — terse | Rewrite all terse call sites. |
| InfrastructureArchitecturePolicies.ts | `infrastructureRemediationMessage(summary, destination)` — terse (the structured one is already rich) | Rewrite all terse call sites. |
| TestArchitecturePolicies.ts | mixed | Audit each helper. Bring any terse helpers to rich format. |
| AppCompositionPolicies.ts | `appRemediationMessage(...)` — already rich | No change. Promote to shared helper signature. |

### 6.2 Hard acceptance criterion (registered diagnostics)

> **Every registered policy diagnostic must either**
> 1. **use `richRemediationMessage(...)` (the shared 6-field helper), or**
> 2. **be explicitly exempted in §6.4 of this matrix with a reason.**

Stage 6 will add a sampling assertion test (`tests/rules/DiagnosticRemediationParity.test.ts`) that runs the full default registry against a fixture set covering every layer (Domain/Application/Presentation/Infrastructure/Tests/App) and asserts that emitted diagnostic messages contain all five canonical markers:

```
Likely categories:
signs:
architectural note:
destination:
explicit decomposition guidance:
```

with a documented allowlist for the exemptions in §6.4.

### 6.3 Existing rich-format coverage

48 existing call sites already use rich phrases (`Likely categories: ... signs: ... architectural note: ... destination: ... explicit decomposition guidance: ...`); the rewrite target is to make every registered diagnostic use that shape.

### 6.4 Documented exemptions

(Empty at v2 of this matrix. Stage 6 must either rewrite the terse helpers or move policies into this list with an explicit reason.)

### 6.5 README notes required

Stage 6 README pass must include:

1. Section listing the major rule families now mirrored from the Swift linter.
2. Section listing the TS-specific extras (`source_root.*`, `infrastructure.empty_directory`, `infrastructure.role_folder_structure`, `infrastructure.translation.structure`).
3. Note that `tests.swiftpm_test_targets_must_point_to_repo_test_root` is intentionally not ported — TS has no SwiftPM target-root concept.
4. Note about the `infrastructure.unknown_subdirectory` rename:
   > Because TypeScript translates Swift's `infrastructure.unknown_subdirectory` into the two TS-specific rules `infrastructure.role_folder_structure` and `infrastructure.translation.structure`, users porting a Swift `disabledRuleIDs: ["infrastructure.unknown_subdirectory"]` config will not suppress the equivalent TS behavior. Disable the two TS rule IDs explicitly, or disable the `infrastructure.` prefix.
5. Note about `presentation.controllers.usecase_reference` removal from the default registry (mirrors Swift deprecation).

---

## 7. Staged execution plan

1. **Stage 1 refresh — this document.** ✅ Complete (v3 with Swift 0.2.5 numbers, registered vs defined split that distinguishes `make()` from `makeProjectPolicies()`, repository role-fit added, controllers-usecase decision clarified, rich-remediation promoted to a hard acceptance criterion).
2. **Stage 2 — shared infrastructure.** Add `constructionOccurrences`, `staticMemberAccessOccurrences`, `decoratorOccurrences`, `dependencyResolutionOccurrences` to ArchitectureFile + ts-morph extractor + tests. Add the shared `richRemediationMessage` helper. Add shared constant lists (technical-seam suffixes, ambiguous-suffix list, forbidden-UseCase-boundary list, DI base names).
3. **Stage 3 — Domain & cross-architecture.** Decide source organization for `architecture.*` (proposal: new `CrossArchitecturePolicies.ts`). Implement `domain.dependency_resolution`, `architecture.service_role_placement`, `architecture.technical_seam_protocol_placement`. Rich-remediation pass on `DomainArchitecturePolicies.ts`. Register in `DefaultArchitecturePolicies.ts`. Add tests.
4. **Stage 4 — Application.** Implement `application.passive_dependency_resolution`, `application.ambiguous_role_name`, four Services rules (`port_protocol_reference`, `service_reference`, `usecase_construction`, `dependency_resolution`), three UseCases rules (`usecase_reference`, `dependency_resolution`, `boundary_type_reference`). Verify operation-shape and abstraction-delegation parity with Swift. Rich-remediation pass on `ApplicationArchitecturePolicies.ts`. Register. Tests.
5. **Stage 5 — Presentation.** Implement broad `presentation.usecase_reference`, `presentation.port_protocol_reference`, `presentation.composition_reference`, `presentation.dependency_resolution`. **Un-register** `PresentationControllersUseCaseReferencePolicy` from `DefaultArchitecturePolicies.ts` to mirror Swift. Add regression test that controllers emit only the broad rule. Rich-remediation pass on `PresentationArchitecturePolicies.ts`. Register the new policies. Tests.
6. **Stage 6 — Infrastructure / Tests / Docs final pass.** Implement `infrastructure.repositories.role_fit`. Parity test for `infrastructure.unknown_subdirectory` ↔ TS equivalence. Audit `TestArchitecturePolicies.ts` for any terse helpers. Diagnostic-remediation-parity sampling test from §6.2. README update from §6.5. Final `npm test` + `npm run build`.

**Cross-stage maintenance:** update `tests/rules/DefaultArchitecturePolicies.test.ts` expected-registry-names list at the end of *each* stage that adds or removes a registered policy (Stages 3, 4, 5, 6), not only at the end. Letting the registry test drift stale across stages turns the final pass into a debugging archaeology session.

Each stage ends with green tests so the tree is never half-broken.

---

## 8. Open questions / known limitations

- Static identifier-vs-value disambiguation in TS is lossy without a full type-checker pass; `staticMemberAccessOccurrences` will use ts-morph's syntactic type-name lookup and may need a follow-up if false positives appear in real codebases.
- `application.usecases.boundary_type_reference` depends on the layer/roleFolder being populated in `ProjectContext.declarations`. Confirmed populated in current TS analyzer; Stage 4 tests will pin the contract.
- The Swift `technicalSeamProtocolPlacement` rule treats `Domain/Protocols` as a valid destination only for `*RepositoryProtocol`. The TS translation will match that exactly, despite the widened `*Interface`/`*Port` accepted suffix list.
- `infrastructure.repositories.role_fit` depends on reliably walking the public-method signatures of repository concretes through `ProjectContext`. The repo-public-surface walk Swift uses (`repositoryPublicSurfaceLeaks`) may require a small helper added in Stage 6; the analyzer surfaces it needs (`methodDeclarations` with parameter/return type names, plus `context.declarations(named:)`) are already in place.

---

## 9. Change log

- **v3 (2026-05-12):** Precision-edit pass. Expanded the definition of *registered* in §1 to include `DefaultArchitecturePolicies.makeProjectPolicies()` and split the TS 107 total into 105 file policies + 2 project policies so the source of each registration is explicit. Renamed the §1 count column to "Defined standalone policy ruleIDs in source" to keep secondary `surfaceRuleID` strings (§3.9) from muddying the headline number. Rewrote the §2.3 controllers-policy note to drop the incorrect "opt-in via `disabledRuleIDs`" wording (`disabledRuleIDs` only suppresses; it cannot enable an unregistered rule). Corrected the §5 analyzer property name `nestedDeclarations` → `nestedNominalDeclarations`. Added a cross-stage maintenance line to §7 telling implementers to keep `DefaultArchitecturePolicies.test.ts` updated at the end of each stage that touches the registry, not only at the end of the parity work.
- **v2 (2026-05-11):** Refreshed against Swift `0.2.5`. Headline counts changed to 121 defined / 120 registered Swift; 109 defined / 107 registered TS. Added `infrastructure.repositories.role_fit` (gap count went 18 → 19). Split "defined" vs "registered" everywhere. Added §2.3 "Defined-but-not-registered Swift policies". Reclassified `presentation.controllers.usecase_reference` as deprecated/unregistered in Swift + over-registered in TS; added decision to un-register from TS in Stage 5 (§3.3, §3.8, §4 T2, §7 Stage 5). Added README disable-config note for the `infrastructure.unknown_subdirectory` rename (§6.5). Promoted rich-remediation to a hard acceptance criterion with a sampling test (§6.2). Corrected analyzer property name `imports` (was `importOccurrences`). Added §7 Stage 6 to include repository role-fit implementation. Added §3.8 (TS-registered rules to remove) and §3.9 (`surfaceRuleID` emissions).
- **v1 (2026-05-11):** Initial parity matrix. Reported 112 Swift / 109 TS / 18 Swift-only rule IDs. Did not distinguish defined-in-source from registered-by-default.
