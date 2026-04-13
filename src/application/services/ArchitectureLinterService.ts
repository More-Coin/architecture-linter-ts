import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ArchitectureLintResultContract } from "../contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLintWorkflowContract } from "../contracts/workflow/ArchitectureLintWorkflowContract.ts";
import { LintProjectUseCase } from "../use-cases/LintProjectUseCase.ts";

export class ArchitectureLinterService {
  private readonly lintProjectUseCase: LintProjectUseCase;

  constructor(lintProjectUseCase: LintProjectUseCase) {
    this.lintProjectUseCase = lintProjectUseCase;
  }

  execute(
    workflow: ArchitectureLintWorkflowContract,
  ): ArchitectureLintResultContract {
    return this.lint(this.normalizedWorkflow(workflow));
  }

  private normalizedWorkflow(
    workflow: ArchitectureLintWorkflowContract,
  ): ArchitectureLintWorkflowContract {
    const diagnosticRulePrefix = workflow.diagnosticRulePrefix;

    return {
      rootURL: this.standardizedFileURL(workflow.rootURL),
      ...(diagnosticRulePrefix ? { diagnosticRulePrefix } : {}),
    };
  }

  private lint(
    workflow: ArchitectureLintWorkflowContract,
  ): ArchitectureLintResultContract {
    return this.lintProjectUseCase.execute(workflow);
  }

  private standardizedFileURL(url: URL): URL {
    if (url.protocol !== "file:") {
      return new URL(url.href);
    }

    const standardizedPath = path.normalize(fileURLToPath(url));
    return pathToFileURL(standardizedPath);
  }
}
