import type { ArchitectureLinterStructuredErrorProtocol } from "../../application/contracts/errors/ArchitectureLinterStructuredErrorProtocol.ts";
import type { StructuredErrorProtocol } from "../../domain/protocols/StructuredErrorProtocol.ts";

export class ArchitectureLinterPresentationError
  extends Error
  implements StructuredErrorProtocol, ArchitectureLinterStructuredErrorProtocol
{
  readonly code: string;
  readonly retryable = false;
  readonly details?: string;

  private constructor(input: {
    code: string;
    message: string;
    details?: string;
  }) {
    super(input.message);
    this.name = "ArchitectureLinterPresentationError";
    this.code = input.code;
    this.details = input.details;
  }

  static invalidArguments(): ArchitectureLinterPresentationError {
    return new ArchitectureLinterPresentationError({
      code: "architecture_linter.invalid_arguments",
      message:
        "Usage: architecture-linter [repo-root] [--scope tests] [--config path]",
      details:
        "Provide zero or one repo-root argument plus optional --scope and --config flags.",
    });
  }

  static unreadableConfig(
    path: string,
  ): ArchitectureLinterPresentationError {
    return new ArchitectureLinterPresentationError({
      code: "architecture_linter.unreadable_config",
      message: "The provided linter config file could not be read.",
      details: `Config path: ${path}`,
    });
  }

  static invalidConfig(
    path: string,
    underlyingMessage: string,
  ): ArchitectureLinterPresentationError {
    return new ArchitectureLinterPresentationError({
      code: "architecture_linter.invalid_config",
      message: "The provided linter config file is invalid.",
      details: `Config path: ${path}\nDecoder message: ${underlyingMessage}`,
    });
  }
}
