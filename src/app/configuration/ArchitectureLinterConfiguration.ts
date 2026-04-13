export interface ModuleAliases {
  readonly runtimeSurface: readonly string[];
  readonly commandSurface: readonly string[];
  readonly diagnostics: readonly string[];
}

export interface LayerDirectoryNames {
  readonly app: string;
  readonly application: string;
  readonly domain: string;
  readonly infrastructure: string;
  readonly presentation: string;
}

export interface SourceRootLayoutConfiguration {
  readonly allowedTopLevelEntries: readonly string[];
  readonly allowLooseFilesAtRoot: boolean;
  readonly enforceCanonicalCasing: boolean;
}

export interface ArchitectureLinterConfiguration {
  readonly testRootName: string;
  readonly runtimeNamespaceSegments: readonly string[];
  readonly diagnosticsSubpath: string;
  readonly sourceExtensions: readonly string[];
  readonly tsConfigFilePath: string;
  readonly layerDirectoryNames: LayerDirectoryNames;
  readonly sourceRootLayout: SourceRootLayoutConfiguration;
  readonly moduleAliases: ModuleAliases;
  readonly disabledRuleIDs: readonly string[];
  readonly disabledRulePrefixes: readonly string[];
}

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
