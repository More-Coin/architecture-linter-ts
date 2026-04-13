import { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";

export { DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION } from "../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";
export type {
  ArchitectureLinterConfiguration,
  LayerDirectoryNames,
  ModuleAliases,
  SourceRootLayoutConfiguration,
} from "../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";

export class ArchitectureLinterDefaultConfiguration {
  static readonly value = DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
}
