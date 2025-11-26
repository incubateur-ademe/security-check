import { VulnMap, ScanResult, Match } from '../types';
import { createScanResult, parseJsonLoose, registerInstalledVersion } from '../utils/common';
import semver from 'semver';
import path from 'path';
import { promises as fs } from 'fs';
import { fetchTextIfExists } from '../utils/fetch';

export async function scanBunLockRemote(
  affected: VulnMap,
  owner: string,
  repo: string,
  branch: string,
): Promise<ScanResult> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/bun.lock`;
  const raw = await fetchTextIfExists(url);
  if (!raw) return createScanResult(`bun.lock (${branch})`, [], false);

  let lock: any;
  try {
    lock = parseJsonLoose(raw);
  } catch {
    return createScanResult(`bun.lock (${branch})`, [], false);
  }

  const pkgs = lock?.packages;
  if (!pkgs || typeof pkgs !== "object") {
    return createScanResult(`bun.lock (${branch})`, [], true);
  }

  const installed = new Map<string, string>();

  for (const [, arr] of Object.entries<any>(pkgs)) {
    if (!Array.isArray(arr) || typeof arr[0] !== "string") continue;
    const tupleId = arr[0] as string;
    const at = tupleId.lastIndexOf("@");
    if (at <= 0 || at === tupleId.length - 1) continue;

    let name = tupleId.slice(0, at);
    const version = tupleId.slice(at + 1);

    if (!semver.valid(version)) continue;
    if (name.startsWith("npm:")) name = name.slice(4);
    registerInstalledVersion(installed, name, version);
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: `${owner}/${repo}@${branch}:bun.lock`,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult(`bun.lock (${branch})`, matches, true);
}

export async function scanBunLockLocal(affected: VulnMap): Promise<ScanResult> {
  const file = path.join(process.cwd(), "bun.lock");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return createScanResult("bun.lock", [], false);
  }

  let lock: any;
  try {
    lock = parseJsonLoose(raw);
  } catch {
    return createScanResult("bun.lock", [], false);
  }

  const pkgs = lock?.packages;
  if (!pkgs || typeof pkgs !== "object") {
    return createScanResult("bun.lock", [], true);
  }

  const installed = new Map<string, string>();

  for (const [, arr] of Object.entries<any>(pkgs)) {
    if (!Array.isArray(arr) || typeof arr[0] !== "string") continue;
    const tupleId = arr[0] as string;

    const at = tupleId.lastIndexOf("@");
    if (at <= 0 || at === tupleId.length - 1) continue;

    let name = tupleId.slice(0, at);
    const version = tupleId.slice(at + 1);

    if (!semver.valid(version)) continue;
    if (name.startsWith("npm:")) name = name.slice(4);

    registerInstalledVersion(installed, name, version);
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: "local:bun.lock",
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult("bun.lock", matches, true);
}
