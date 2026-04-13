import { ArchitectureLinterCLIEntrypoint } from "../presentation/entrypoints/ArchitectureLinterCLIEntrypoint.ts";
import { DefaultArchitecturePolicies } from "../domain/policies/index.ts";

process.exitCode = ArchitectureLinterCLIEntrypoint.run(
  process.argv,
  DefaultArchitecturePolicies.make,
);
