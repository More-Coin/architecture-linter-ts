import type { ArchitectureDiagnostic } from "../../../domain/value-objects/ArchitectureDiagnostic.ts";

export interface ArchitectureLintResultContract {
  readonly diagnostics: readonly ArchitectureDiagnostic[];
}

export type ArchitectureLintResult = ArchitectureLintResultContract;
