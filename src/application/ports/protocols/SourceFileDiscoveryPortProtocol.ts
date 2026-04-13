export interface SourceFileDiscoveryPortProtocol {
  discoverSourceFiles(in_: URL): readonly URL[];
  discoverEmptyDirectories(in_: URL): readonly string[];
}
