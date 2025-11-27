import { config } from "../config";
import { logger } from "./logger";

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

  logger(1, `🔎 Récupération des repos publics pour l’orga "${org}"...`);

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

  logger(1, `🔎 ${repos.length} repo(s) public(s) trouvés pour ${org}.`);
  return repos;
}

/**
 * Récupère toutes les branches visibles dans l’UI GitHub
 * via l’endpoint non documenté /branches/all.json.
 *
 * Exemple de payload:
 * {
 *   "payload": {
 *     "branches": [
 *       { "name": "preprod", ... },
 *       { "name": "NGC-2714", ... },
 *       { "name": "main", ... }
 *     ]
 *   }
 * }
 */
export async function fetchAllBranchesFromUI(
  owner: string,
  repo: string,
  token?: string,
): Promise<string[]> {
  // Ce JSON provient du front de GitHub, pas de l'API REST officielle.
  const url = `https://github.com/${owner}/${repo}/branches/all.json`;

  const headers: Record<string, string> = {
    "User-Agent": "shai-hulud-checker",
    "Accept": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { headers });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Impossible de récupérer /branches/all.json pour ${owner}/${repo} (404).`);
      }
      throw new Error(
        `Erreur HTTP ${res.status} ${res.statusText} sur /branches/all.json pour ${owner}/${repo}`
      );
    }

    const data = await res.json();

    if (!data || !data.payload || !Array.isArray(data.payload.branches)) {
      throw new Error(`Format inattendu: pas de payload.branches dans /branches/all.json`);
    }

    return data.payload.branches.map((b: any) => b.name).filter(Boolean);

  } catch (err) {
    console.error(`[ERROR] fetchAllBranchesFromUI ${owner}/${repo}: ${(err as Error).message}`);
    return []; // Fallback: on retourne vide → le code appelant pourra repasser sur les branches par défaut.
  }
}

