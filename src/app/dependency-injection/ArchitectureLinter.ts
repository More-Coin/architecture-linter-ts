import type { ArchitectureLintResult } from "../../application/contracts/ports/ArchitectureLintResultContract.ts";
import {
  ArchitectureLintScope,
  diagnosticRulePrefixForScope,
} from "../../application/contracts/workflow/ArchitectureLintScope.ts";
import { ArchitectureLinterService } from "../../application/services/ArchitectureLinterService.ts";
import type { SourceFileDiscoveryPortProtocol } from "../../application/ports/protocols/SourceFileDiscoveryPortProtocol.ts";
import { LintProjectUseCase } from "../../application/use-cases/LintProjectUseCase.ts";
import type { ArchitectureLinterConfiguration } from "../configuration/ArchitectureLinterConfiguration.ts";
import type { ArchitecturePolicyProtocol } from "../../domain/protocols/ArchitecturePolicyProtocol.ts";
import { SourceFileDiscoveryGateway } from "../../infrastructure/gateways/SourceFileDiscoveryGateway.ts";
import { ArchitectureLinterPortAdapter } from "../../infrastructure/port-adapters/ArchitectureLinterPortAdapter.ts";

export class ArchitectureLinter {
  private readonly service: ArchitectureLinterService;

  constructor(input: {
    configuration: ArchitectureLinterConfiguration;
    policies: readonly ArchitecturePolicyProtocol[];
    sourceFileDiscovery?: SourceFileDiscoveryPortProtocol;
  }) {
    const lintPortAdapter = new ArchitectureLinterPortAdapter({
      configuration: input.configuration,
      policies: input.policies,
      sourceFileDiscovery:
        input.sourceFileDiscovery ??
        new SourceFileDiscoveryGateway(input.configuration.sourceExtensions),
    });
    const lintProjectUseCase = new LintProjectUseCase(lintPortAdapter);
    this.service = new ArchitectureLinterService(lintProjectUseCase);
  }

  lintProject(
    at: URL,
    scope: ArchitectureLintScope = ArchitectureLintScope.All,
  ): ArchitectureLintResult {
    const diagnosticRulePrefix = diagnosticRulePrefixForScope(scope);

    return this.service.execute({
      rootURL: at,
      ...(diagnosticRulePrefix ? { diagnosticRulePrefix } : {}),
    });
  }
}
