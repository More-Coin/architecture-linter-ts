export const ARCHITECTURE_LINTER_USAGE =
  "Usage: architecture-linter [root] [--scope tests] [--config path]";

export const ARCHITECTURE_LINTER_HELP_LINES = [
  ARCHITECTURE_LINTER_USAGE,
  "",
  "Arguments:",
  "  root            Repository root to lint. Defaults to ./src when omitted.",
  "",
  "Options:",
  "  --scope tests   Only emit test-layer diagnostics.",
  "  --config path   Load configuration from the provided JSON file.",
  "  -h, --help      Show this help message.",
] as const;
