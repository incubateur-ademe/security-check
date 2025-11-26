import { VulnMap, ScanResult, Match } from '../types';
import { createScanResult } from '../utils/common';
import semver from 'semver';
import { fetchTextIfExists } from '../utils/fetch';
import path from 'path';
import { promises as fs } from 'fs';

export async function scanPackageJsonRemote(
  affected: VulnMap,
  owner: string,
  repo: string,
  branch: string,
): Promise<ScanResult> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`;
  const raw = await fetchTextIfExists(url);
  if (!raw) return createScanResult(`package.json (${branch})`, [], false);

  const pkg = JSON.parse(raw);
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
  const matches: Match[] = [];

  for (const section of sections) {
    const deps = pkg[section as never] as Record<string, string> | undefined;
    if (!deps || typeof deps !== "object") continue;

    for (const [name, rangeSpec] of Object.entries<string>(deps)) {
      const vulnVersions = affected.get(name);
      if (!vulnVersions) continue;

      const validRange = semver.validRange(rangeSpec);
      if (!validRange) continue;

      const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.satisfies(v, validRange));
      if (!matchingVuln.length) continue;

      matches.push({
        source: `${owner}/${repo}@${branch}:package.json (${section})`,
        packageName: name,
        declaredVersion: rangeSpec,
        vulnerableVersions: matchingVuln,
      });
    }
  }

  return createScanResult(`package.json (${branch})`, matches, true);
}

export async function scanPackageJsonLocal(affected: VulnMap): Promise<ScanResult> {
  const file = path.join(process.cwd(), "package.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return createScanResult("package.json (déclarations de dépendances)", [], false);
  }

  const pkg = JSON.parse(raw);
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
  const matches: Match[] = [];

  for (const section of sections) {
    const deps = pkg[section as never] as Record<string, string> | undefined;
    if (!deps || typeof deps !== "object") continue;

    for (const [name, rangeSpec] of Object.entries<string>(deps)) {
      const vulnVersions = affected.get(name);
      if (!vulnVersions) continue;

      const validRange = semver.validRange(rangeSpec);
      if (!validRange) continue;

      const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.satisfies(v, validRange));
      if (!matchingVuln.length) continue;

      matches.push({
        source: `local:package.json (${section})`,
        packageName: name,
        declaredVersion: rangeSpec,
        vulnerableVersions: matchingVuln,
      });
    }
  }

  return createScanResult("package.json (déclarations de dépendances)", matches, true);
}