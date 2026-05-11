import type { SourceCoordinate } from "./SourceCoordinate.ts";

/**
 * A composite occurrence flagging a direct dependency-resolution pattern
 * (service locator call, dependency-container resolution, singleton dependency
 * access, framework DI helper, decorator-mediated injection, etc.).
 *
 * `memberName` is absent for decorator occurrences. For all other shapes the
 * pair (`baseName`, `memberName`) identifies the resolution access — for
 * example `Container.resolve`, `container.get`, `Foo.shared`, or `Foo.live`.
 */
export interface ArchitectureDependencyResolutionOccurrence {
  readonly baseName: string;
  readonly memberName?: string;
  readonly coordinate: SourceCoordinate;
}
