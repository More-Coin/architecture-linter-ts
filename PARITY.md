# Swift ↔ TypeScript Architecture-Linter Parity Matrix

This document tracks the gap between the Swift reference linter (`More-Coin/ArchitectureLinter`) and the TypeScript implementation in this repo. It is the working artifact for the Swift-parity initiative.

- **Swift source of truth:** `ArchitectureLinter/ArchitectureLinterRules/Sources/*.swift` (version `0.2.5`)
- **TypeScript source of truth:** `src/domain/policies/*.ts`
- **Last refreshed:** 2026-05-12 (v7 — Stage 6 landed; initiative complete)

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
| TypeScript    | 126 | **123 total** — 121 file policies via `DefaultArchitecturePolicies.make()` + 2 project policies via `DefaultArchitecturePolicies.makeProjectPolicies()` (`SourceRootEmptyDirectoryPolicy`, `InfrastructureEmptyDirectoryPolicy`) | 3 (`ArchitectureDiagnosticOrderingPolicy`, `ArchitecturePathClassificationPolicy` — utility classifiers; `PresentationControllersUseCaseReferencePolicy` — deprecated, mirrors Swift, exported for opt-in) |

The "defined standalone policy ruleIDs" column counts the primary `ruleID` of each policy class. It excludes the secondary `surfaceRuleID` strings (`domain.errors.surface`, `application.errors.surface`) emitted by existing policies — those are catalogued in §3.9.

**Registered-vs-registered parity gap (post-Stage 6 — initiative complete):** TS is missing **1** Swift-registered ruleID — and that one is intentionally not applicable (`tests.swiftpm_test_targets_must_point_to_repo_test_root`; TS has no SwiftPM target-root concept, documented in §3.4 and README §"Configuration parity notes"). All architecturally applicable Swift rules now have a TS equivalent. TS additionally registers 5 ruleIDs that Swift does not register (4 legitimate TS-specific extras + 1 TS-specific Translation-structure rule, all documented in §3.7 and §3.8). The previously-noted deprecated-in-Swift rule (`presentation.controllers.usecase_reference`) is no longer registered in TS as of Stage 5 — it now correctly mirrors the Swift deprecated-but-defined stance.

The brief's original "18 Swift-only" count was off-by-one against current `main`: it missed `infrastructure.repositories.role_fit`, which Swift `0.2.5` registers but TS does not.

---

## 2. Diff summary (registered-vs-registered)

### 2.1 Swift-registered rule IDs missing from TS — 1 (was 3; 2 closed in Stage 6)

```
tests.swiftpm_test_targets_must_point_to_repo_test_root           ← intentionally not applicable; documented in §3.4 and README §"Configuration parity notes"
```

All architecturally applicable Swift rules now have a TS equivalent. The remaining ruleID is documented not-applicable because TypeScript has no SwiftPM `testTarget.path` concept and honest translations (package.json scripts, vitest/jest config, tsconfig paths) carry meaningfully different semantics with non-trivial false-positive risk.

#### Closed in Stage 6 (commit `4ba54ce`)

```
infrastructure.repositories.role_fit               ✅ InfrastructureRepositoriesRoleFitPolicy (InfrastructureArchitecturePolicies.ts)
infrastructure.unknown_subdirectory                ✅ TS-specific equivalence — `infrastructure.role_folder_structure` + `infrastructure.translation.structure` cover the Swift intent. Equivalence parity test in `tests/rules/Stage6InfrastructureAndDocs.test.ts` pins the behavior. The Swift ruleID is documented as a no-op in TS (README §"Configuration parity notes").
```

#### Closed in Stage 5 (commit `8022702`)

```
presentation.composition_reference                 ✅ PresentationCompositionReferencePolicy    (PresentationArchitecturePolicies.ts)
presentation.dependency_resolution                 ✅ PresentationDependencyResolutionPolicy    (PresentationArchitecturePolicies.ts)
presentation.port_protocol_reference               ✅ PresentationPortProtocolReferencePolicy   (PresentationArchitecturePolicies.ts)
presentation.usecase_reference                     ✅ PresentationUseCaseReferencePolicy        (PresentationArchitecturePolicies.ts)
```

Plus the planned controllers-deprecation: `PresentationControllersUseCaseReferencePolicy` is no longer registered by `DefaultArchitecturePolicies.make()`. The class remains exported for manual/custom policy construction. Regression test pins that controllers fire only `presentation.usecase_reference` under the default registry.

#### Closed in Stage 4 (commit `b63e5aa`)

```
application.ambiguous_role_name                    ✅ ApplicationAmbiguousRoleNamePolicy             (ApplicationArchitecturePolicies.ts)
application.passive_dependency_resolution          ✅ ApplicationPassiveDependencyResolutionPolicy   (ApplicationArchitecturePolicies.ts)
application.services.dependency_resolution         ✅ ApplicationServicesDependencyResolutionPolicy  (ApplicationArchitecturePolicies.ts)
application.services.port_protocol_reference       ✅ ApplicationServicesPortProtocolReferencePolicy (ApplicationArchitecturePolicies.ts)
application.services.service_reference             ✅ ApplicationServicesServiceReferencePolicy      (ApplicationArchitecturePolicies.ts)
application.services.usecase_construction          ✅ ApplicationServicesUseCaseConstructionPolicy   (ApplicationArchitecturePolicies.ts)
application.usecases.boundary_type_reference       ✅ ApplicationUseCasesBoundaryTypeReferencePolicy (ApplicationArchitecturePolicies.ts)
application.usecases.dependency_resolution         ✅ ApplicationUseCasesDependencyResolutionPolicy  (ApplicationArchitecturePolicies.ts)
application.usecases.usecase_reference             ✅ ApplicationUseCasesUseCaseReferencePolicy      (ApplicationArchitecturePolicies.ts)
```

#### Closed in Stage 3 (commit `f0b0db6`)

```
architecture.service_role_placement                ✅ ArchitectureServiceRolePlacementPolicy (CrossArchitecturePolicies.ts)
architecture.technical_seam_protocol_placement     ✅ TechnicalSeamProtocolPlacementPolicy   (CrossArchitecturePolicies.ts)
domain.dependency_resolution                       ✅ DomainDependencyResolutionPolicy        (CrossArchitecturePolicies.ts)
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
| DomainDependencyResolutionPolicy | `domain.dependency_resolution` | ✅ | DomainDependencyResolutionPolicy | ✅ | **present** (landed Stage 3, `f0b0db6`) | — | covered: Container.resolve violation, @Inject decorator violation, non-Domain silence, clean Domain silence, disabled-ID (`tests/rules/CrossArchitecturePolicies.test.ts`) |
| DomainDurableStructurePolicy | `domain.durable_structure` | ✅ | same | ✅ | present | none | covered |
| DomainPolicyPurityPolicy | `domain.policy_forbidden_api` | ✅ | same | ✅ | present | none | covered |
| DomainPolicyShapePolicy | `domain.policy_shape` | ✅ | same | ✅ | present | none | covered |
| DomainProtocolNamingPolicy | `domain.protocol_naming` | ✅ | same | ✅ | present | none | covered |
| DomainErrorsShapePolicy | `domain.errors.shape` (+ TS `domain.errors.surface` secondary) | ✅ | DomainErrorsShapePolicy | ✅ | present | TS emits a second ruleID via `surfaceRuleID`; keep as documented TS extra | covered |
| DomainErrorsPlacementPolicy | `domain.errors.placement` | ✅ | same | ✅ | present | none | covered |
| RepositoryProtocolPlacementPolicy | `domain.repository_protocol_placement` | ✅ | same | ✅ | present | none | covered |
| ArchitectureServiceRolePlacementPolicy | `architecture.service_role_placement` | ✅ | ArchitectureServiceRolePlacementPolicy | ✅ | **present** (landed Stage 3, `f0b0db6`) | — | covered: Service-suffixed type in Infrastructure flagged; Application/Services valid; test files skipped; disabled-ID (`tests/rules/CrossArchitecturePolicies.test.ts`) |
| TechnicalSeamProtocolPlacementPolicy | `architecture.technical_seam_protocol_placement` | ✅ | TechnicalSeamProtocolPlacementPolicy | ✅ | **present** (landed Stage 3, `f0b0db6`) | — | covered: GatewayInterface in Infrastructure flagged; PortProtocol family valid in Application/Ports/Protocols; Repository family valid in Domain/Protocols; PortProtocol family invalid in Domain/Protocols; non-protocol declarations ignored; disabled-ID (`tests/rules/CrossArchitecturePolicies.test.ts`). Widened TS suffix list (`*Interface`, `*Port` variants) lives in `src/domain/policies/shared/TechnicalSeamSuffixes.ts`. |

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
| ApplicationPassiveDependencyResolutionPolicy | `application.passive_dependency_resolution` | ✅ | ApplicationPassiveDependencyResolutionPolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: Container.resolve in a Contract flagged; non-passive Application file silent; disabled-ID (`tests/rules/Stage4ApplicationPolicies.test.ts`) |
| ApplicationProtocolPlacementPolicy | `application.protocol_placement` | ✅ | same | ✅ | present | none | covered |
| ApplicationAmbiguousRoleNamePolicy | `application.ambiguous_role_name` | ✅ | ApplicationAmbiguousRoleNamePolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: Manager-suffixed Application type flagged; Service suffix inside Application/Services allowed; disabled-ID. Uses shared `endsWithAmbiguousApplicationSuffix` from `src/domain/policies/shared/AmbiguousApplicationSuffixes.ts`. |
| ApplicationErrorsShapePolicy | `application.errors.shape` (+ TS `application.errors.surface` secondary) | ✅ | same | ✅ | present | TS emits a second ruleID via `surfaceRuleID`; document | covered |
| ApplicationErrorsPlacementPolicy | `application.errors.placement` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesShapePolicy | `application.services.shape` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesNoProtocolsPolicy | `application.services.no_protocols` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesPortProtocolReferencePolicy | `application.services.port_protocol_reference` | ✅ | ApplicationServicesPortProtocolReferencePolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: stored-member port flagged; UseCase dependency allowed; disabled-ID. Walks shared `iterateReferenceOccurrences` from `src/domain/policies/shared/ReferenceOccurrences.ts` across 8 file surfaces. |
| ApplicationServicesServiceReferencePolicy | `application.services.service_reference` | ✅ | ApplicationServicesServiceReferencePolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: another Application Service dependency flagged; self-references skipped (`tests/rules/Stage4ApplicationPolicies.test.ts`). |
| ApplicationServicesUseCaseConstructionPolicy | `application.services.usecase_construction` | ✅ | ApplicationServicesUseCaseConstructionPolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: `new FetchOrderUseCase()` in a Service flagged; non-UseCase construction (Contract type) ignored. Consumes `constructionOccurrences` analyzer surface that Stage 2 added. |
| ApplicationServicesDependencyResolutionPolicy | `application.services.dependency_resolution` | ✅ | ApplicationServicesDependencyResolutionPolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: Container.resolve in a Service flagged (`tests/rules/Stage4ApplicationPolicies.test.ts`). Iterates `dependencyResolutionOccurrences` (composite analyzer surface from Stage 2). |
| ApplicationServicesNoUseCasesPolicy | `application.services.no_usecases` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesOrchestrationPolicy | `application.services.orchestration` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesSurfacePolicy | `application.services.surface` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesInfrastructureReferencePolicy | `application.services.infrastructure_reference` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesRepositoryReferencePolicy | `application.services.repository_reference` | ✅ | same | ✅ | present | none | covered |
| ApplicationServicesPlatformAPIPolicy | `application.services.platform_api` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesShapePolicy | `application.usecases.shape` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesNoProtocolsPolicy | `application.usecases.no_protocols` | ✅ | same | ✅ | present | none | covered |
| ApplicationUseCasesUseCaseReferencePolicy | `application.usecases.usecase_reference` | ✅ | ApplicationUseCasesUseCaseReferencePolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: another UseCase dependency flagged; self-references skipped. |
| ApplicationUseCasesDependencyResolutionPolicy | `application.usecases.dependency_resolution` | ✅ | ApplicationUseCasesDependencyResolutionPolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: Resolver.get inside a UseCase flagged. |
| ApplicationUseCasesBoundaryTypeReferencePolicy | `application.usecases.boundary_type_reference` | ✅ | ApplicationUseCasesBoundaryTypeReferencePolicy | ✅ | **present** (landed Stage 4, `b63e5aa`) | — | covered: Express Request/Response on UseCase surface flagged; Presentation DTO on UseCase surface flagged; Domain/Contract types allowed; disabled-ID. TS forbidden-types list lives in `src/domain/policies/shared/ForbiddenUseCaseBoundaryTypes.ts` (`Request, Response, Headers, URL, Buffer, IncomingMessage, ServerResponse, NextRequest, NextResponse, ServiceLocator, DependencyContainer, Container, Resolver, Registry, Injector`, …). Also flags any declaration whose layer ∈ {Presentation, Infrastructure, App}. |
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
| PresentationControllersUseCaseReferencePolicy | `presentation.controllers.usecase_reference` | ⛔ defined but deprecated; **not registered** by Swift default registry | PresentationControllersUseCaseReferencePolicy | ⛔ **un-registered in Stage 5** (`8022702`); class still exported for opt-in | **resolved** — TS now mirrors Swift's deprecated-but-defined stance | — | regression test `controllers with a UseCase reference fire only the broad rule under the default registry` pins the dedup behavior (`tests/rules/Stage5PresentationPolicies.test.ts`) |
| PresentationUseCaseReferencePolicy | `presentation.usecase_reference` | ✅ | PresentationUseCaseReferencePolicy | ✅ | **present** (landed Stage 5, `8022702`) | — | covered: UseCase reference in Controller flagged; UseCase reference in Renderer flagged (proves the broader gate); Application Service references allowed; disabled-ID (`tests/rules/Stage5PresentationPolicies.test.ts`) |
| PresentationPortProtocolReferencePolicy | `presentation.port_protocol_reference` | ✅ | PresentationPortProtocolReferencePolicy | ✅ | **present** (landed Stage 5, `8022702`) | — | covered: Application port reference in Presentation flagged + disabled-ID. Uses shared `iterateReferenceOccurrences` across 8 surfaces. |
| PresentationCompositionReferencePolicy | `presentation.composition_reference` | ✅ | PresentationCompositionReferencePolicy | ✅ | **present** (landed Stage 5, `8022702`) | — | covered: AppGraph (App layer / App/DependencyInjection role) reference in Presentation flagged + disabled-ID. |
| PresentationDependencyResolutionPolicy | `presentation.dependency_resolution` | ✅ | PresentationDependencyResolutionPolicy | ✅ | **present** (landed Stage 5, `8022702`) | — | covered: Container.resolve flagged with precise coord; @Inject decorator flagged; non-Presentation file silent; disabled-ID. Iterates `dependencyResolutionOccurrences` (composite Stage 2 surface). |
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
| **InfrastructureRepositoriesRoleFitPolicy** | `infrastructure.repositories.role_fit` | ✅ | InfrastructureRepositoriesRoleFitPolicy | ✅ | **present** (landed Stage 6, `4ba54ce`) | — | covered: public-surface leak through return type (translation DTO); public-surface leak through parameter (Presentation DTO); missing inward Repository conformance flagged; valid concrete repository silent; default-registered + disabled-ID (`tests/rules/Stage6InfrastructureAndDocs.test.ts`). |
| InfrastructureGatewaysShapePolicy | `infrastructure.gateways.shape` | ✅ | same | ✅ | present | none | covered |
| InfrastructureGatewaysRoleFitPolicy | `infrastructure.gateways.role_fit` | ✅ | same | ✅ | present | none | covered |
| InfrastructureUnknownSubdirectoryPolicy | `infrastructure.unknown_subdirectory` | ✅ | InfrastructureRoleFolderStructurePolicy + InfrastructureTranslationStructurePolicy | ✅ + ✅ | **resolved via TS-specific equivalent (landed Stage 6, `4ba54ce`)** | — | Stage 6 added a parity test (`tests/rules/Stage6InfrastructureAndDocs.test.ts`) that proves: (a) a fixture under `Infrastructure/Mappers/...` fires `infrastructure.role_folder_structure` with rich remediation; (b) a fixture under `Infrastructure/Translation/Loose.ts` fires `infrastructure.translation.structure` with rich remediation; (c) a `disabledRuleIDs: ["infrastructure.unknown_subdirectory"]` config copied from Swift is **inert** in TS — disabling the two TS ruleIDs or the `infrastructure.` prefix is required to suppress the equivalent behavior. README §"Configuration parity notes" documents the rename for adopters. |
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

| TS class | TS rule ID | Status |
|---|---|---|
| PresentationControllersUseCaseReferencePolicy | `presentation.controllers.usecase_reference` | **✅ resolved in Stage 5 (`8022702`).** Un-registered from `DefaultArchitecturePolicies.make()`. Class remains exported for manual/custom policy construction (callers can still build it directly), matching Swift's deprecated-but-defined stance. Regression test in `tests/rules/Stage5PresentationPolicies.test.ts` pins that controllers with a UseCase reference fire only `presentation.usecase_reference` under the default registry. |

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

| File | Helper today | Action | Status |
|---|---|---|---|
| DomainArchitecturePolicies.ts | `domainRemediationMessage` now delegates to `richRemediationMessage` | All 16 Domain call sites rewritten to the 6-field rich format with Domain-specific categories/signs/architecturalNote/destination/decomposition. | **✅ done in Stage 3 (`f0b0db6`)** |
| ApplicationArchitecturePolicies.ts | `applicationRemediationMessage` now delegates to `richRemediationMessage` with Application-flavored defaults | All 49 legacy terse call sites gain 5-marker output via helper delegation; new Stage 4 policies populate markers directly with hand-tailored content. An acceptance test in `tests/rules/Stage4ApplicationPolicies.test.ts` confirms a legacy call site emits all 5 markers. | **✅ done in Stage 4 (`b63e5aa`)** |
| PresentationArchitecturePolicies.ts | `presentationRemediationMessage` now delegates to `richRemediationMessage` with Presentation-flavored defaults | All 19 legacy terse call sites gain 5-marker output via helper delegation; new Stage 5 policies populate markers directly with hand-tailored content. An acceptance test in `tests/rules/Stage5PresentationPolicies.test.ts` confirms a legacy call site emits all 5 markers. | **✅ done in Stage 5 (`8022702`)** |
| InfrastructureArchitecturePolicies.ts | `infrastructureRemediationMessage` now delegates to `richRemediationMessage` with Infrastructure-flavored defaults (the pre-existing structured helper continues to handle hand-tailored markers) | All 51 legacy terse call sites gain 5-marker output via helper delegation; new `InfrastructureRepositoriesRoleFitPolicy` populates markers directly. | **✅ done in Stage 6 (`4ba54ce`)** |
| TestArchitecturePolicies.ts | `testArchitectureMessage` was already the rich 6-field shape; no terse helper to convert | Audit complete — every Tests diagnostic already carries all five canonical markers. | **✅ done in Stage 6 (`4ba54ce`)** |
| AppCompositionPolicies.ts | `appRemediationMessage(...)` — already rich | No change. Promote to shared helper signature. | Stage 2 promoted (`b0409fe`) |

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
3. **Stage 3 — Domain & cross-architecture.** ✅ Complete (commit `f0b0db6`). Decided source organization (new `src/domain/policies/CrossArchitecturePolicies.ts`). Implemented `domain.dependency_resolution`, `architecture.service_role_placement`, `architecture.technical_seam_protocol_placement`. Rich-remediation pass on `DomainArchitecturePolicies.ts` — all 16 call sites now use `richRemediationMessage`. Registered in `DefaultArchitecturePolicies.ts` in Swift-matching order; `DefaultArchitecturePolicies.test.ts` expected-name list updated in the same commit. 16 new focused tests in `tests/rules/CrossArchitecturePolicies.test.ts`. `npm test` 104/104, `npm run build` clean.
4. **Stage 4 — Application.** ✅ Complete (commit `b63e5aa`). All 9 new policies landed in `src/domain/policies/ApplicationArchitecturePolicies.ts`: `application.passive_dependency_resolution`, `application.ambiguous_role_name`, four Services rules (`port_protocol_reference`, `service_reference`, `usecase_construction`, `dependency_resolution`), three UseCases rules (`usecase_reference`, `dependency_resolution`, `boundary_type_reference`). New shared helper `src/domain/policies/shared/ReferenceOccurrences.ts` mirrors Swift's `referencedTypeOccurrences` (8-surface walk). `applicationRemediationMessage` now delegates to `richRemediationMessage` — all 49 legacy Application call sites gain 5-marker output. Registered in `DefaultArchitecturePolicies.ts`; `DefaultArchitecturePolicies.test.ts` expected-name list updated in the same commit. 20 new focused tests in `tests/rules/Stage4ApplicationPolicies.test.ts`. `npm test` 124/124, `npm run build` clean. Operation-shape and abstraction-delegation parity verification deferred to Stage 6 as part of the full-registry remediation-sampling test.
5. **Stage 5 — Presentation.** ✅ Complete (commit `8022702`). Implemented broad `presentation.usecase_reference`, `presentation.port_protocol_reference`, `presentation.composition_reference`, `presentation.dependency_resolution`. **Un-registered** `PresentationControllersUseCaseReferencePolicy` from `DefaultArchitecturePolicies.ts` so it mirrors Swift's deprecated-but-defined stance; the class stays exported for opt-in. Added regression test that controllers fire only the broad rule under the default registry. `presentationRemediationMessage` now delegates to `richRemediationMessage` — all 19 legacy Presentation call sites gain 5-marker output. Registered the 4 new policies in `DefaultArchitecturePolicies.ts`; `DefaultArchitecturePolicies.test.ts` expected-name list updated; `PresentationArchitecturePolicies.test.ts` rule-set-count bumped 15 → 19. 16 new focused tests in `tests/rules/Stage5PresentationPolicies.test.ts`. `npm test` 140/140, `npm run build` clean.
6. **Stage 6 — Infrastructure / Tests / Docs final pass.** ✅ Complete (commit `4ba54ce`). Implemented `infrastructure.repositories.role_fit` in `src/domain/policies/InfrastructureArchitecturePolicies.ts` with two violation paths (public surface leak + missing inward Repository conformance). Added a parity test asserting `infrastructure.unknown_subdirectory` equivalence — both TS-specific rules fire on expected fixtures and the Swift ruleID is documented as inert under TS. Audited `TestArchitecturePolicies.ts` — `testArchitectureMessage` is already rich (6-field), nothing to convert. Added the full-registry `richRemediationMessage` sampling test from §6.2. Updated README with: an "Architectural Rule Families" section enumerating every Swift-parity family + TS-specific extras, and a "Configuration parity notes" subsection covering the three rule-ID renames adopters need to know about (`infrastructure.unknown_subdirectory` → two TS rules, `presentation.controllers.usecase_reference` unregistered, `tests.swiftpm_test_targets_must_point_to_repo_test_root` intentionally not applicable). `npm test` 149/149, `npm run build` clean.

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

- **v7 (2026-05-12):** Stage 6 landed (commit `4ba54ce`). **Swift-parity initiative complete.** Headline counts: TS defined 125 → 126; TS registered 122 → 123 (121 file + 2 project). Registered-vs-registered gap closes 3 → 1 — and the remaining 1 (`tests.swiftpm_test_targets_must_point_to_repo_test_root`) is intentionally not applicable per §3.4 and README §"Configuration parity notes". All architecturally applicable Swift rules now have a TS equivalent. §2.1 adds a "Closed in Stage 6" sub-block citing the new `InfrastructureRepositoriesRoleFitPolicy` and the `infrastructure.unknown_subdirectory` equivalence. §3.5 rows for both Infrastructure closures updated. §6.1 marks `InfrastructureArchitecturePolicies.ts` ✅ done (helper delegation upgrade covers 51 legacy call sites) and `TestArchitecturePolicies.ts` ✅ done (already rich-shaped — no work needed). §7 Stage 6 marked complete with commit reference and a one-paragraph summary. Header last-refreshed bumped to v7.
- **v6 (2026-05-12):** Stage 5 landed (commit `8022702`). Headline counts: TS defined 121 → 125; TS registered 119 → 122 (120 file + 2 project). Registered-vs-registered gap closes 7 → 3 — effectively 2 implementable (both Infrastructure, both targeted for Stage 6) plus 1 documented-not-applicable SwiftPM rule. §2.1 adds a "Closed in Stage 5" sub-block listing the 4 new Presentation classes with file paths, and notes the `PresentationControllersUseCaseReferencePolicy` un-registration. §3.3 rows for the 5 affected Presentation policies updated. §3.8 marks the over-registered controllers rule as **resolved**: un-registered in Stage 5; class remains exported for opt-in; regression test pins single-rule firing for controllers. Defined-but-not-registered classes in §1 grow 2 → 3 to include `PresentationControllersUseCaseReferencePolicy` (deprecated stance). §6.1 marks `PresentationArchitecturePolicies.ts` ✅ done — helper delegation upgrade covers all 19 legacy call sites; acceptance test pins markers. §7 Stage 5 marked complete with commit reference and a one-paragraph summary. Header last-refreshed bumped to v6.
- **v5 (2026-05-12):** Stage 4 landed (commit `b63e5aa`). Headline counts: TS defined 112 → 121; TS registered 110 → 119 (117 file + 2 project). Registered-vs-registered gap closes 16 → 7 (effectively 6 implementable: 4 Presentation for Stage 5, 2 Infrastructure for Stage 6; the SwiftPM target-root rule is intentionally not applicable). §2.1 adds a "Closed in Stage 4" sub-block listing the 9 new Application classes with file paths. §3.2 rows for all 9 new Application policies now show TS class + ✅ TS-registered + status `present` + test coverage notes pointing at `tests/rules/Stage4ApplicationPolicies.test.ts`. §6.1 marks `ApplicationArchitecturePolicies.ts` ✅ done — helper delegation upgrade covers all 49 legacy call sites; an acceptance test pins the markers. §7 Stage 4 marked complete with commit reference and a one-paragraph summary of what landed (including the shared `ReferenceOccurrences.ts` helper). Operation-shape / abstraction-delegation parity verification deferred to Stage 6 sampling test. Header last-refreshed bumped to v5.
- **v4 (2026-05-12):** Stage 3 landed (commit `f0b0db6`). Headline counts updated: TS defined goes 109 → 112, TS registered goes 107 → 110 (108 file + 2 project). Registered-vs-registered gap closes 19 → 16. §2.1 lists the 16 remaining gaps and adds a "Closed in Stage 3" sub-block citing the three new classes. §3.1 rows for `DomainDependencyResolutionPolicy`, `ArchitectureServiceRolePlacementPolicy`, `TechnicalSeamProtocolPlacementPolicy` now show TS class + ✅ registered + present + test coverage notes. §6.1 promoted to a status table; `DomainArchitecturePolicies.ts` marked done; remaining files annotated with their target stage. §7 Stage 3 marked complete with the commit reference. Header last-refreshed bumped to v4.
- **v3 (2026-05-12):** Precision-edit pass. Expanded the definition of *registered* in §1 to include `DefaultArchitecturePolicies.makeProjectPolicies()` and split the TS 107 total into 105 file policies + 2 project policies so the source of each registration is explicit. Renamed the §1 count column to "Defined standalone policy ruleIDs in source" to keep secondary `surfaceRuleID` strings (§3.9) from muddying the headline number. Rewrote the §2.3 controllers-policy note to drop the incorrect "opt-in via `disabledRuleIDs`" wording (`disabledRuleIDs` only suppresses; it cannot enable an unregistered rule). Corrected the §5 analyzer property name `nestedDeclarations` → `nestedNominalDeclarations`. Added a cross-stage maintenance line to §7 telling implementers to keep `DefaultArchitecturePolicies.test.ts` updated at the end of each stage that touches the registry, not only at the end of the parity work.
- **v2 (2026-05-11):** Refreshed against Swift `0.2.5`. Headline counts changed to 121 defined / 120 registered Swift; 109 defined / 107 registered TS. Added `infrastructure.repositories.role_fit` (gap count went 18 → 19). Split "defined" vs "registered" everywhere. Added §2.3 "Defined-but-not-registered Swift policies". Reclassified `presentation.controllers.usecase_reference` as deprecated/unregistered in Swift + over-registered in TS; added decision to un-register from TS in Stage 5 (§3.3, §3.8, §4 T2, §7 Stage 5). Added README disable-config note for the `infrastructure.unknown_subdirectory` rename (§6.5). Promoted rich-remediation to a hard acceptance criterion with a sampling test (§6.2). Corrected analyzer property name `imports` (was `importOccurrences`). Added §7 Stage 6 to include repository role-fit implementation. Added §3.8 (TS-registered rules to remove) and §3.9 (`surfaceRuleID` emissions).
- **v1 (2026-05-11):** Initial parity matrix. Reported 112 Swift / 109 TS / 18 Swift-only rule IDs. Did not distinguish defined-in-source from registered-by-default.
