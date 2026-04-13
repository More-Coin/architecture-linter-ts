export interface ArchitectureDiagnostic {
  readonly ruleID: string;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}
