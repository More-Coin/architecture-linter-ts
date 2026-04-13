import type { ArchitectureLinterConfiguration } from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import type { ArchitecturePolicyProtocol } from "../../domain/protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLinterController } from "../controllers/ArchitectureLinterController.ts";
import { ArchitectureLinterRenderer } from "../renderers/ArchitectureLinterRenderer.ts";

export class ArchitectureLinterCLIEntrypoint {
  static run(
    arguments_: readonly string[],
    makePolicies: (
      configuration: ArchitectureLinterConfiguration,
    ) => readonly ArchitecturePolicyProtocol[],
  ): number {
    return new ArchitectureLinterController({
      renderer: new ArchitectureLinterRenderer(),
      makePolicies,
    }).run(arguments_);
  }
}
