import path from 'path';
import { VulnMap, ScanResult, Match } from '../types';
import { createScanResult, registerInstalledVersion } from '../utils/common';
import { promises as fs } from 'fs';
import semver from 'semver';
import { fetchTextIfExists } from '../utils/fetch';

/**
 * Scanner un fichier yarn.lock local
 */
export async function scanYarnLockLocal(affected: VulnMap): Promise<ScanResult> {
  const file = path.join(process.cwd(), "yarn.lock");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return createScanResult("yarn.lock", [], false);
  }

  const lines = raw.split(/\r?\n/);
  const installed = new Map<string, string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^[^\s].*:$/.test(line)) {
      const keyLine = line.trim().replace(/:$/, "");
      const descriptor = keyLine.replace(/^"+|"+$/g, "");
      let pkgName: string;

      if (descriptor.startsWith("@")) {
        const secondAt = descriptor.indexOf("@", 1);
        pkgName = secondAt === -1 ? descriptor : descriptor.substring(0, secondAt);
      } else {
        const at = descriptor.indexOf("@");
        pkgName = at === -1 ? descriptor : descriptor.substring(0, at);
      }

      let j = i + 1;
      let version: string | undefined;
      while (j < lines.length && /^\s/.test(lines[j])) {
        const l = lines[j].trim();
        const m = l.match(/^version\s*[: ]\s*"?([^"\s]+)"?/);
        if (m) {
          version = m[1];
          break;
        }
        j++;
      }

      if (pkgName && version && semver.valid(version)) {
        registerInstalledVersion(installed, pkgName, version);
      }

      i = j;
      continue;
    }

    i++;
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: "local:yarn.lock",
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult("yarn.lock", matches, true);
}

export async function scanYarnLockRemote(affected: VulnMap, owner: string, repo: string, branch: string): Promise<ScanResult> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/yarn.lock`;
  const raw = await fetchTextIfExists(url);
  if (!raw) return createScanResult(`yarn.lock (${branch})`, [], false);

  const lines = raw.split(/\r?\n/);
  const installed = new Map<string, string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^[^\s].*:$/.test(line)) {
      const keyLine = line.trim().replace(/:$/, "");
      const descriptor = keyLine.replace(/^"+|"+$/g, "");
      let pkgName: string;

      if (descriptor.startsWith("@")) {
        const secondAt = descriptor.indexOf("@", 1);
        pkgName = secondAt === -1 ? descriptor : descriptor.substring(0, secondAt);
      } else {
        const at = descriptor.indexOf("@");
        pkgName = at === -1 ? descriptor : descriptor.substring(0, at);
      }

      let j = i + 1;
      let version: string | undefined;
      while (j < lines.length && /^\s/.test(lines[j])) {
        const l = lines[j].trim();
        const m = l.match(/^version\s*[: ]\s*"?([^"\s]+)"?/);
        if (m) {
          version = m[1];
          break;
        }
        j++;
      }

      if (pkgName && version && semver.valid(version)) {
        registerInstalledVersion(installed, pkgName, version);
      }

      i = j;
      continue;
    }

    i++;
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: `${owner}/${repo}@${branch}:yarn.lock`,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult(`yarn.lock (${branch})`, matches, true);
}