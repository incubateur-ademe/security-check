// scan/fetch-remote-tree.ts
import pLimit from "p-limit";

import { buildGithubHeaders, getGithubApiUrl } from "../utils/github";
import { log } from "../utils/logger";
import { type FetcherFn, type FileToAnalyze } from "./fetch-types";
import { type ScannerEntry } from "./index";

async function fetchBranchSha(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ sha: string; resolvedRef: string } | null> {
  const baseUrl = getGithubApiUrl();
  const headers = buildGithubHeaders();
  const url = `${baseUrl}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status !== 404) {
      const body = await res.text();
      log.warn(
        `⚠️  Impossible de récupérer la ref pour ${owner}/${repo}@${branch}: ${res.status} ${res.statusText} (${body.slice(0, 200)}...)`,
      );
    }
    return null;
  }

  interface GitRefResponse {
    object?: { sha?: string };
    ref?: string;
  }
  const _data = (await res.json()) as GitRefResponse | [GitRefResponse];
  const data = Array.isArray(_data) ? _data[0] : _data;
  const sha = data.object?.sha;
  if (!sha) {
    log.warn(`⚠️  Réponse /git/refs sans SHA pour ${owner}/${repo}@${branch}`);
    return null;
  }

  const resolvedRef = data.ref ?? `refs/heads/${branch}`;
  return { sha, resolvedRef };
}

async function listAllPaths(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ paths: string[]; resolvedRef?: string }> {
  const info = await fetchBranchSha(owner, repo, branch);
  if (!info) return { paths: [], resolvedRef: undefined };

  const baseUrl = getGithubApiUrl();
  const headers = buildGithubHeaders();
  const url = `${baseUrl}/repos/${owner}/${repo}/git/trees/${info.sha}?recursive=1`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    log.error(
      `⚠️  Erreur /git/trees pour ${owner}/${repo}@${branch}: ${res.status} ${res.statusText} (${body.slice(
        0,
        200,
      )}...)`,
    );
    return { paths: [], resolvedRef: info.resolvedRef };
  }

  const data = (await res.json()) as { tree?: Array<{ path?: string; type?: string }> };
  const tree =
    data.tree
      ?.filter(i => i.type === "blob" && typeof i.path === "string")
      .map(i => ({
        path: i.path!,
        type: i.type!,
      })) ?? [];
  return { paths: tree.map(i => i.path), resolvedRef: info.resolvedRef };
}

async function fetchRemoteRaw(owner: string, repo: string, branch: string, pathInRepo: string) {
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
 * Fetcher remote-tree : cherche les fichiers correspondants partout dans le repo (monorepo-friendly)
 */
export const fetchRemoteTree: FetcherFn = async (ctx, scanners: ScannerEntry[]): Promise<FileToAnalyze[]> => {
  if (ctx.mode !== "remote-tree") {
    throw new Error(`fetchRemoteTree appelé avec un mode non remote-tree: ${ctx.mode}`);
  }

  const { owner, repo, branch } = ctx;
  const files: FileToAnalyze[] = [];

  const { paths: allPaths, resolvedRef } = await listAllPaths(owner, repo, branch);
  if (!allPaths.length) return files;

  const limit = pLimit(5);
  const tasks: Array<Promise<FileToAnalyze | null>> = [];

  // On veut un lookup rapide par nom de fichier pour chaque analyzer
  // (FILE_NAME_ID = ["package.json", "deno.json", ...])
  for (const [analyzer, fileNames] of scanners) {
    for (const fileName of fileNames) {
      const matchingPaths = allPaths.filter(p => p.endsWith(`/${fileName}`) || p === fileName);

      for (const p of matchingPaths) {
        tasks.push(
          limit(async () => {
            const content = await fetchRemoteRaw(owner, repo, branch, p);
            if (!content) return null;
            const source = `${owner}/${repo}@${branch}:${p}`;
            return {
              analyzer,
              filename: p,
              source,
              requestedBranch: branch,
              resolvedBranch: resolvedRef,
              content,
            } as FileToAnalyze;
          }),
        );
      }
    }
  }

  const settled = await Promise.allSettled(tasks);
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value) files.push(s.value);
  }

  return files;
};
