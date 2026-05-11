/**
 * Type names whose appearance on an Application UseCase boundary signals an
 * outer-layer, concrete, or platform/transport leak.
 *
 * Translation of Swift's `forbiddenUseCasePlatformTypes`: the Swift list is
 * iOS/macOS-specific (URLRequest, NSWorkspace, UIView, …). The TS list covers
 * Node/browser/Express/Next transport types plus the DI-container family.
 *
 * Used by `application.usecases.boundary_type_reference`. The policy also
 * resolves declarations and flags any whose layer is Presentation,
 * Infrastructure, or App; this list catches *named* platform types that don't
 * resolve to in-repo declarations.
 */
export const FORBIDDEN_USECASE_BOUNDARY_TYPES: ReadonlySet<string> = new Set([
  // Web fetch / WHATWG
  "Request",
  "Response",
  "Headers",
  "Body",
  "URL",
  "URLSearchParams",
  "FormData",
  "FetchResponse",
  "ReadableStream",
  "WritableStream",
  // Node runtime
  "Buffer",
  "IncomingMessage",
  "ServerResponse",
  // Express
  "Express.Request",
  "Express.Response",
  // Next.js
  "NextRequest",
  "NextResponse",
  // DI containers / service locators
  "ServiceLocator",
  "DependencyContainer",
  "Container",
  "Resolver",
  "Registry",
  "Injector",
]);

export function isForbiddenUseCaseBoundaryTypeName(name: string): boolean {
  return FORBIDDEN_USECASE_BOUNDARY_TYPES.has(name);
}
