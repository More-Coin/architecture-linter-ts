import {
  DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION,
  type ArchitectureLinterConfiguration,
  type LayerDirectoryNames,
  type ModuleAliases,
  type SourceRootLayoutConfiguration,
} from "../../../Domain/ValueObjects/ArchitectureLinterConfiguration.ts";

export class ArchitectureLinterConfigurationModel {
  toDomain(
    rawConfiguration: string,
  ): ArchitectureLinterConfiguration | undefined {
    const value = decodeRawConfiguration(rawConfiguration);
    if (!isRecord(value)) {
      return undefined;
    }

    const moduleAliases = parseModuleAliases(value.moduleAliases);
    const layerDirectoryNames = parseLayerDirectoryNames(
      value.layerDirectoryNames,
    );
    const sourceRootLayout = parseSourceRootLayout(
      value.sourceRootLayout,
    );
    if (
      typeof value.testRootName !== "string" ||
      !isStringArray(value.runtimeNamespaceSegments) ||
      typeof value.diagnosticsSubpath !== "string" ||
      !layerDirectoryNames ||
      !sourceRootLayout ||
      !moduleAliases ||
      !isStringArray(value.disabledRuleIDs) ||
      !isStringArray(value.disabledRulePrefixes)
    ) {
      return undefined;
    }

    return {
      testRootName: value.testRootName,
      runtimeNamespaceSegments: value.runtimeNamespaceSegments,
      diagnosticsSubpath: value.diagnosticsSubpath,
      sourceExtensions:
        isStringArray(value.sourceExtensions)
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
}

function decodeRawConfiguration(rawConfiguration: string): unknown {
  return JSON.parse(rawConfiguration) as unknown;
}

function parseLayerDirectoryNames(
  value: unknown,
): LayerDirectoryNames | undefined {
  if (!isRecord(value)) {
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

function parseSourceRootLayout(
  value: unknown,
): SourceRootLayoutConfiguration | undefined {
  if (!isRecord(value)) {
    return DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION.sourceRootLayout;
  }

  if (
    !isStringArray(value.allowedTopLevelEntries) ||
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

function parseModuleAliases(value: unknown): ModuleAliases | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    !isStringArray(value.runtimeSurface) ||
    !isStringArray(value.commandSurface) ||
    !isStringArray(value.diagnostics)
  ) {
    return undefined;
  }

  return {
    runtimeSurface: value.runtimeSurface,
    commandSurface: value.commandSurface,
    diagnostics: value.diagnostics,
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}
