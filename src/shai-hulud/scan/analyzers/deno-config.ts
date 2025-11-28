import { type AnalyzeFn, type Match } from "../../types";

/**
 * Analyse deno.json / deno.jsonc :
 * on cherche les specifiers de la forme `npm:package@version`
 * n'importe où dans le fichier.
 */
export const analyze: AnalyzeFn = ({ content, source, affected }) => {
  const matches: Match[] = [];
  const seen = new Set<string>();

  const re = /npm:([@a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+|[a-zA-Z0-9._-]+)@([0-9][0-9A-Za-z.+-]*)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const name = m[1].trim();
    const version = m[2].trim();

    const vulnVersions = affected.get(name);
    if (!vulnVersions) continue;

    // On ne matche que si la version exacte est listée comme vulnérable
    if (!vulnVersions.includes(version)) continue;

    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const match: Match = {
      source,
      packageName: name,
      declaredVersion: version, // c'est une spec déclarative
      vulnerableVersions: [version],
    };

    matches.push(match);
  }

  return matches;
};

analyze.FILE_NAME_ID = ["deno.json", "deno.jsonc"];
export default analyze;
