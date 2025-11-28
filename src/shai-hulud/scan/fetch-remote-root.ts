// scan/fetch-remote-root.ts
import pLimit from "p-limit";

import { type FetcherFn, type FileToAnalyze } from "./fetch-types";
import { type ScannerEntry } from "./index";

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

  const limit = pLimit(5);
  const tasks: Array<Promise<FileToAnalyze | null>> = [];

  for (const [analyzer, fileNames] of scanners) {
    for (const fileName of fileNames) {
      tasks.push(
        limit(async () => {
          const content = await fetchRemoteRawIfExists(owner, repo, branch, fileName);
          if (!content) return null;
          const source = `${owner}/${repo}@${branch}:${fileName}`;
          return {
            analyzer,
            filename: fileName,
            source,
            content,
          } as FileToAnalyze;
        }),
      );
    }
  }

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) files.push(s.value);
  }

  return files;
};
