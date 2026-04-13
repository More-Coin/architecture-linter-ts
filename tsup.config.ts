import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  clean: true,
  dts: true,
  format: ["esm"],
  outDir: "dist",
  platform: "node",
  skipNodeModulesBundle: true,
  splitting: false,
  target: "node20",
});
