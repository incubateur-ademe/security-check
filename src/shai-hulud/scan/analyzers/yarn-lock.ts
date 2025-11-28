import semver from "semver";

import { type AnalyzeFn, type Match } from "../../types";

function registerInstalledVersion(installed: Map<string, string>, name: string, version: string) {
  if (!semver.valid(version)) return;
  const current = installed.get(name);
  if (!current || semver.gt(version, current)) {
    installed.set(name, version);
  }
}

/**
 * Analyse un yarn.lock (v1/v2) et retourne les paquets installés vulnérables.
 */
export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  const lines = content.split(/\r?\n/);
  const installed = new Map<string, string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Nouveau bloc ? (ligne non indentée finissant par ":")
    if (/^[^\s].*:$/.test(line)) {
      const keyLine = line.trim().replace(/:$/, "");
      const descriptor = keyLine.replace(/^"+|"+$/g, "");
      let pkgName: string;

      if (descriptor.startsWith("@")) {
        const secondAt = descriptor.indexOf("@", 1);
        if (secondAt === -1) {
          pkgName = descriptor;
        } else {
          pkgName = descriptor.substring(0, secondAt);
        }
      } else {
        const at = descriptor.indexOf("@");
        pkgName = at === -1 ? descriptor : descriptor.substring(0, at);
      }

      let j = i + 1;
      let version: string | undefined;

      // Cherche la ligne "version"
      while (j < lines.length && /^\s/.test(lines[j])) {
        const l = lines[j].trim();
        const m = /^version\s*[: ]\s*"?([^"\s]+)"?/.exec(l);
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
      source,
      packageName: name,
      installedVersion: version,
      vulnerableVersions: matchingVuln,
    });
  }

  return matches;
};

analyze.FILE_NAME_ID = ["yarn.lock"];
export default analyze;
