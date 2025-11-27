import { config } from '../config';
import { ScanResult, Match, JsonSummary } from '../types';

/**
 * Log des vulnérabilités (si pas en mode JSON)
 */
export function printScanResult(result: ScanResult) {
  if (config.json) return;
  const { label, matches, analyzed } = result;
  if (!analyzed || !matches.length) return;

  console.log(`\n${label}: ⚠️ ${matches.length} paquet(s) affecté(s) / potentiellement affecté(s)`);
  for (const m of matches) {
    const vulnVers = m.vulnerableVersions.join(", ");
    if (m.installedVersion) {
      console.log(`  - [${m.source}] ${m.packageName}@${m.installedVersion} (versions vuln.: ${vulnVers})`);
    } else {
      console.log(
        `  - [${m.source}] ${m.packageName} (déclaré: ${m.declaredVersion ?? "?"}) (versions vuln.: ${vulnVers})`,
      );
    }
  }
}

export function summarizeMatches(allMatches: Match[]): JsonSummary {
  const totalMatches = allMatches.length;
  const uniquePackages = new Set(allMatches.map(m => m.packageName)).size;
  const bySource = new Map<
    string,
    {
      matches: number;
      packages: Set<string>;
    }
  >();

  for (const m of allMatches) {
    const entry = bySource.get(m.source) ?? { matches: 0, packages: new Set<string>() };
    entry.matches++;
    entry.packages.add(m.packageName);
    bySource.set(m.source, entry);
  }

  const bySourceSerialized: JsonSummary["bySource"] = {};
  for (const [source, info] of bySource.entries()) {
    bySourceSerialized[source] = {
      matches: info.matches,
      packages: Array.from(info.packages),
    };
  }

  return {
    mode: "local", // sera écrasé par le caller
    totalMatches,
    uniquePackages,
    matches: allMatches,
    bySource: bySourceSerialized,
  };
}

export function printGlobalSummary(mode: JsonSummary["mode"], ctx: Partial<JsonSummary>, allMatches: Match[]) {
  const base = summarizeMatches(allMatches);
  base.mode = mode;
  base.orgs = ctx.orgs ?? [];
  base.repos = ctx.repos;
  base.branches = ctx.branches;
  base.allBranches = ctx.allBranches;

  if (config.json) {
    console.log(JSON.stringify(base, null, 2));
    return;
  }

  console.log("\n============================");
  console.log(`[SUMMARY] mode=${base.mode} total_matches=${base.totalMatches} unique_packages=${base.uniquePackages}`);
  if (base.orgs && base.orgs.length > 0) console.log(`[SUMMARY] orgs=${base.orgs.join(",")}`);
  if (base.repos) console.log(`[SUMMARY] repos=${base.repos.join(",")}`);
  if (base.branches) {
    console.log(
      `[SUMMARY] branches=${base.branches.join(",")} allBranches=${base.allBranches ? "true" : "false"}`,
    );
  }

  for (const [source, info] of Object.entries(base.bySource)) {
    console.log(
      `[SUMMARY] source="${source}" matches=${info.matches} unique_packages=${info.packages.length} packages=${info.packages.join(
        ",",
      )}`,
    );
  }
  console.log("============================\n");
}
