import { endsWithTechnicalDependencySuffix } from "./TechnicalSeamSuffixes.ts";

/**
 * Type-shaped base names that denote a DI container / service locator / DI
 * registry when their static members are accessed. Mirrors Swift's
 * `technicalDependencySuffixes` filtered to the DI-base family, plus common
 * TypeScript variants. Used by the analyzer to populate
 * `dependencyResolutionOccurrences` and by Domain/Application/Presentation
 * dependency-resolution policies.
 */
export const DEPENDENCY_RESOLUTION_BASE_NAMES: ReadonlySet<string> = new Set([
  "Container",
  "ServiceLocator",
  "DependencyContainer",
  "Resolver",
  "Registry",
  "Injector",
  "AppGraph",
  "Dependencies",
  "DependencyValues",
]);

/**
 * Member names that, when accessed on a DI-shaped base, denote dependency
 * resolution or registration. Mirrors Swift's `staticDependencyMemberNames`
 * extended with `instance`, `standard`, and `current` for TS conventions.
 */
export const DEPENDENCY_RESOLUTION_MEMBER_NAMES: ReadonlySet<string> = new Set([
  "resolve",
  "get",
  "register",
  "make",
  "shared",
  "default",
  "live",
  "instance",
  "standard",
  "current",
]);

/**
 * Decorator names that denote dependency injection. Mirrors Swift's
 * `dependencyInjectionAttributeNames` extended with `Provided` for common
 * TS DI frameworks.
 */
export const DEPENDENCY_RESOLUTION_DECORATOR_NAMES: ReadonlySet<string> = new Set([
  "Inject",
  "Injected",
  "Dependency",
  "Provided",
]);

/**
 * TS-specific singleton base names. Intentionally left empty: the safe TS
 * analogs of Swift's `URLSession.shared`/`UserDefaults.standard` family are
 * `localStorage`, `window`, `document`, etc., none of which look like
 * type-shaped identifiers. Add later if real false-negatives appear.
 */
export const SINGLETON_DEPENDENCY_BASE_NAMES: ReadonlySet<string> = new Set();

/**
 * True if `baseName` looks like a DI container / service locator / DI registry.
 * Match rules:
 *   1. exact membership in DEPENDENCY_RESOLUTION_BASE_NAMES, or
 *   2. lowercase variants of those names treated as instances
 *      (`container`, `registry`, `resolver`, `injector`, `appGraph`,
 *      `dependencyContainer`, …), or
 *   3. suffix match on the technical-dependency suffix list.
 */
export function isDependencyResolutionBaseName(baseName: string): boolean {
  if (DEPENDENCY_RESOLUTION_BASE_NAMES.has(baseName)) {
    return true;
  }

  if (SINGLETON_DEPENDENCY_BASE_NAMES.has(baseName)) {
    return true;
  }

  if (DI_INSTANCE_LOWERCASE_NAMES.has(baseName)) {
    return true;
  }

  return endsWithTechnicalDependencySuffix(baseName);
}

export function isDependencyResolutionMemberName(memberName: string): boolean {
  return DEPENDENCY_RESOLUTION_MEMBER_NAMES.has(memberName);
}

export function isDependencyResolutionDecoratorName(name: string): boolean {
  return DEPENDENCY_RESOLUTION_DECORATOR_NAMES.has(name);
}

/**
 * True if a static-member or member-call access `baseName.memberName` is a
 * dependency-resolution access. Both halves must match the corresponding list:
 * `Container.resolve` → yes, `Container.fooBar` → no, `someService.resolve` →
 * no (unless `someService` matches a DI-instance name).
 */
export function isDependencyResolutionAccess(
  baseName: string,
  memberName: string,
): boolean {
  return (
    isDependencyResolutionBaseName(baseName) &&
    isDependencyResolutionMemberName(memberName)
  );
}

const DI_INSTANCE_LOWERCASE_NAMES: ReadonlySet<string> = new Set([
  "container",
  "registry",
  "resolver",
  "injector",
  "appGraph",
  "dependencyContainer",
  "serviceLocator",
  "dependencies",
  "dependencyValues",
]);
