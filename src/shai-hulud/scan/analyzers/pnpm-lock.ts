import semver from "semver";
import { parse as parseYaml } from "yaml";

import { type AnalyzeFn, type Match } from "../../types";
import { log } from "../../utils/logger";

interface PnpmLockedPackage {
  resolution?: {
    integrity?: string;
  };
  dependencies?: Record<string, string>;
  dev?: boolean;
  optional?: boolean;
}

interface PnpmLockData {
  lockfileVersion?: number | string;
  packages?: Record<string, PnpmLockedPackage>;
  dependencies?: Record<string, string>;
}

function registerInstalledVersion(installed: Map<string, string>, name: string, version: string) {
  if (!semver.valid(version)) return;
  const current = installed.get(name);
  if (!current || semver.gt(version, current)) {
    installed.set(name, version);
  }
}

export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  let data: PnpmLockData;
  try {
    const parsed = parseYaml(content) as unknown;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("pnpm-lock: parsed YAML is not an object");
    }
    data = parsed as PnpmLockData;
  } catch {
    log.debug(`pnpm-lock analyzer: unable to parse content as YAML, skipping file.`);
    return [];
  }

  const installed = new Map<string, string>();

  // pnpm v6/v7+
  const pkgs = data.packages ?? data.dependencies;

  if (!pkgs) {
    return [];
  }

  for (const key of Object.keys(pkgs)) {
    const match = /^\/(.+?)@([^@]+)$/.exec(key);
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
      source,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return matches;
};

analyze.FILE_NAME_ID = ["pnpm-lock.yaml", "pnpm-lock.yml"];
export default analyze;
