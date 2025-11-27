import semver from "semver";
import { AnalyzeFn, Match } from "../../types";
import { log } from '../../utils/logger';

function registerInstalledVersion(installed: Map<string, string>, name: string, version: string) {
  if (!semver.valid(version)) return;
  const current = installed.get(name);
  if (!current || semver.gt(version, current)) {
    installed.set(name, version);
  }
}

export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  let lock;
  try {
    lock = JSON.parse(content);
  } catch {
    log.debug(`npm-lock analyzer: unable to parse content as JSON, skipping file.`);
    return [];
  }
  const installed = new Map<string, string>();

  function walkDeps(deps: any) {
    if (!deps || typeof deps !== "object") return;
    for (const [name, info] of Object.entries<any>(deps)) {
      if (!info || typeof info !== "object") continue;
      if (typeof info.version === "string" && semver.valid(info.version)) {
        registerInstalledVersion(installed, name, info.version);
      }
      if (info.dependencies) {
        walkDeps(info.dependencies);
      }
    }
  }

  // v1
  if (lock.dependencies) {
    walkDeps(lock.dependencies);
  }

  // v2/v3 : lock.packages
  if (lock.packages && typeof lock.packages === "object") {
    for (const [key, pkgInfo] of Object.entries<any>(lock.packages)) {
      if (!pkgInfo || typeof pkgInfo !== "object" || typeof pkgInfo.version !== "string") continue;
      if (!key) continue;
      const parts = key.split("node_modules/");
      const name = parts[parts.length - 1];
      if (!name || !semver.valid(pkgInfo.version)) continue;
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
      source,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return matches;
};

analyze.FILE_NAME_ID = ["package-lock.json", "npm-shrinkwrap.json"];
export default analyze;
