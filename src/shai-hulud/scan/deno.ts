import path from 'path';
import { VulnMap, ScanResult, Match } from '../types';
import { parseJsonLoose, createScanResult, registerInstalledVersion } from '../utils/common';
import { promises as fs } from 'fs';
import semver from 'semver';
import { fetchTextIfExists } from '../utils/fetch';

export async function scanDenoConfigLocal(affected: VulnMap): Promise<ScanResult> {
  const cwd = process.cwd();
  const configs = ["deno.json", "deno.jsonc"];
  const matches: Match[] = [];
  let analyzed = false;

  for (const filename of configs) {
    const file = path.join(cwd, filename);
    let raw: string;
    try {
      raw = await fs.readFile(file, "utf8");
    } catch {
      continue;
    }

    let config: any;
    try {
      config = parseJsonLoose(raw);
    } catch {
      continue;
    }

    analyzed = true;
    const imports = config?.imports;
    if (!imports || typeof imports !== "object") continue;

    for (const [alias, spec] of Object.entries<any>(imports)) {
      if (typeof spec !== "string") continue;
      if (!spec.startsWith("npm:")) continue;

      const npmSpec = spec.slice(4);
      const at = npmSpec.indexOf("@");
      if (at === -1) continue;

      const name = npmSpec.slice(0, at);
      const rangeSpec = npmSpec.slice(at + 1);

      const vulnVersions = affected.get(name);
      if (!vulnVersions) continue;

      const validRange = semver.validRange(rangeSpec);
      if (!validRange) continue;

      const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.satisfies(v, validRange));
      if (!matchingVuln.length) continue;

      matches.push({
        source: `local:${filename} (imports alias=${alias})`,
        packageName: name,
        declaredVersion: rangeSpec,
        vulnerableVersions: matchingVuln,
      });
    }
  }

  return createScanResult("deno.json[.c] (imports npm:)", matches, analyzed);
}

export async function scanDenoLockLocal(affected: VulnMap): Promise<ScanResult> {
  const file = path.join(process.cwd(), "deno.lock");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return createScanResult("deno.lock", [], false);
  }

  let lock: any;
  try {
    lock = JSON.parse(raw);
  } catch {
    return createScanResult("deno.lock", [], false);
  }

  const installed = new Map<string, string>();
  const npmSection = lock?.npm;

  if (npmSection && typeof npmSection === "object") {
    for (const [key] of Object.entries<any>(npmSection)) {
      const at = key.lastIndexOf("@");
      if (at <= 0 || at === key.length - 1) continue;

      let name = key.slice(0, at);
      const version = key.slice(at + 1);
      if (!semver.valid(version)) continue;

      if (name.startsWith("npm:")) name = name.slice(4);

      registerInstalledVersion(installed, name, version);
    }
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: "local:deno.lock",
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult("deno.lock", matches, true);
}

export async function scanDenoConfigRemote(
  affected: VulnMap,
  owner: string,
  repo: string,
  branch: string,
): Promise<ScanResult> {
  const filenames = ["deno.json", "deno.jsonc"];
  const matches: Match[] = [];
  let analyzed = false;

  for (const filename of filenames) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filename}`;
    const raw = await fetchTextIfExists(url);
    if (!raw) continue;

    let config: any;
    try {
      config = parseJsonLoose(raw);
    } catch {
      continue;
    }

    analyzed = true;
    const imports = config?.imports;
    if (!imports || typeof imports !== "object") continue;

    for (const [alias, spec] of Object.entries<any>(imports)) {
      if (typeof spec !== "string") continue;
      if (!spec.startsWith("npm:")) continue;

      const npmSpec = spec.slice(4);
      const at = npmSpec.indexOf("@");
      if (at === -1) continue;

      const name = npmSpec.slice(0, at);
      const rangeSpec = npmSpec.slice(at + 1);

      const vulnVersions = affected.get(name);
      if (!vulnVersions) continue;

      const validRange = semver.validRange(rangeSpec);
      if (!validRange) continue;

      const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.satisfies(v, validRange));
      if (!matchingVuln.length) continue;

      matches.push({
        source: `${owner}/${repo}@${branch}:${filename} (imports alias=${alias})`,
        packageName: name,
        declaredVersion: rangeSpec,
        vulnerableVersions: matchingVuln,
      });
    }
  }

  return createScanResult(`deno config (${branch})`, matches, analyzed);
}

export async function scanDenoLockRemote(
  affected: VulnMap,
  owner: string,
  repo: string,
  branch: string,
): Promise<ScanResult> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/deno.lock`;
  const raw = await fetchTextIfExists(url);
  if (!raw) return createScanResult(`deno.lock (${branch})`, [], false);

  let lock: any;
  try {
    lock = JSON.parse(raw);
  } catch {
    return createScanResult(`deno.lock (${branch})`, [], false);
  }

  const installed = new Map<string, string>();
  const npmSection = lock?.npm;

  if (npmSection && typeof npmSection === "object") {
    for (const [key] of Object.entries<any>(npmSection)) {
      const at = key.lastIndexOf("@");
      if (at <= 0 || at === key.length - 1) continue;

      let name = key.slice(0, at);
      const version = key.slice(at + 1);
      if (!semver.valid(version)) continue;
      if (name.startsWith("npm:")) name = name.slice(4);

      registerInstalledVersion(installed, name, version);
    }
  }

  const matches: Match[] = [];
  for (const [name, version] of installed.entries()) {
    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    const matchingVuln = vulnVersions.filter(v => semver.valid(v) && semver.eq(v, version));
    if (!matchingVuln.length) continue;

    matches.push({
      source: `${owner}/${repo}@${branch}:deno.lock`,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return createScanResult(`deno.lock (${branch})`, matches, true);
}