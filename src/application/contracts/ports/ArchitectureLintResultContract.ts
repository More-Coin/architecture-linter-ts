import type { ArchitectureDiagnostic } from "../../../Domain/ValueObjects/ArchitectureDiagnostic.ts";

export type ArchitectureLintResultContract = Readonly<{
  diagnostics: readonly ArchitectureDiagnostic[];
}>;
