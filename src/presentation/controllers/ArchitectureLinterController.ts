import type { ArchitectureLintCommandContract } from "../../Application/contracts/commands/ArchitectureLintCommandContract.ts";
import { ArchitectureLinterService } from "../../Application/services/ArchitectureLinterService.ts";
import type { ArchitectureLinterCommandDTO } from "../dtos/ArchitectureLinterCommandDTO.ts";
import { parseArchitectureLinterCommandDTO } from "../dtos/ArchitectureLinterCommandDTO.ts";
import { ArchitectureLinterRenderer } from "../renderers/ArchitectureLinterRenderer.ts";

export class ArchitectureLinterController {
  private readonly renderer: ArchitectureLinterRenderer;
  private readonly service: ArchitectureLinterService;

  constructor(input: {
    renderer: ArchitectureLinterRenderer;
    service: ArchitectureLinterService;
  }) {
    this.renderer = input.renderer;
    this.service = input.service;
  }

  run(arguments_: readonly string[]): number {
    try {
      const command = parseArchitectureLinterCommandDTO(arguments_);
      if (command.helpRequested) {
        return this.renderer.renderHelp();
      }

      const result = this.service.execute(
        this.toCommandContract(command),
      );
      return this.renderer.render(result);
    } catch (error) {
      return this.renderer.renderError(error);
    }
  }

  private toCommandContract(
    command: ArchitectureLinterCommandDTO,
  ): ArchitectureLintCommandContract {
    return {
      rootURL: command.rootURL,
      scope: command.scope,
      explicitConfigURL: command.configURL,
    };
  }
}
