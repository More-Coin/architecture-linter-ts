import type { ArchitectureLintResult } from "../../contracts/ports/ArchitectureLintResultContract.ts";

export interface ArchitectureLintPortProtocol {
  lintProject(at: URL): ArchitectureLintResult;
}
