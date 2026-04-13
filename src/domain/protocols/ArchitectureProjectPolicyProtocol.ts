import type { ArchitectureDiagnostic } from "../ValueObjects/ArchitectureDiagnostic.ts";
import type { ArchitectureLinterConfiguration } from "../ValueObjects/ArchitectureLinterConfiguration.ts";

export type ArchitectureProjectPolicyInput = Readonly<{
  rootURL: URL;
  configuration: ArchitectureLinterConfiguration;
  sourceFileURLs: readonly URL[];
  emptyDirectoryPaths: readonly string[];
}>;

export interface ArchitectureProjectPolicyProtocol {
  evaluateProject(
    input: ArchitectureProjectPolicyInput,
  ): readonly ArchitectureDiagnostic[];
}
