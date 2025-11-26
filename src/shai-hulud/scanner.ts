import { scanBunLockRemote } from './scan/bun';
import { scanDenoConfigRemote, scanDenoLockRemote } from './scan/deno';
import { scanNpmLockRemote } from './scan/npm';
import { scanPackageJsonRemote } from './scan/packagejson';
import { scanPnpmLockRemote } from './scan/pnpm';
import { scanYarnLockRemote } from './scan/yarn1';
import { VulnMap, ScanResult, Match } from './types';
import { fetchAllBranchesFromUI } from './utils/fetch';
import { log } from './utils/log';

export async function scanRemoteRepoBranch(
  affected: VulnMap,
  owner: string,
  repo: string,
  branch: string,
): Promise<ScanResult[]> {
  log(2, `→ Scan branche ${owner}/${repo}@${branch}`);

  const results = await Promise.all([
    scanPackageJsonRemote(affected, owner, repo, branch),
    scanNpmLockRemote(affected, owner, repo, branch, "package-lock.json"),
    scanNpmLockRemote(affected, owner, repo, branch, "npm-shrinkwrap.json"),
    scanPnpmLockRemote(affected, owner, repo, branch),
    scanYarnLockRemote(affected, owner, repo, branch),
    scanDenoConfigRemote(affected, owner, repo, branch),
    scanDenoLockRemote(affected, owner, repo, branch),
    scanBunLockRemote(affected, owner, repo, branch),
  ]);

  return results;
}

export async function scanRemoteRepo(
  affected: VulnMap,
  owner: string,
  repo: string,
  branches: string[],
  allBranchesFlag: boolean,
): Promise<ScanResult[]> {
  log(1, `📦 Scan GitHub repo: ${owner}/${repo}`);

  let branchesToScan = branches;
  if (allBranchesFlag) {
    branchesToScan = await fetchAllBranchesFromUI(owner, repo);
    if (!branchesToScan.length) {
      log(1, `⚠️  Aucune branche trouvée via UI pour ${owner}/${repo}`);
      return [];
    }
  }

  const allResults: ScanResult[] = [];
  for (const branch of branchesToScan) {
    const branchResults = await scanRemoteRepoBranch(affected, owner, repo, branch);
    if (branchResults.some(r => r.analyzed)) {
      allResults.push(...branchResults);
    }
  }
  return allResults;
}