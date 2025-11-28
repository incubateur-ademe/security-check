import { type AnalyzeFn, type Match } from "../../types";
import { parseJsonLoose } from "../../utils/common";
import { log } from "../../utils/logger";

/**
 * Analyse bun.lock (best-effort) :
 * 1) Si c'est du JSON avec un objet "packages" et des clés "name@version", on les lit.
 * 2) En complément, on scanne le contenu brut pour des `npm:pkg@version`.
 *
 * NB: ce parser est volontairement conservateur : il ne matche que
 * des versions exactes qui sont listées dans `affected`.
 */
export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  const matches: Match[] = [];
  const seen = new Set<string>();

  // 1) Essai parse JSON et lecture de packages
  try {
    const data = parseJsonLoose<Record<string, unknown>>(content);
    const pkgs = data && typeof data === "object" ? data.packages : undefined;
    if (pkgs && typeof pkgs === "object") {
      for (const key of Object.keys(pkgs)) {
        const atIndex = key.lastIndexOf("@");
        if (atIndex <= 0) continue;

        const name = key.slice(0, atIndex).trim();
        const version = key.slice(atIndex + 1).trim();
        if (!name || !version) continue;

        const vulnVersions = affected.get(name);
        if (!vulnVersions) continue;
        if (!vulnVersions.includes(version)) continue;

        const id = `${name}@${version}`;
        if (seen.has(id)) continue;
        seen.add(id);

        matches.push({
          source,
          packageName: name,
          installedVersion: version,
          vulnerableVersions: [version],
        });
      }
    }
  } catch {
    log.debug(`bun-lock analyzer: unable to parse content as JSON, skipping JSON parsing step.`);
  }

  // 2) Complément : specifiers npm:pkg@version dans le contenu brut
  const re = /npm:([@a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+|[a-zA-Z0-9._-]+)@([0-9][0-9A-Za-z.+-]*)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const name = m[1].trim();
    const version = m[2].trim();

    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;
    if (!vulnVersions.includes(version)) continue;

    const id = `${name}@${version}`;
    if (seen.has(id)) continue;
    seen.add(id);

    matches.push({
      source,
      packageName: name,
      declaredVersion: version,
      vulnerableVersions: [version],
    });
  }

  return matches;
};

analyze.FILE_NAME_ID = ["bun.lock"];
export default analyze;
