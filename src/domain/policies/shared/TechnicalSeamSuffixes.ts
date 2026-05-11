/**
 * Suffixes that identify a technical-seam abstraction.
 *
 * Mirrors Swift's `technicalSeamProtocolSuffixes`, widened to include
 * `*Interface` and `*Port` variants — TypeScript codebases rarely use the
 * `*Protocol` suffix that Swift assumes, so the parity translation widens
 * the list to cover the same architectural intent.
 *
 * Used by:
 *   - `architecture.technical_seam_protocol_placement`
 *   - `application.services.port_protocol_reference`
 *   - `presentation.port_protocol_reference`
 */
export const TECHNICAL_SEAM_PROTOCOL_SUFFIXES = Object.freeze([
  "RepositoryProtocol",
  "RepositoryInterface",
  "RepositoryPort",
  "GatewayProtocol",
  "GatewayInterface",
  "GatewayPort",
  "ClientProtocol",
  "ClientInterface",
  "ClientPort",
  "AdapterProtocol",
  "AdapterInterface",
  "AdapterPort",
  "ProviderProtocol",
  "ProviderInterface",
  "ProviderPort",
  "PortProtocol",
  "PortInterface",
  "Port",
] as const);

/**
 * Suffixes that identify a technical-dependency *name* (concrete or abstract)
 * that an Application Service must not depend on directly. Mirrors Swift's
 * `technicalDependencySuffixes`. Includes seams plus their concrete forms and
 * the DI/container family.
 */
export const TECHNICAL_DEPENDENCY_SUFFIXES = Object.freeze([
  ...TECHNICAL_SEAM_PROTOCOL_SUFFIXES,
  "Repository",
  "Gateway",
  "Client",
  "Adapter",
  "Provider",
  "AppGraph",
  "ServiceLocator",
  "DependencyContainer",
  "DependencyValues",
  "Container",
  "Environment",
  "Resolver",
  "Registry",
  "Injector",
  "Services",
] as const);

export function endsWithTechnicalSeamSuffix(name: string): boolean {
  return TECHNICAL_SEAM_PROTOCOL_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

export function endsWithTechnicalDependencySuffix(name: string): boolean {
  return TECHNICAL_DEPENDENCY_SUFFIXES.some((suffix) => name.endsWith(suffix));
}
