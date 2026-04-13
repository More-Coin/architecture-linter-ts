import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ArchitectureLintCommandContract } from "../contracts/commands/ArchitectureLintCommandContract.ts";
import type { ArchitectureLintResultContract } from "../contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLintWorkflowContract } from "../contracts/workflow/ArchitectureLintWorkflowContract.ts";
import { diagnosticRulePrefixForScope } from "../contracts/workflow/ArchitectureLintScope.ts";
import type { ArchitectureLinterConfigurationPortProtocol } from "../ports/protocols/ArchitectureLinterConfigurationPortProtocol.ts";
import { LintProjectUseCase } from "../use-cases/LintProjectUseCase.ts";

export class ArchitectureLinterService {
  private readonly lintProjectUseCase: LintProjectUseCase;
  private readonly configurationPort: ArchitectureLinterConfigurationPortProtocol;

  constructor(
    lintProjectUseCase: LintProjectUseCase,
    configurationPort: ArchitectureLinterConfigurationPortProtocol,
  ) {
    this.lintProjectUseCase = lintProjectUseCase;
    this.configurationPort = configurationPort;
  }

  execute(
    command: ArchitectureLintCommandContract,
  ): ArchitectureLintResultContract {
    const configuration = this.configurationPort.loadConfiguration(command);

    return this.lint(
      this.normalizedWorkflow({
        rootURL: command.rootURL,
        configuration,
        diagnosticRulePrefix: diagnosticRulePrefixForScope(command.scope),
      }),
    );
  }

  private normalizedWorkflow(
    workflow: ArchitectureLintWorkflowContract,
  ): ArchitectureLintWorkflowContract {
    const diagnosticRulePrefix = workflow.diagnosticRulePrefix;

    return {
      rootURL: this.standardizedFileURL(workflow.rootURL),
      configuration: workflow.configuration,
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
