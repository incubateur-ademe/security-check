import { promises as fs } from "fs";
import * as path from "path";
import { FetcherFn, FileToAnalyze } from "./fetch-types";
import type { ScannerEntry } from "./index";
import { logger } from "../utils/logger";

async function readLocalIfExists(relativePath: string): Promise<string | null> {
  const fullPath = path.join(process.cwd(), relativePath);
  try {
    return await fs.readFile(fullPath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Fetcher local : mode "local"
 * - ignore les autres modes
 */
export const fetchLocal: FetcherFn = async (ctx, scanners: ScannerEntry[]): Promise<FileToAnalyze[]> => {
  if (ctx.mode !== "local") {
    throw new Error(`fetchLocal appelé avec un mode non-local: ${ctx.mode}`);
  }

  const files: FileToAnalyze[] = [];

  for (const [analyzer, fileNames] of scanners) {
    for (const fileName of fileNames) {
      const content = await readLocalIfExists(fileName);
      if (!content) {
        logger(2, `ℹ️ ${fileName} absent en local, skip.`);
        continue;
      }

      files.push({
        analyzer,
        filename: fileName,
        source: fileName, // tu pourras rajouter un label plus précis si tu veux
        content,
      });
    }
  }

  return files;
};
