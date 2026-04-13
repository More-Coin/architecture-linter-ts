import type { ArchitectureDiagnostic } from "../value-objects/ArchitectureDiagnostic.ts";

export class ArchitectureDiagnosticOrderingPolicy {
  ordered(
    diagnostics: readonly ArchitectureDiagnostic[],
  ): ArchitectureDiagnostic[] {
    return [...diagnostics].sort((lhs, rhs) =>
      this.areInIncreasingOrder(lhs, rhs),
    );
  }

  private areInIncreasingOrder(
    lhs: ArchitectureDiagnostic,
    rhs: ArchitectureDiagnostic,
  ): number {
    if (lhs.path !== rhs.path) {
      return lhs.path.localeCompare(rhs.path);
    }
    if (lhs.line !== rhs.line) {
      return lhs.line - rhs.line;
    }
    if (lhs.column !== rhs.column) {
      return lhs.column - rhs.column;
    }
    if (lhs.ruleID !== rhs.ruleID) {
      return lhs.ruleID.localeCompare(rhs.ruleID);
    }

    return lhs.message.localeCompare(rhs.message);
  }
}
