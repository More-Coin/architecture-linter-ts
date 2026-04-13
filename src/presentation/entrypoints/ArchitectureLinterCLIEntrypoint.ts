import { ArchitectureLinterService } from "../../Application/services/ArchitectureLinterService.ts";
import { ArchitectureLinterController } from "../controllers/ArchitectureLinterController.ts";
import { ArchitectureLinterRenderer } from "../renderers/ArchitectureLinterRenderer.ts";

export class ArchitectureLinterCLIEntrypoint {
  static run(
    arguments_: readonly string[],
    service: ArchitectureLinterService,
  ): number {
    return new ArchitectureLinterController({
      renderer: new ArchitectureLinterRenderer(),
      service,
    }).run(arguments_);
  }
}
