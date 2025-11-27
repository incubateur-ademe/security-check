import semver from "semver";
import { AnalyzeFn, Match } from "../../types";
import { log } from '../../utils/logger';

export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  let pkg: any;
  try {
    pkg = JSON.parse(content);
  } catch {
    log.debug(`package-json analyzer: unable to parse content as JSON, skipping file.`);
    return [];
  }

  if (!pkg || typeof pkg !== "object") {
    log.debug(`package-json analyzer: parsed content is not an object, skipping file.`);
    return [];
  }
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

      const matchingVuln = vulnVersions.filter(v => {
        if (!semver.valid(v)) return false;
        return semver.satisfies(v, validRange, { includePrerelease: true });
      });

      if (matchingVuln.length > 0) {
        matches.push({
          source: `${source} (${section})`,
          packageName: name,
          declaredVersion: rangeSpec,
          vulnerableVersions: matchingVuln,
        });
      }
    }
  }

  return matches;
};

analyze.FILE_NAME_ID = ["package.json"];
export default analyze;
