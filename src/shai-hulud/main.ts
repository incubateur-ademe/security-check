import { loadAffectedPackages } from './load-vuln';
import { Match, ScanResult } from './types';
import { config } from './config';
import { FetchContext, FileToAnalyze } from './scan/fetch-types';
import { fetchLocal } from './scan/fetch-local';
import { getScanners } from './scan';
import { fetchRemoteRoot } from './scan/fetch-remote-root';
import { fetchRemoteTree } from './scan/fetch-remote-tree';
import { listOrgRepos } from './utils/github';
import { printGlobalSummary } from './utils/print';

export function runAnalysisOnFiles(
  files: FileToAnalyze[],
  affected: Map<string, string[]>,
): ScanResult[] {
  const results: ScanResult[] = [];

  for (const f of files) {
    const matches: Match[] = f.analyzer({
      content: f.content,
      source: f.source,
      affected,
    });

    results.push({
      analyzed: true,
      label: f.source,
      matches,
    });
  }

  return results;
}

/**
 * Point final : affiche le summary puis exit code correct.
 */
export function finalizeAndExit(
  mode: "local" | "repos" | "org",
  ctx: {
    org?: string;
    repos?: string[];
    branches?: string[];
    allBranches?: boolean;
  },
  results: ScanResult[],
): never {
  const allMatches = results.flatMap(r => r.matches);

  // summary JSON ou texte
  printGlobalSummary(mode, ctx, allMatches);

  // Gestion du `--fail-on-declared-only`
  const hasInstalledVuln = allMatches.some(m => m.installedVersion);

  let exitCode = 0;
  if (config.failOnDeclaredOnly) {
    // même une vuln déclarée seulement → exit 1
    exitCode = allMatches.length > 0 ? 1 : 0;
  } else {
    // seulement les lockfiles → exit 1
    exitCode = hasInstalledVuln ? 1 : 0;
  }

  process.exit(exitCode);
}

export async function runScan(): Promise<void> {
  const scanners = await getScanners();
  const affected = await loadAffectedPackages();
  const allScanResults = [];

  // --- Mode local ---
  if (!config.org && config.repos.length === 0) {
    const files = await fetchLocal({ mode: "local" }, scanners);
    const results = runAnalysisOnFiles(files, affected);
    allScanResults.push(...results);

    return finalizeAndExit("local", {}, results);
  }

  // --- Mode remote list of repos ---
  if (config.repos.length > 0) {
    for (const spec of config.repos) {
      const [owner, repo] = spec.split("/");

      for (const branch of config.branches) {
        const ctx: FetchContext = config.rootOnly
          ? { mode: "remote-root", owner, repo, branch }
          : { mode: "remote-tree", owner, repo, branch };

        const fetcher = config.rootOnly ? fetchRemoteRoot : fetchRemoteTree;
        const files = await fetcher(ctx, scanners);
        const results = runAnalysisOnFiles(files, affected);
        allScanResults.push(...results);
      }
    }

    return finalizeAndExit("repos", { repos: config.repos, branches: config.branches, allBranches: config.allBranches }, allScanResults);
  }

  // --- Mode org ---
  if (config.org) {
    const repos = await listOrgRepos(config.org);

    for (const r of repos) {
      for (const branch of config.branches) {
        const ctx: FetchContext = config.rootOnly
          ? { mode: "remote-root", owner: r.owner, repo: r.name, branch }
          : { mode: "remote-tree", owner: r.owner, repo: r.name, branch };

        const fetcher = config.rootOnly ? fetchRemoteRoot : fetchRemoteTree;
        const files = await fetcher(ctx, scanners);
        const results = runAnalysisOnFiles(files, affected);
        allScanResults.push(...results);
      }
    }

    return finalizeAndExit(
      "org",
      { org: config.org, branches: config.branches, allBranches: config.allBranches },
      allScanResults,
    );
  }
}
