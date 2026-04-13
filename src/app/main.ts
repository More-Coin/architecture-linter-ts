#!/usr/bin/env node

import { LintProjectUseCase } from "../Application/use-cases/LintProjectUseCase.ts";
import { ArchitectureLinterConfigurationPortAdapter } from "../Infrastructure/port-adapters/ArchitectureLinterConfigurationPortAdapter.ts";
import { ArchitectureLinterPortAdapter } from "../Infrastructure/port-adapters/ArchitectureLinterPortAdapter.ts";
import { ArchitectureLinterService } from "../Application/services/ArchitectureLinterService.ts";
import { ArchitectureLinterCLIEntrypoint } from "../Presentation/entrypoints/ArchitectureLinterCLIEntrypoint.ts";

const service = new ArchitectureLinterService(
  new LintProjectUseCase(new ArchitectureLinterPortAdapter()),
  new ArchitectureLinterConfigurationPortAdapter(),
);

process.exitCode = ArchitectureLinterCLIEntrypoint.run(process.argv, service);
