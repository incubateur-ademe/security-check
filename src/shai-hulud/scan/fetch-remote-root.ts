// scan/fetch-remote-root.ts
import { FetcherFn, FileToAnalyze } from "./fetch-types";
import type { ScannerEntry } from "./index";

async function fetchRemoteRawIfExists(owner: string, repo: string, branch: string, pathInRepo: string) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${pathInRepo}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3.raw",
      "User-Agent": "shai-hulud-checker",
    },
  });
  if (!res.ok) return null;
  return res.text();
}

/**
 * Fetcher remote root-only : ne regarde que les fichiers à la racine
 */
export const fetchRemoteRoot: FetcherFn = async (ctx, scanners: ScannerEntry[]): Promise<FileToAnalyze[]> => {
  if (ctx.mode !== "remote-root") {
    throw new Error(`fetchRemoteRoot appelé avec un mode non remote-root: ${ctx.mode}`);
  }

  const { owner, repo, branch } = ctx;
  const files: FileToAnalyze[] = [];

  for (const [analyzer, fileNames] of scanners) {
    for (const fileName of fileNames) {
      const content = await fetchRemoteRawIfExists(owner, repo, branch, fileName);
      if (!content) continue;

      const source = `${owner}/${repo}@${branch}:${fileName}`;

      files.push({
        analyzer,
        filename: fileName,
        source,
        content,
      });
    }
  }

  return files;
};
