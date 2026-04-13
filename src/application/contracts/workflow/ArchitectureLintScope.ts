export enum ArchitectureLintScope {
  All = "all",
  Tests = "tests",
}

export function diagnosticRulePrefixForScope(
  scope: ArchitectureLintScope,
): string | undefined {
  switch (scope) {
    case ArchitectureLintScope.All:
      return undefined;
    case ArchitectureLintScope.Tests:
      return "tests.";
  }
}
