import type { ArchitectureLintCommandContract } from "../../contracts/commands/ArchitectureLintCommandContract.ts";
import type { ArchitectureLinterConfiguration } from "../../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";

export interface ArchitectureLinterConfigurationPortProtocol {
  loadConfiguration(
    command: ArchitectureLintCommandContract,
  ): ArchitectureLinterConfiguration;
}
