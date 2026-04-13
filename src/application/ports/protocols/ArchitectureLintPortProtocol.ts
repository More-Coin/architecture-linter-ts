import type { ArchitectureLintResultContract } from "../../contracts/ports/ArchitectureLintResultContract.ts";
import type { ArchitectureLintWorkflowContract } from "../../contracts/workflow/ArchitectureLintWorkflowContract.ts";

export interface ArchitectureLintPortProtocol {
  lintProject(
    workflow: ArchitectureLintWorkflowContract,
  ): ArchitectureLintResultContract;
}
