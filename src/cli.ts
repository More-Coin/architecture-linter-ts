#!/usr/bin/env node

import { ArchitectureLinterCLIEntrypoint } from "./presentation/entrypoints/ArchitectureLinterCLIEntrypoint.ts";
import { DefaultArchitecturePolicies } from "./domain/policies/DefaultArchitecturePolicies.ts";

process.exitCode = ArchitectureLinterCLIEntrypoint.run(
  process.argv,
  DefaultArchitecturePolicies.make,
);
