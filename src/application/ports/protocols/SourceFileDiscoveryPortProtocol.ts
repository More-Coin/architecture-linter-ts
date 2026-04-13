export interface SourceFileDiscoveryPortProtocol {
  discoverSourceFiles(in_: URL): readonly URL[];
}
