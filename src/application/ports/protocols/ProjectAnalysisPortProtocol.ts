import type { ArchitectureFile } from "../../../Domain/ValueObjects/ArchitectureFile.ts";

export interface ProjectAnalysisPortProtocol {
  analyzeProject(rootURL: URL, fileURLs: readonly URL[]): readonly ArchitectureFile[];
}
