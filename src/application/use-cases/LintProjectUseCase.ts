import type { ArchitectureLintResultContract } from "../contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLintWorkflowContract } from "../contracts/workflow/ArchitectureLintWorkflowContract.ts";
import type { ArchitectureLintPortProtocol } from "../ports/protocols/ArchitectureLintPortProtocol.ts";

export class LintProjectUseCase {
  private readonly lintPort: ArchitectureLintPortProtocol;

  constructor(lintPort: ArchitectureLintPortProtocol) {
    this.lintPort = lintPort;
  }

  execute(
    workflow: ArchitectureLintWorkflowContract,
  ): ArchitectureLintResultContract {
    const result = this.lintPort.lintProject(workflow.rootURL);
    const { diagnosticRulePrefix } = workflow;
    if (!diagnosticRulePrefix) {
      return result;
    }

    const filteredDiagnostics = result.diagnostics.filter((diagnostic) =>
      diagnostic.ruleID.startsWith(diagnosticRulePrefix),
    );

    return {
      diagnostics: filteredDiagnostics,
    };
  }
}
