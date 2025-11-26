#!/usr/bin/env tsx

/**
 * Shai-Hulud 2.0 IOC checker (DataDog)
 *
 * Source IOC:
 *   https://raw.githubusercontent.com/DataDog/indicators-of-compromise/refs/heads/main/shai-hulud-2.0/consolidated_iocs.csv
 *
 * Modes :
 *   - Sans arguments -> scan du projet local (cwd)
 *   - --repos org1/repo1,org2/repo2 -> scan de ces dépôts GitHub
 *   - --org mon-orga -> scan de tous les repos publics de l’orga
 *
 * Fichiers supportés (local & remote) :
 *   - Node :
 *     - package.json
 *     - package-lock.json / npm-shrinkwrap.json
 *     - yarn.lock
 *     - pnpm-lock.yaml
 *   - Deno :
 *     - deno.json / deno.jsonc (imports "npm:")
 *     - deno.lock (section "npm")
 *   - Bun :
 *     - bun.lock (texte JSONC-like)
 *
 * CLI :
 *   --org <name>
 *   --repos owner1/repo1,owner2/repo2
 *   --json
 *   --fail-on-declared-only[=true|false]
 *   --v | --vv | --vvv
 *   --help | -h
 *   --version
 *   --concurrency=N   (nombre de requêtes GitHub parallèles, défaut: 10)
 *   --branches="main,master"
 *   --all-branches   (utilise https://github.com/<org>/<repo>/branches/all.json?page=N)
 *
 * Exit codes :
 *   - 0 : aucun IOC trouvé (pertinent selon fail-on-declared-only)
 *   - 1 : IOC trouvé
 *   - 2 : erreur de runtime (réseau, parse, etc.)
 */

import { ScanResult } from './types';
import { computeExitCode } from './utils/common';
import { config, VERSION } from './config';
import { log } from './utils/log';
import { parseArgsToConfig, printHelp } from './utils/args';
import { printScanResult, printGlobalSummary } from './utils/print';
import { loadAffectedPackages } from './load-vuln';
import { scanBunLockLocal } from './scan/bun';
import { scanDenoConfigLocal, scanDenoLockLocal } from './scan/deno';
import { scanNpmLockLocal } from './scan/npm';
import { scanPackageJsonLocal } from './scan/packagejson';
import { scanPnpmLockLocal } from './scan/pnpm';
import { scanYarnLockLocal } from './scan/yarn1';
import { scanRemoteRepo } from './scanner';
import { fetchOrgRepos } from './utils/fetch';
import { runWithConcurrency } from './utils/concurrency';


async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  if (args.includes("--version")) {
    console.log(VERSION);
    return;
  }

  parseArgsToConfig(args);

  const affected = await loadAffectedPackages();

  // MODE 1: local
  if (!config.org && config.repos.length === 0) {
    log(1, "\n🖥  Mode: scan du projet local (cwd)\n");

    const [
      pkgJsonResult,
      npmLockResult,
      shrinkwrapResult,
      pnpmResult,
      yarnResult,
      denoCfgResult,
      denoLockResult,
      bunLockResult,
    ] = await Promise.all([
      scanPackageJsonLocal(affected),
      scanNpmLockLocal(affected, "package-lock.json"),
      scanNpmLockLocal(affected, "npm-shrinkwrap.json"),
      scanPnpmLockLocal(affected),
      scanYarnLockLocal(affected),
      scanDenoConfigLocal(affected),
      scanDenoLockLocal(affected),
      scanBunLockLocal(affected),
    ]);

    const results = [
      pkgJsonResult,
      npmLockResult,
      shrinkwrapResult,
      pnpmResult,
      yarnResult,
      denoCfgResult,
      denoLockResult,
      bunLockResult,
    ];

    for (const r of results) {
      printScanResult(r);
    }

    const allMatches = results.flatMap(r => r.matches);
    printGlobalSummary("local", {}, allMatches);
    process.exitCode = computeExitCode(allMatches);
    return;
  }

  // MODE 2: --repos
  if (config.repos.length > 0) {
    log(1, "\n🌐 Mode: scan de dépôts GitHub (--repos)\n");
    log(1, `➡️  ${config.repos.length} repo(s) à analyser, concurrency=${config.concurrency}`);

    const allResults: ScanResult[] = [];

    await runWithConcurrency(config.repos, config.concurrency, async spec => {
      const [owner, repo] = spec.split("/");
      if (!owner || !repo) {
        console.error(`⚠️ Repo invalide "${spec}", attendu: owner/repo`);
        return;
      }
      const results = await scanRemoteRepo(affected, owner, repo, config.branches, config.allBranches);
      allResults.push(...results);
      for (const r of results) {
        printScanResult(r);
      }
    });

    const allMatches = allResults.flatMap(r => r.matches);
    printGlobalSummary(
      "repos",
      {
        repos: config.repos,
        branches: config.branches,
        allBranches: config.allBranches,
      },
      allMatches,
    );

    process.exitCode = computeExitCode(allMatches);
    return;
  }

  // MODE 3: --org
  if (config.org) {
    log(1, `\n🏢 Mode: scan de tous les repos publics de l’orga "${config.org}"\n`);
    const orgRepos = await fetchOrgRepos(config.org);
    log(1, `➡️ ${orgRepos.length} repo(s) public(s) trouvés pour ${config.org}.`);

    const allResults: ScanResult[] = [];

    await runWithConcurrency(orgRepos, config.concurrency, async r => {
      const results = await scanRemoteRepo(affected, r.owner.login, r.name, config.branches, config.allBranches);
      allResults.push(...results);
      for (const res of results) {
        printScanResult(res);
      }
    });

    const allMatches = allResults.flatMap(r => r.matches);
    printGlobalSummary(
      "org",
      {
        org: config.org,
        branches: config.branches,
        allBranches: config.allBranches,
      },
      allMatches,
    );

    process.exitCode = computeExitCode(allMatches);
  }
}

try {
  await main()
} catch (err) {
  console.error("Erreur pendant le scan:", err);
  process.exitCode = 2;
}
