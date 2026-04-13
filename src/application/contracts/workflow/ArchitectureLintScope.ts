export enum ArchitectureLintScopeContract {
  All = "all",
  Tests = "tests",
}

export const ArchitectureLintScope = ArchitectureLintScopeContract;

export function diagnosticRulePrefixForScope(
  scope: ArchitectureLintScopeContract,
): string | undefined {
  switch (scope) {
    case ArchitectureLintScopeContract.All:
      return undefined;
    case ArchitectureLintScopeContract.Tests:
      return "tests.";
  }
}
