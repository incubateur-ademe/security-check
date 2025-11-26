import path from 'path';
import { VulnMap, ScanResult, Match } from '../types';
import { createScanResult, registerInstalledVersion } from '../utils/common';
import { promises as fs } from 'fs';
import semver from 'semver';
import { fetchTextIfExists } from '../utils/fetch';

/**
 * Scanner un fichier npm-lock.json local
 */
export async function scanNpmLockLocal(affected: VulnMap, filename: string): Promise<ScanResult> {
  const file = path.join(process.cwd(), filename);
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return createScanResult(filename, [], false);
  }

  const lock = JSON.parse(raw);
  const installed = new Map<string, string>();

  function walkDeps(deps: any) {
    if (!deps || typeof deps !== "object") return;
    for (const [name, info] of Object.entries<any>(deps)) {
      if (info && typeof info === "object") {
        if (typeof info.version === "string" && semver.valid(info.version)) {
          registerInstalledVersion(installed, name, info.version);
        }
        if (info.dependencies) {
          walkDeps(info.dependencies);
        }
      }
    }
  }

  if (lock.dependencies) {
    walkDeps(lock.dependencies);
  }

  if (lock.packages && typeof lock.packages === "object") {
    for (const [key, pkgInfo] of Object.entries<any>(lock.packages)) {
      if (!pkgInfo || typeof pkgInfo !== "object" || typeof pkgInfo.version !== "string") continue;
      if (!key) continue;
      const parts = key.split("node_modules/");
      const name = parts[parts.length - 1];
      if (!name) continue;
      if (!semver.valid(pkgInfo.version)) continue;
      registerInstalledVersion(installed, name, pkgInfo.version);
    }
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;

    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: `local:${filename}`,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult(filename, matches, true);
}

export async function scanNpmLockRemote(
  affected: VulnMap,
  owner: string,
  repo: string,
  branch: string,
  filename: string,
): Promise<ScanResult> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filename}`;
  const raw = await fetchTextIfExists(url);
  if (!raw) return createScanResult(`${filename} (${branch})`, [], false);

  const lock = JSON.parse(raw);
  const installed = new Map<string, string>();

  function walkDeps(deps: any) {
    if (!deps || typeof deps !== "object") return;
    for (const [name, info] of Object.entries<any>(deps)) {
      if (info && typeof info === "object") {
        if (typeof info.version === "string" && semver.valid(info.version)) {
          registerInstalledVersion(installed, name, info.version);
        }
        if (info.dependencies) {
          walkDeps(info.dependencies);
        }
      }
    }
  }

  if (lock.dependencies) {
    walkDeps(lock.dependencies);
  }

  if (lock.packages && typeof lock.packages === "object") {
    for (const [key, pkgInfo] of Object.entries<any>(lock.packages)) {
      if (!pkgInfo || typeof pkgInfo !== "object" || typeof pkgInfo.version !== "string") continue;
      if (!key) continue;
      const parts = key.split("node_modules/");
      const name = parts[parts.length - 1];
      if (!name) continue;
      if (!semver.valid(pkgInfo.version)) continue;
      registerInstalledVersion(installed, name, pkgInfo.version);
    }
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: `${owner}/${repo}@${branch}:${filename}`,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult(`${filename} (${branch})`, matches, true);
}