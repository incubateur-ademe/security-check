import path from 'path';
import { VulnMap, ScanResult, Match } from '../types';
import { createScanResult, registerInstalledVersion } from '../utils/common';
import { promises as fs } from 'fs';
import semver from 'semver';
import { parse as parseYaml } from 'yaml';
import { fetchTextIfExists } from '../utils/fetch';

export async function scanPnpmLockLocal(affected: VulnMap): Promise<ScanResult> {
  const file = path.join(process.cwd(), "pnpm-lock.yaml");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return createScanResult("pnpm-lock.yaml", [], false);
  }

  const data = parseYaml(raw) as any;
  const installed = new Map<string, string>();
  const pkgs = data?.packages || data?.dependencies || {};

  for (const [key, info] of Object.entries<any>(pkgs)) {
    const match = key.match(/^\/(.+?)@([^@]+)$/);
    if (!match) continue;
    const [, name, version] = match;
    if (!semver.valid(version)) continue;
    registerInstalledVersion(installed, name, version);
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: "local:pnpm-lock.yaml",
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult("pnpm-lock.yaml", matches, true);
}

export async function scanPnpmLockRemote(affected: VulnMap, owner: string, repo: string, branch: string): Promise<ScanResult> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/pnpm-lock.yaml`;
  const raw = await fetchTextIfExists(url);
  if (!raw) return createScanResult(`pnpm-lock.yaml (${branch})`, [], false);

  const data = parseYaml(raw) as any;
  const installed = new Map<string, string>();
  const pkgs = data?.packages || data?.dependencies || {};

  for (const [key, info] of Object.entries<any>(pkgs)) {
    const match = key.match(/^\/(.+?)@([^@]+)$/);
    if (!match) continue;
    const [, name, version] = match;
    if (!semver.valid(version)) continue;
    registerInstalledVersion(installed, name, version);
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: `${owner}/${repo}@${branch}:pnpm-lock.yaml`,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult(`pnpm-lock.yaml (${branch})`, matches, true);
}