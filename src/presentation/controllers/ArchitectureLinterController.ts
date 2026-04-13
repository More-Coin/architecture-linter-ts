import { ArchitectureLinter } from "../../app/dependency-injection/ArchitectureLinter.ts";
import type { ArchitectureLinterConfiguration } from "../../app/configuration/ArchitectureLinterConfiguration.ts";
import type { ArchitecturePolicyProtocol } from "../../domain/protocols/ArchitecturePolicyProtocol.ts";
import { ArchitectureLinterCommandDTO } from "../dtos/ArchitectureLinterCommandDTO.ts";
import { ArchitectureLinterConfigurationLoader } from "../dtos/ArchitectureLinterConfigurationLoader.ts";
import { ArchitectureLinterRenderer } from "../renderers/ArchitectureLinterRenderer.ts";

export class ArchitectureLinterController {
  private readonly renderer: ArchitectureLinterRenderer;
  private readonly makePolicies: (
    configuration: ArchitectureLinterConfiguration,
  ) => readonly ArchitecturePolicyProtocol[];

  constructor(input: {
    renderer: ArchitectureLinterRenderer;
    makePolicies: (
      configuration: ArchitectureLinterConfiguration,
    ) => readonly ArchitecturePolicyProtocol[];
  }) {
    this.renderer = input.renderer;
    this.makePolicies = input.makePolicies;
  }

  run(arguments_: readonly string[]): number {
    try {
      const command = new ArchitectureLinterCommandDTO(arguments_);
      if (command.helpRequested) {
        return this.renderer.renderHelp();
      }

      const configuration = ArchitectureLinterConfigurationLoader.load({
        rootURL: command.rootURL,
        explicitConfigURL: command.configURL,
      });
      const linter = new ArchitectureLinter({
        configuration,
        policies: this.makePolicies(configuration),
      });
      const result = linter.lintProject(command.rootURL, command.scope);
      return this.renderer.render(result);
    } catch (error) {
      return this.renderer.renderError(error);
    }
  }
}
