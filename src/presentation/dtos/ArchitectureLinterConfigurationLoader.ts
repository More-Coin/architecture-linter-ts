import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  type ArchitectureLinterConfiguration,
  type LayerDirectoryNames,
  type ModuleAliases,
  type SourceRootLayoutConfiguration,
} from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import { ArchitectureLinterPresentationError } from "../errors/ArchitectureLinterPresentationError.ts";

export class ArchitectureLinterConfigurationLoader {
  private static readonly implicitConfigFileNames = [
    ".architecture-linter.json",
  ] as const;

  static load(input: {
    rootURL: URL;
    explicitConfigURL?: URL;
  }): ArchitectureLinterConfiguration {
    const configURL =
      input.explicitConfigURL ?? this.implicitConfigURLIn(input.rootURL);
    const configPath = fileURLToPath(configURL);

    if (!fs.existsSync(configPath)) {
      if (!input.explicitConfigURL) {
        return DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION;
      }

      throw ArchitectureLinterPresentationError.unreadableConfig(configPath);
    }

    let raw: string;
    try {
      raw = fs.readFileSync(configPath, "utf8");
    } catch {
      throw ArchitectureLinterPresentationError.unreadableConfig(configPath);
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const configuration = this.parseConfiguration(parsed);
      if (!configuration) {
        throw new Error("Configuration shape does not match the expected schema.");
      }

      return configuration;
    } catch (error) {
      const underlyingMessage =
        error instanceof Error ? error.message : String(error);
      throw ArchitectureLinterPresentationError.invalidConfig(
        configPath,
        underlyingMessage,
      );
    }
  }

  private static implicitConfigURLIn(rootURL: URL): URL {
    const rootPath = fileURLToPath(rootURL);

    for (const fileName of this.implicitConfigFileNames) {
      const candidatePath = `${rootPath}/${fileName}`;
      if (fs.existsSync(candidatePath)) {
        return pathToFileURL(candidatePath);
      }
    }

    return pathToFileURL(`${rootPath}/${this.implicitConfigFileNames[0]}`);
  }

  private static parseConfiguration(
    value: unknown,
  ): ArchitectureLinterConfiguration | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const moduleAliases = this.parseModuleAliases(value.moduleAliases);
    const layerDirectoryNames = this.parseLayerDirectoryNames(
      value.layerDirectoryNames,
    );
    const sourceRootLayout = this.parseSourceRootLayout(
      value.sourceRootLayout,
    );
    if (
      typeof value.testRootName !== "string" ||
      !this.isStringArray(value.runtimeNamespaceSegments) ||
      typeof value.diagnosticsSubpath !== "string" ||
      !layerDirectoryNames ||
      !sourceRootLayout ||
      !moduleAliases ||
      !this.isStringArray(value.disabledRuleIDs) ||
      !this.isStringArray(value.disabledRulePrefixes)
    ) {
      return undefined;
    }

    return {
      testRootName: value.testRootName,
      runtimeNamespaceSegments: value.runtimeNamespaceSegments,
      diagnosticsSubpath: value.diagnosticsSubpath,
      sourceExtensions:
        this.isStringArray(value.sourceExtensions)
          ? value.sourceExtensions
          : DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION.sourceExtensions,
      tsConfigFilePath:
        typeof value.tsConfigFilePath === "string"
          ? value.tsConfigFilePath
          : DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION.tsConfigFilePath,
      layerDirectoryNames,
      sourceRootLayout,
      moduleAliases,
      disabledRuleIDs: value.disabledRuleIDs,
      disabledRulePrefixes: value.disabledRulePrefixes,
    };
  }

  private static parseLayerDirectoryNames(
    value: unknown,
  ): LayerDirectoryNames | undefined {
    if (!this.isRecord(value)) {
      return DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION.layerDirectoryNames;
    }

    if (
      typeof value.app !== "string" ||
      typeof value.application !== "string" ||
      typeof value.domain !== "string" ||
      typeof value.infrastructure !== "string" ||
      typeof value.presentation !== "string"
    ) {
      return undefined;
    }

    return {
      app: value.app,
      application: value.application,
      domain: value.domain,
      infrastructure: value.infrastructure,
      presentation: value.presentation,
    };
  }

  private static parseSourceRootLayout(
    value: unknown,
  ): SourceRootLayoutConfiguration | undefined {
    if (!this.isRecord(value)) {
      return DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION.sourceRootLayout;
    }

    if (
      !this.isStringArray(value.allowedTopLevelEntries) ||
      typeof value.allowLooseFilesAtRoot !== "boolean" ||
      typeof value.enforceCanonicalCasing !== "boolean"
    ) {
      return undefined;
    }

    return {
      allowedTopLevelEntries: value.allowedTopLevelEntries,
      allowLooseFilesAtRoot: value.allowLooseFilesAtRoot,
      enforceCanonicalCasing: value.enforceCanonicalCasing,
    };
  }

  private static parseModuleAliases(value: unknown): ModuleAliases | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }

    if (
      !this.isStringArray(value.runtimeSurface) ||
      !this.isStringArray(value.commandSurface) ||
      !this.isStringArray(value.diagnostics)
    ) {
      return undefined;
    }

    return {
      runtimeSurface: value.runtimeSurface,
      commandSurface: value.commandSurface,
      diagnostics: value.diagnostics,
    };
  }

  private static isRecord(
    value: unknown,
  ): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private static isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }
}
