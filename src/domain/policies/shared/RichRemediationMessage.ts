/**
 * Canonical Swift-parity remediation message format.
 *
 * Every registered architectural diagnostic should compose its message through
 * this helper unless it is explicitly exempted in `PARITY.md` §6.4. The shape
 * deliberately mirrors `cleanArchitectureBoundaryMessage` in the Swift
 * reference linter, so users see the same five remediation markers
 * (`Likely categories`, `signs`, `architectural note`, `destination`,
 * `explicit decomposition guidance`) across both implementations.
 */
export interface RichRemediationMessageInput {
  readonly summary: string;
  readonly categories: readonly string[];
  readonly signs: readonly string[];
  readonly architecturalNote: string;
  readonly destination: string;
  readonly decomposition: string;
}

export function richRemediationMessage(
  input: RichRemediationMessageInput,
): string {
  return `${input.summary} Likely categories: ${input.categories.join("; ")}; signs: ${input.signs.join("; ")}; architectural note: ${input.architecturalNote}; destination: ${input.destination}; explicit decomposition guidance: ${input.decomposition}`;
}

export const RICH_REMEDIATION_MARKERS = Object.freeze([
  "Likely categories:",
  "signs:",
  "architectural note:",
  "destination:",
  "explicit decomposition guidance:",
] as const);
