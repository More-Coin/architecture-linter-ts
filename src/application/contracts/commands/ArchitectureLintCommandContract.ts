import type { ArchitectureLintScopeContract } from "../workflow/ArchitectureLintScope.ts";

export type ArchitectureLintCommandContract = Readonly<{
  rootURL: URL;
  scope: ArchitectureLintScopeContract;
  explicitConfigURL?: URL;
}>;
