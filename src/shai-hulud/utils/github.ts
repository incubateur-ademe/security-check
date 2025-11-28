import { config } from "../config";
import { log } from "./logger";

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

  log.info(`🔎 Récupération des repos publics pour l’orga "${org}"...`);

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
      const body = await res.text().catch(() => "");
      log.warn(
        `⚠️ Erreur API GitHub /orgs/${org}/repos (page ${page}): ${res.status} ${res.statusText} - ${body.slice(0, 300)}...`,
      );
      // Be resilient: stop pagination and return what we collected so far for this org
      break;
    }

    const data = (await res.json()) as GithubApiRepo[];
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    interface GithubApiRepoOwner {
      login?: string;
    }

    interface GithubApiRepo {
      owner?: GithubApiRepoOwner;
      name?: string;
      default_branch?: string | null;
      archived?: boolean;
    }

    for (const r of data) {
      if (!r || typeof r !== "object" || typeof r.name !== "string") continue;

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

  log.info(`🔎 ${repos.length} repo(s) public(s) trouvés pour ${org}.`);
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
export async function fetchAllBranchesFromUI(owner: string, repo: string, token?: string): Promise<string[]> {
  // Ce JSON provient du front de GitHub, pas de l'API REST officielle.
  const url = `https://github.com/${owner}/${repo}/branches/all.json`;

  const headers: Record<string, string> = {
    "User-Agent": "shai-hulud-checker",
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { headers });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Impossible de récupérer /branches/all.json pour ${owner}/${repo} (404).`);
      }
      throw new Error(`Erreur HTTP ${res.status} ${res.statusText} sur /branches/all.json pour ${owner}/${repo}`);
    }

    const data: unknown = await res.json();

    if (!data || typeof data !== "object") {
      throw new Error(`Format inattendu: body non-objet depuis /branches/all.json`);
    }

    const payload = (data as Record<string, unknown>).payload;
    if (!payload || !Array.isArray((payload as Record<string, unknown>).branches)) {
      throw new Error(`Format inattendu: pas de payload.branches dans /branches/all.json`);
    }

    const branches = (payload as Record<string, unknown>).branches as unknown[];
    return branches
      .map(b =>
        b && typeof b === "object" && typeof (b as Record<string, unknown>).name === "string"
          ? (b as Record<string, unknown>).name
          : "",
      )
      .filter(Boolean) as string[];
  } catch (err) {
    log.error(`[ERROR] fetchAllBranchesFromUI ${owner}/${repo}: ${(err as Error).message}`);
    return []; // Fallback: on retourne vide → le code appelant pourra repasser sur les branches par défaut.
  }
}
