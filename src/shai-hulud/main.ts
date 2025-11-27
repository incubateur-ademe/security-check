import { loadAffectedPackages } from './load-vuln';
import { Match, ScanResult } from './types';
import { config } from './config';
import { FileToAnalyze } from './scan/fetch-types';
import { fetchLocal } from './scan/fetch-local';
import { getScanners } from './scan';
import { fetchRemoteRoot } from './scan/fetch-remote-root';
import { fetchRemoteTree } from './scan/fetch-remote-tree';
import { fetchAllBranchesFromUI, listOrgRepos } from './utils/github';
import { printGlobalSummary } from './utils/print';
import { runWithConcurrency } from './utils/concurrency';

type RemoteScanJob = {
  owner: string;
  repo: string;
  branch: string;
};

async function buildRemoteRepos(): Promise<{ owner: string; name: string }[]> {
  const explicitRepos = (config.repos ?? []).map(spec => {
    const [owner, name] = spec.split("/");
    return { owner, name };
  });

  const orgRepos: { owner: string; name: string }[] = [];

  if (config.org) {
    const reposFromOrg = await listOrgRepos(config.org);
    orgRepos.push(
      ...reposFromOrg.map(r => ({
        owner: r.owner,
        name: r.name,
      })),
    );
  }

  const uniq = new Map<string, { owner: string; name: string }>();
  for (const r of [...explicitRepos, ...orgRepos]) {
    uniq.set(`${r.owner}/${r.name}`, r);
  }

  return Array.from(uniq.values());
}

async function buildRemoteJobs(): Promise<RemoteScanJob[]> {
  const repos = await buildRemoteRepos();
  const jobs: RemoteScanJob[] = [];

  for (const r of repos) {
    let branches: string[];

    if (config.allBranches) {
      if (!config.token) {
        console.error(`--all-branches nécessite --token pour éviter les rate-limit GitHub UI.`);
        process.exit(2);
      }

      const all = await fetchAllBranchesFromUI(r.owner, r.name, config.token);
      branches = all.length > 0 ? all : config.branches;
    } else {
      branches = config.branches;
    }

    for (const branch of branches) {
      jobs.push({ owner: r.owner, repo: r.name, branch });
    }
  }

  return jobs;
}

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

async function runRemoteJobs(
  jobs: RemoteScanJob[],
  scanners: Awaited<ReturnType<typeof getScanners>>,
  affected: Map<string, string[]>,
): Promise<ScanResult[]> {
  const fetcher = config.rootOnly ? fetchRemoteRoot : fetchRemoteTree;

  const task = async (job: RemoteScanJob): Promise<ScanResult[]> => {
    const ctx = config.rootOnly
      ? { mode: "remote-root" as const, owner: job.owner, repo: job.repo, branch: job.branch }
      : { mode: "remote-tree" as const, owner: job.owner, repo: job.repo, branch: job.branch };

    const files = await fetcher(ctx, scanners);
    return runAnalysisOnFiles(files, affected);
  };

  const nested = await runWithConcurrency(jobs, config.concurrency, task);
  return nested.flat();
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
    exitCode = allMatches.length > 0 ? 1 : 0;
  } else {
    exitCode = hasInstalledVuln ? 1 : 0;
  }

  process.exit(exitCode);
}

export async function runScan(): Promise<void> {
  const scanners = await getScanners();
  const affected = await loadAffectedPackages();
  const allScanResults: ScanResult[] = [];

  // --- Mode local ---
  if (!config.org && config.repos.length === 0) {
    const files = await fetchLocal({ mode: "local" }, scanners);
    const results = runAnalysisOnFiles(files, affected);
    allScanResults.push(...results);

    return finalizeAndExit("local", {}, results);
  }

  // --- Mode remote (GitHub) --repos, --org, ou les deux ---
  const jobs = await buildRemoteJobs();

  if (jobs.length === 0) {
    finalizeAndExit(
      config.org && config.repos.length > 0 ? "repos" : config.org ? "org" : "repos",
      {
        org: config.org ?? undefined,
        repos: config.repos,
        branches: config.branches,
        allBranches: config.allBranches ?? false,
      },
      [],
    );
  }

  const results = await runRemoteJobs(jobs, scanners, affected);

  finalizeAndExit(
    config.org && config.repos.length > 0 ? "repos" : config.org ? "org" : "repos",
    {
      org: config.org ?? undefined,
      repos: config.repos,
      branches: config.branches,
      allBranches: config.allBranches ?? false,
    },
    results,
  );
}
