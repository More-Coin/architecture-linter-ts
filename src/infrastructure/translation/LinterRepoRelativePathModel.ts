import path from "node:path";
import { fileURLToPath } from "node:url";

export class LinterRepoRelativePathModel {
  fromURLs(fileURL: URL, rootURL: URL): string {
    const rootPath = path.normalize(fileURLToPath(rootURL));
    const filePath = path.normalize(fileURLToPath(fileURL));
    const relativePath = path.relative(rootPath, filePath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return path.basename(filePath);
    }

    return relativePath.split(path.sep).join("/");
  }
}
