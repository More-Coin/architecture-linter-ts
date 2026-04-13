export type ModuleAliases = Readonly<{
  runtimeSurface: readonly string[];
  commandSurface: readonly string[];
  diagnostics: readonly string[];
}>;

export type LayerDirectoryNames = Readonly<{
  app: string;
  application: string;
  domain: string;
  infrastructure: string;
  presentation: string;
}>;

export type SourceRootLayoutConfiguration = Readonly<{
  allowedTopLevelEntries: readonly string[];
  allowLooseFilesAtRoot: boolean;
  enforceCanonicalCasing: boolean;
}>;

export type ArchitectureLinterConfiguration = Readonly<{
  testRootName: string;
  runtimeNamespaceSegments: readonly string[];
  diagnosticsSubpath: string;
  sourceExtensions: readonly string[];
  tsConfigFilePath: string;
  layerDirectoryNames: LayerDirectoryNames;
  sourceRootLayout: SourceRootLayoutConfiguration;
  moduleAliases: ModuleAliases;
  disabledRuleIDs: readonly string[];
  disabledRulePrefixes: readonly string[];
}>;

export const DEFAULT_ARCHITECTURE_LINTER_CONFIGURATION: ArchitectureLinterConfiguration =
  {
    testRootName: "<ProjectName>Tests",
    runtimeNamespaceSegments: [],
    diagnosticsSubpath: "Diagnostics/ArchitectureLinter",
    sourceExtensions: [".ts"],
    tsConfigFilePath: "tsconfig.json",
    layerDirectoryNames: {
      app: "App",
      application: "Application",
      domain: "Domain",
      infrastructure: "Infrastructure",
      presentation: "Presentation",
    },
    sourceRootLayout: {
      allowedTopLevelEntries: [
        "App",
        "Application",
        "Domain",
        "Infrastructure",
        "Presentation",
        "Documentation",
      ],
      allowLooseFilesAtRoot: false,
      enforceCanonicalCasing: true,
    },
    moduleAliases: {
      runtimeSurface: [],
      commandSurface: [],
      diagnostics: ["architecture-linter-ts"],
    },
    disabledRuleIDs: [],
    disabledRulePrefixes: [],
  };
