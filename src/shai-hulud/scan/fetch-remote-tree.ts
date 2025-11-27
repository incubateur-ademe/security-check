// scan/fetch-remote-tree.ts
import { FetcherFn, FileToAnalyze } from "./fetch-types";
import type { ScannerEntry } from "./index";
import { buildGithubHeaders, getGithubApiUrl } from "../utils/github";
import { log } from "../utils/log";

async function fetchBranchSha(owner: string, repo: string, branch: string): Promise<string | null> {
  const baseUrl = getGithubApiUrl();
  const headers = buildGithubHeaders();
  const url = `${baseUrl}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    log(1, `⚠️  Impossible de récupérer la ref pour ${owner}/${repo}@${branch}: ${res.status} ${res.statusText} (${body.slice(0, 200)}...)`);
    return null;
  }

  const data = (await res.json()) as any;
  const sha = data?.object?.sha;
  if (!sha) {
    log(1, `⚠️  Réponse /git/refs sans SHA pour ${owner}/${repo}@${branch}`);
    return null;
  }

  return sha;
}

async function listAllPaths(owner: string, repo: string, branch: string): Promise<string[]> {
  const sha = await fetchBranchSha(owner, repo, branch);
  if (!sha) return [];

  const baseUrl = getGithubApiUrl();
  const headers = buildGithubHeaders();
  const url = `${baseUrl}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    log(
      1,
      `⚠️  Erreur /git/trees pour ${owner}/${repo}@${branch}: ${res.status} ${res.statusText} (${body.slice(
        0,
        200,
      )}...)`,
    );
    return [];
  }

  const data = (await res.json()) as any;
  const tree: Array<{ path: string; type: string }> = data?.tree ?? [];

  return tree.filter(i => i.type === "blob" && typeof i.path === "string").map(i => i.path);
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

  const allPaths = await listAllPaths(owner, repo, branch);
  if (!allPaths.length) return files;

  // On veut un lookup rapide par nom de fichier pour chaque analyzer
  // (FILE_NAME_ID = ["package.json", "deno.json", ...])
  for (const [analyzer, fileNames] of scanners) {
    for (const fileName of fileNames) {
      const matchingPaths = allPaths.filter(p => p.endsWith(`/${fileName}`) || p === fileName);

      for (const p of matchingPaths) {
        const content = await fetchRemoteRaw(owner, repo, branch, p);
        if (!content) continue;

        const source = `${owner}/${repo}@${branch}:${p}`;
        files.push({
          analyzer,
          filename: p,
          source,
          content,
        });
      }
    }
  }

  return files;
};
