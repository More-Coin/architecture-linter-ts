import type { ArchitectureLintResult } from "../../application/contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLinterStructuredErrorProtocol } from "../../application/contracts/errors/ArchitectureLinterStructuredErrorProtocol.ts";
import type { ArchitectureDiagnostic } from "../../domain/value-objects/ArchitectureDiagnostic.ts";
import { ARCHITECTURE_LINTER_HELP_LINES } from "../ArchitectureLinterCLIUsage.ts";

export class ArchitectureLinterRenderer {
  renderHelp(): number {
    for (const line of ARCHITECTURE_LINTER_HELP_LINES) {
      console.log(line);
    }

    return 0;
  }

  render(result: ArchitectureLintResult): number {
    for (const diagnostic of result.diagnostics) {
      console.log(this.renderedDiagnostic(diagnostic));
    }

    return result.diagnostics.length === 0 ? 0 : 1;
  }

  renderError(error: unknown): number {
    if (this.isStructuredError(error)) {
      console.error(error.message);
      if (error.details) {
        console.error(error.details);
      }
      return 1;
    }

    if (error instanceof Error) {
      console.error(error.message);
      return 1;
    }

    console.error(String(error));
    return 1;
  }

  private renderedDiagnostic(diagnostic: ArchitectureDiagnostic): string {
    return `${diagnostic.path}:${diagnostic.line}:${diagnostic.column}: [${diagnostic.ruleID}] ${diagnostic.message}`;
  }

  private isStructuredError(
    error: unknown,
  ): error is ArchitectureLinterStructuredErrorProtocol {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    return (
      "code" in error &&
      typeof error.code === "string" &&
      "message" in error &&
      typeof error.message === "string" &&
      "retryable" in error &&
      typeof error.retryable === "boolean"
    );
  }
}
