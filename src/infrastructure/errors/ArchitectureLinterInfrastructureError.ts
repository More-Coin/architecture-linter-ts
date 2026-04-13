import type { ArchitectureLinterStructuredErrorProtocol } from "../../application/contracts/errors/ArchitectureLinterStructuredErrorProtocol.ts";
import type { StructuredErrorProtocol } from "../../domain/protocols/StructuredErrorProtocol.ts";

export class ArchitectureLinterInfrastructureError
  extends Error
  implements StructuredErrorProtocol, ArchitectureLinterStructuredErrorProtocol
{
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: string;

  private constructor(input: {
    code: string;
    message: string;
    retryable: boolean;
    details?: string;
  }) {
    super(input.message);
    this.name = "ArchitectureLinterInfrastructureError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.details = input.details;
  }

  static invalidRootDirectory(
    path: string,
  ): ArchitectureLinterInfrastructureError {
    return new ArchitectureLinterInfrastructureError({
      code: "architecture_linter.infrastructure.invalid_root_directory",
      message: "The provided root directory is invalid or unreadable.",
      retryable: false,
      details: `Root path: ${path}`,
    });
  }

  static unreadableSourceFile(
    path: string,
  ): ArchitectureLinterInfrastructureError {
    return new ArchitectureLinterInfrastructureError({
      code: "architecture_linter.infrastructure.unreadable_source_file",
      message: "A discovered TypeScript source file could not be read.",
      retryable: true,
      details: `Source path: ${path}`,
    });
  }
}
