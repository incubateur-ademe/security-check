import { config } from "../config";
import { log } from "./log";

const GITHUB_API_URL = "https://api.github.com";

export function getGithubApiUrl() {
  return GITHUB_API_URL;
}

export function buildGithubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "User-Agent": "shai-hulud-ioc-checker",
    Accept: "application/vnd.github+json",
  };

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
  }

  return headers;
}

export interface GithubRepo {
  owner: string;
  name: string;
  defaultBranch: string | null;
  archived: boolean;
}

/**
 * Liste tous les repos publics d’une organisation GitHub.
 * - n’utilise que l’API publique
 * - respecte config.token si présent (meilleur quota)
 */
export async function listOrgRepos(org: string): Promise<GithubRepo[]> {
  const baseUrl = getGithubApiUrl();
  const headers = buildGithubHeaders();

  const perPage = 100;
  let page = 1;
  const repos: GithubRepo[] = [];

  log(1, `🔎 Récupération des repos publics pour l’orga "${org}"...`);

  // /orgs/:org/repos est paginé
  // type=public pour rester strict (pas de privés même avec token)
  while (true) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      type: "public",
    });

    const url = `${baseUrl}/orgs/${org}/repos?${params.toString()}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Erreur API GitHub /orgs/${org}/repos (page ${page}): ${res.status} ${res.statusText} - ${body.slice(
          0,
          300,
        )}...`,
      );
    }

    const data = (await res.json()) as any[];
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    for (const r of data) {
      if (!r || typeof r !== "object") continue;

      repos.push({
        owner: r.owner?.login ?? org,
        name: r.name,
        defaultBranch: r.default_branch ?? null,
        archived: Boolean(r.archived),
      });
    }

    if (data.length < perPage) break;
    page++;
  }

  log(1, `🔎 ${repos.length} repo(s) public(s) trouvés pour ${org}.`);
  return repos;
}
