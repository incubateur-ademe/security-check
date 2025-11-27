import { AnalyzeFn, Match } from "../../types";
import { log } from '../../utils/logger';

/**
 * Analyse un deno.lock (v2+) :
 *
 * {
 *   "version": "2",
 *   "packages": {
 *     "npm": {
 *       "@scope/name@1.2.3": { ... },
 *       "lodash@4.17.21": { ... }
 *     }
 *   }
 * }
 */
export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    log.debug(`deno-lock analyzer: unable to parse content as JSON, skipping file.`);
    return [];
  }

  const npmPkgs: Record<string, any> | undefined = data?.packages?.npm;
  if (!npmPkgs || typeof npmPkgs !== "object") return [];

  const matches: Match[] = [];

  for (const key of Object.keys(npmPkgs)) {
    // Format attendu : "<name>@<version>" (y compris scoped)
    const atIndex = key.lastIndexOf("@");
    if (atIndex <= 0) continue;

    const name = key.slice(0, atIndex).trim();
    const version = key.slice(atIndex + 1).trim();
    if (!name || !version) continue;

    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;

    if (!vulnVersions.includes(version)) continue;

    matches.push({
      source,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: [version],
    });
  }

  return matches;
};

analyze.FILE_NAME_ID = ["deno.lock"];
export default analyze;
