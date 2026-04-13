import type { StructuredErrorProtocol } from "../../Domain/Protocols/StructuredErrorProtocol.ts";
import { ARCHITECTURE_LINTER_USAGE } from "../ArchitectureLinterCLIUsage.ts";

export type ArchitectureLinterPresentationError = Readonly<
  StructuredErrorProtocol & {
    name: "ArchitectureLinterPresentationError";
  }
>;

export const ArchitectureLinterPresentationErrors = {
  invalidArguments(): ArchitectureLinterPresentationError {
    return {
      name: "ArchitectureLinterPresentationError",
      code: "architecture_linter.invalid_arguments",
      message: ARCHITECTURE_LINTER_USAGE,
      retryable: false,
      details:
        "Provide zero or one root argument plus optional --scope and --config flags. When omitted, the CLI lints ./src.",
    };
  },
};
