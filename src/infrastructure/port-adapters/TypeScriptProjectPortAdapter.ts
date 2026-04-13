import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  Project,
  ScriptTarget,
  ts,
} from "ts-morph";

import type { ProjectAnalysisPortProtocol } from "../../Application/ports/protocols/ProjectAnalysisPortProtocol.ts";
import type { ArchitectureLinterConfiguration } from "../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";
import { TypeScriptSourceFileModel } from "../translation/models/TypeScriptSourceFileModel.ts";

export class TypeScriptProjectPortAdapter
  implements ProjectAnalysisPortProtocol
{
  private readonly sourceFileModel: TypeScriptSourceFileModel;

  constructor(
    private readonly configuration: ArchitectureLinterConfiguration,
    sourceFileModel?: TypeScriptSourceFileModel,
  ) {
    this.sourceFileModel =
      sourceFileModel ?? new TypeScriptSourceFileModel(configuration);
  }

  analyzeProject(
    rootURL: URL,
    fileURLs: readonly URL[],
  ) {
    const project = makeProject(rootURL, this.configuration);
    const filePaths = fileURLs.map((fileURL) => fileURLToPath(fileURL));

    project.addSourceFilesAtPaths(filePaths);
    project.resolveSourceFileDependencies();

    return filePaths.flatMap((filePath) => {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        return [];
      }

      return [this.sourceFileModel.toDomain(sourceFile, rootURL)];
    });
  }
}

function makeProject(
  rootURL: URL,
  configuration: ArchitectureLinterConfiguration,
): Project {
  const rootPath = fileURLToPath(rootURL);
  const tsConfigPath = path.join(rootPath, configuration.tsConfigFilePath);

  if (fs.existsSync(tsConfigPath)) {
    return new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  }

  return new Project({
    compilerOptions: {
      target: ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      allowJs: false,
    },
  });
}
