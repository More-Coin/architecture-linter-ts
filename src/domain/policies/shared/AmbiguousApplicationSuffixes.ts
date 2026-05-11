/**
 * Ambiguous Application-layer name suffixes flagged by
 * `application.ambiguous_role_name`. Lifted verbatim from Swift's
 * `applicationAmbiguousSuffixes`. The TS translation does not widen this
 * list — Application classification is shared between both implementations.
 */
export const AMBIGUOUS_APPLICATION_SUFFIXES = Object.freeze([
  "Manager",
  "Helper",
  "Provider",
  "Client",
  "Coordinator",
  "Adapter",
  "Repository",
  "Gateway",
] as const);

export function endsWithAmbiguousApplicationSuffix(name: string): boolean {
  return AMBIGUOUS_APPLICATION_SUFFIXES.some((suffix) => name.endsWith(suffix));
}
