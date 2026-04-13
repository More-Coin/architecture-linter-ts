import type { ArchitectureLintResultContract } from "../../Application/contracts/ports/ArchitectureLintResultContract.ts";
import { ArchitectureLintScopeContract } from "../../Application/contracts/workflow/ArchitectureLintScope.ts";
import type { ArchitectureLinterConfigurationPortProtocol } from "../../Application/ports/protocols/ArchitectureLinterConfigurationPortProtocol.ts";
import type { SourceFileDiscoveryPortProtocol } from "../../Application/ports/protocols/SourceFileDiscoveryPortProtocol.ts";
import { ArchitectureLinterService } from "../../Application/services/ArchitectureLinterService.ts";
import { LintProjectUseCase } from "../../Application/use-cases/LintProjectUseCase.ts";
import type { ArchitectureLinterConfiguration } from "../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";
import type { ArchitecturePolicyProtocol } from "../../Domain/Protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLinterPortAdapter } from "../../Infrastructure/port-adapters/ArchitectureLinterPortAdapter.ts";

const FixedArchitectureLinterConfigurationPortAdapter = class
  implements ArchitectureLinterConfigurationPortProtocol
{
  constructor(private readonly configuration: ArchitectureLinterConfiguration) {}

  loadConfiguration(_command: {
    readonly rootURL: URL;
  }): ArchitectureLinterConfiguration {
    return this.configuration;
  }
};

export class ArchitectureLinterDI {
  private readonly service: ArchitectureLinterService;

  constructor(input: {
    configuration: ArchitectureLinterConfiguration;
    policies: readonly ArchitecturePolicyProtocol[];
    sourceFileDiscovery?: SourceFileDiscoveryPortProtocol;
  }) {
    const lintPortAdapter = new ArchitectureLinterPortAdapter({
      policies: input.policies,
      ...(input.sourceFileDiscovery
        ? { sourceFileDiscovery: input.sourceFileDiscovery }
        : {}),
    });
    const lintProjectUseCase = new LintProjectUseCase(lintPortAdapter);
    this.service = new ArchitectureLinterService(
      lintProjectUseCase,
      new FixedArchitectureLinterConfigurationPortAdapter(input.configuration),
    );
  }

  lintProject(
    at: URL,
    scope: ArchitectureLintScopeContract = ArchitectureLintScopeContract.All,
  ): ArchitectureLintResultContract {
    return this.service.execute({
      rootURL: at,
      scope,
    });
  }
}

export const ArchitectureLinter = ArchitectureLinterDI;
