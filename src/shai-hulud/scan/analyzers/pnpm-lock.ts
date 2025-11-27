import { parse as parseYaml } from "yaml";
import semver from "semver";
import { AnalyzeFn, Match } from "../../types";
import { logger } from '../../utils/logger';

function registerInstalledVersion(installed: Map<string, string>, name: string, version: string) {
  if (!semver.valid(version)) return;
  const current = installed.get(name);
  if (!current || semver.gt(version, current)) {
    installed.set(name, version);
  }
}

export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  let data: any;
  try {
    data = parseYaml(content);
  } catch {
    logger(3, `pnpm-lock analyzer: unable to parse content as YAML, skipping file.`);
    return [];
  }

  const installed = new Map<string, string>();

  // pnpm v6/v7+
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
