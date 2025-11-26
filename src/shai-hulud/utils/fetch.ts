import { log } from './log';

export async function fetchTextIfExists(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3.raw",
      "User-Agent": "shai-hulud-ioc-checker",
    },
  });
  if (!res.ok) return null;
  return res.text();
}

export async function fetchAllBranchesFromUI(owner: string, repo: string): Promise<string[]> {
  const names = new Set<string>();
  let page = 1;

  while (true) {
    const url = `https://github.com/${owner}/${repo}/branches/all.json?page=${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "shai-hulud-ioc-checker",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      log(1, `⚠️  Impossible de récupérer les branches via UI pour ${owner}/${repo} (page ${page}): ${res.status}`);
      break;
    }

    const json = (await res.json()) as any;
    const payload = json?.payload;
    const branches: any[] = payload?.branches ?? [];
    const hasMore = Boolean(payload?.has_more);

    for (const b of branches) {
      if (typeof b?.name === "string") {
        names.add(b.name);
      }
    }

    if (!hasMore) break;
    page++;
  }

  const list = Array.from(names);
  log(2, `Branches UI ${owner}/${repo}: ${list.join(", ") || "(aucune)"}`);
  return list;
}

export async function fetchOrgRepos(org: string): Promise<Array<{ name: string; owner: { login: string } }>> {
  const repos: Array<{ name: string; owner: { login: string } }> = [];
  let page = 1;

  while (true) {
    const url = `https://api.github.com/orgs/${org}/repos?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "shai-hulud-ioc-checker",
      },
    });

    if (!res.ok) {
      throw new Error(`Erreur API GitHub pour org ${org}: ${res.status} ${res.statusText}`);
    }

    const batch = (await res.json()) as Array<{ name: string; owner: { login: string } }>;
    if (!batch.length) break;

    repos.push(...batch);

    if (batch.length < 100) break;
    page++;
  }

  return repos;
}