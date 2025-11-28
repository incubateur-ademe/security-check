import semver from "semver";

import { type AnalyzeFn, type Match } from "../../types";
import { parseJsonLoose } from "../../utils/common";
import { log } from "../../utils/logger";

function registerInstalledVersion(installed: Map<string, string>, name: string, version: string) {
  if (!semver.valid(version)) return;
  const current = installed.get(name);
  if (!current || semver.gt(version, current)) {
    installed.set(name, version);
  }
}

export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  let lock: unknown;
  try {
    lock = parseJsonLoose<Record<string, unknown>>(content);
  } catch {
    log.debug(`npm-lock analyzer: unable to parse content as JSON, skipping file.`);
    return [];
  }
  const installed = new Map<string, string>();
  function walkDeps(deps: unknown) {
    if (!deps || typeof deps !== "object") return;
    for (const [name, info] of Object.entries(deps as Record<string, unknown>)) {
      if (!info || typeof info !== "object") continue;
      const infoObj = info as Record<string, unknown>;
      if (typeof infoObj.version === "string" && semver.valid(infoObj.version)) {
        registerInstalledVersion(installed, name, infoObj.version);
      }
      if (infoObj.dependencies) {
        walkDeps(infoObj.dependencies);
      }
    }
  }

  // v1
  if (lock && typeof lock === "object" && (lock as Record<string, unknown>).dependencies) {
    walkDeps((lock as Record<string, unknown>).dependencies);
  }
  // v2/v3 : lock.packages
  const packagesObj = lock && typeof lock === "object" ? (lock as Record<string, unknown>).packages : undefined;
  if (packagesObj && typeof packagesObj === "object") {
    for (const [key, pkgInfo] of Object.entries(packagesObj as Record<string, unknown>)) {
      if (!pkgInfo || typeof pkgInfo !== "object") continue;
      const pkgInfoObj = pkgInfo as Record<string, unknown>;
      if (typeof pkgInfoObj.version !== "string") continue;
      if (!key) continue;
      const parts = key.split("node_modules/");
      const name = parts[parts.length - 1];
      if (!name || !semver.valid(pkgInfoObj.version)) continue;
      registerInstalledVersion(installed, name, pkgInfoObj.version);
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
