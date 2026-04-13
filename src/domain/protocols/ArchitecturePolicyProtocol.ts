import type { ArchitectureDiagnostic } from "../value-objects/ArchitectureDiagnostic.ts";
import type { ArchitectureFile } from "../value-objects/ArchitectureFile.ts";
import type { ProjectContext } from "../value-objects/ProjectContext.ts";

export interface ArchitecturePolicyProtocol {
  evaluate(
    file: ArchitectureFile,
    context: ProjectContext,
  ): readonly ArchitectureDiagnostic[];
}
