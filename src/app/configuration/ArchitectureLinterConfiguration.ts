export interface ModuleAliases {
  readonly runtimeSurface: readonly string[];
  readonly commandSurface: readonly string[];
  readonly diagnostics: readonly string[];
}

export interface ArchitectureLinterConfiguration {
  readonly testRootName: string;
  readonly runtimeNamespaceSegments: readonly string[];
  readonly diagnosticsSubpath: string;
  readonly sourceExtensions: readonly string[];
  readonly tsConfigFilePath: string;
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
    moduleAliases: {
      runtimeSurface: [],
      commandSurface: [],
      diagnostics: ["architecture-linter-ts"],
    },
    disabledRuleIDs: [],
    disabledRulePrefixes: [],
  };
