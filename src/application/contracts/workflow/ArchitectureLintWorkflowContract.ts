import type { ArchitectureLinterConfiguration } from "../../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";

export type ArchitectureLintWorkflowContract = Readonly<{
  rootURL: URL;
  configuration: ArchitectureLinterConfiguration;
  diagnosticRulePrefix?: string;
}>;
