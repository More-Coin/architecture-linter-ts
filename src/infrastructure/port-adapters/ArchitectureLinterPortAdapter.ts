import type { ArchitectureLintResultContract } from "../../Application/contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLintWorkflowContract } from "../../Application/contracts/workflow/ArchitectureLintWorkflowContract.ts";
import type { ArchitectureLintPortProtocol } from "../../Application/ports/protocols/ArchitectureLintPortProtocol.ts";
import type { ProjectAnalysisPortProtocol } from "../../Application/ports/protocols/ProjectAnalysisPortProtocol.ts";
import type { SourceFileDiscoveryPortProtocol } from "../../Application/ports/protocols/SourceFileDiscoveryPortProtocol.ts";
import { ArchitectureDiagnosticOrderingPolicy } from "../../Domain/Policies/ArchitectureDiagnosticOrderingPolicy.ts";
import { DefaultArchitecturePolicies } from "../../Domain/Policies/DefaultArchitecturePolicies.ts";
import type { ArchitecturePolicyProtocol } from "../../Domain/Protocols/ArchitecturePolicyProtocol.ts";
import { SourceFileDiscoveryGateway } from "../gateways/SourceFileDiscoveryGateway.ts";
import { LinterProjectContextModel } from "../translation/models/LinterProjectContextModel.ts";
import { TypeScriptProjectPortAdapter } from "./TypeScriptProjectPortAdapter.ts";

export class ArchitectureLinterPortAdapter
  implements ArchitectureLintPortProtocol
{
  private readonly policies: readonly ArchitecturePolicyProtocol[];
  private readonly sourceFileDiscovery?: SourceFileDiscoveryPortProtocol;
  private readonly projectContextModel: LinterProjectContextModel;
  private readonly projectAnalyzer?: ProjectAnalysisPortProtocol;

  constructor(input: {
    policies?: readonly ArchitecturePolicyProtocol[];
    sourceFileDiscovery?: SourceFileDiscoveryPortProtocol;
    projectContextModel?: LinterProjectContextModel;
    projectAnalyzer?: ProjectAnalysisPortProtocol;
  } = {}) {
    this.policies = input.policies ?? [];
    this.sourceFileDiscovery = input.sourceFileDiscovery;
    this.projectContextModel =
      input.projectContextModel ?? new LinterProjectContextModel();
    this.projectAnalyzer = input.projectAnalyzer;
  }

  lintProject(
    workflow: ArchitectureLintWorkflowContract,
  ): ArchitectureLintResultContract {
    const sourceFileDiscovery =
      this.sourceFileDiscovery ??
      new SourceFileDiscoveryGateway(workflow.configuration.sourceExtensions);
    const projectAnalyzer =
      this.projectAnalyzer ?? new TypeScriptProjectPortAdapter(workflow.configuration);
    const policies =
      this.policies.length > 0
        ? this.policies
        : DefaultArchitecturePolicies.make(workflow.configuration);
    const fileURLs = sourceFileDiscovery.discoverSourceFiles(workflow.rootURL);
    const files = projectAnalyzer.analyzeProject(workflow.rootURL, fileURLs);
    const context = this.projectContextModel.toDomain(files);
    const diagnostics = files.flatMap((file) =>
      policies.flatMap((policy) => [...policy.evaluate(file, context)]),
    );
    const orderedDiagnostics =
      new ArchitectureDiagnosticOrderingPolicy().ordered(diagnostics);

    return {
      diagnostics: orderedDiagnostics,
    };
  }
}
