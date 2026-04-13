import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/App/index.ts",
    cli: "src/App/main.ts",
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
