import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ArchitectureLintCommandContract } from "../../Application/contracts/commands/ArchitectureLintCommandContract.ts";
import type { ArchitectureLinterConfigurationPortProtocol } from "../../Application/ports/protocols/ArchitectureLinterConfigurationPortProtocol.ts";
import {
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  type ArchitectureLinterConfiguration,
} from "../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";
import { ArchitectureLinterInfrastructureError } from "../errors/ArchitectureLinterInfrastructureError.ts";
import { ArchitectureLinterConfigurationModel } from "../translation/models/ArchitectureLinterConfigurationModel.ts";

export class ArchitectureLinterConfigurationPortAdapter
  implements ArchitectureLinterConfigurationPortProtocol
{
  private static readonly implicitConfigFileNames = [
    ".architecture-linter.json",
  ] as const;
  private readonly configurationModel = new ArchitectureLinterConfigurationModel();

  loadConfiguration(
    command: ArchitectureLintCommandContract,
  ): ArchitectureLinterConfiguration {
    const configURL =
      command.explicitConfigURL ?? implicitConfigURLIn(command.rootURL);
    const configPath = fileURLToPath(configURL);

    if (!fs.existsSync(configPath)) {
      if (!command.explicitConfigURL) {
        return DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
      }

      throw ArchitectureLinterInfrastructureError.unreadableConfig(configPath);
    }

    let raw: string;
    try {
      raw = fs.readFileSync(configPath, "utf8");
    } catch {
      throw ArchitectureLinterInfrastructureError.unreadableConfig(configPath);
    }

    try {
      const configuration = this.configurationModel.toDomain(raw);
      if (!configuration) {
        throw new Error("Configuration shape does not match the expected schema.");
      }

      return configuration;
    } catch (error) {
      const underlyingMessage =
        error instanceof Error ? error.message : String(error);
      throw ArchitectureLinterInfrastructureError.invalidConfig(
        configPath,
        underlyingMessage,
      );
    }
  }
}

function implicitConfigURLIn(rootURL: URL): URL {
  const rootPath = fileURLToPath(rootURL);

  for (const fileName of ArchitectureLinterConfigurationPortAdapter.implicitConfigFileNames) {
    const candidatePath = `${rootPath}/${fileName}`;
    if (fs.existsSync(candidatePath)) {
      return pathToFileURL(candidatePath);
    }
  }

  return pathToFileURL(
    `${rootPath}/${ArchitectureLinterConfigurationPortAdapter.implicitConfigFileNames[0]}`,
  );
}
