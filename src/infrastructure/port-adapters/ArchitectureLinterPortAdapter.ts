import type { ArchitectureLinterConfiguration } from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import type { ArchitectureLintResultContract } from "../../application/contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLintPortProtocol } from "../../application/ports/protocols/ArchitectureLintPortProtocol.ts";
import type { SourceFileDiscoveryPortProtocol } from "../../application/ports/protocols/SourceFileDiscoveryPortProtocol.ts";
import { ArchitectureDiagnosticOrderingPolicy } from "../../domain/policies/ArchitectureDiagnosticOrderingPolicy.ts";
import type { ArchitecturePolicyProtocol } from "../../domain/protocols/ArchitecturePolicyProtocol.ts";
import { SourceFileDiscoveryGateway } from "../gateways/SourceFileDiscoveryGateway.ts";
import { TypeScriptProjectAnalyzer } from "../analyzers/TypeScriptProjectAnalyzer.ts";
import { LinterProjectContextModel } from "../translation/LinterProjectContextModel.ts";

export class ArchitectureLinterPortAdapter
  implements ArchitectureLintPortProtocol
{
  private readonly policies: readonly ArchitecturePolicyProtocol[];
  private readonly sourceFileDiscovery: SourceFileDiscoveryPortProtocol;
  private readonly projectContextModel: LinterProjectContextModel;
  private readonly projectAnalyzer: TypeScriptProjectAnalyzer;

  constructor(input: {
    configuration: ArchitectureLinterConfiguration;
    policies?: readonly ArchitecturePolicyProtocol[];
    sourceFileDiscovery?: SourceFileDiscoveryPortProtocol;
    projectContextModel?: LinterProjectContextModel;
    projectAnalyzer?: TypeScriptProjectAnalyzer;
  }) {
    this.policies = input.policies ?? [];
    this.sourceFileDiscovery =
      input.sourceFileDiscovery ??
      new SourceFileDiscoveryGateway(input.configuration.sourceExtensions);
    this.projectContextModel =
      input.projectContextModel ?? new LinterProjectContextModel();
    this.projectAnalyzer =
      input.projectAnalyzer ?? new TypeScriptProjectAnalyzer(input.configuration);
  }

  lintProject(at: URL): ArchitectureLintResultContract {
    const fileURLs = this.sourceFileDiscovery.discoverSourceFiles(at);
    const files = this.projectAnalyzer.analyzeProject(at, fileURLs);
    const context = this.projectContextModel.toDomain(files);
    const diagnostics = files.flatMap((file) =>
      this.policies.flatMap((policy) => [...policy.evaluate(file, context)]),
    );
    const orderedDiagnostics =
      new ArchitectureDiagnosticOrderingPolicy().ordered(diagnostics);

    return {
      diagnostics: orderedDiagnostics,
    };
  }
}
