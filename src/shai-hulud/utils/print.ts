import { inspect } from "util";

import { config } from "../config";
import { type JsonSummary, type Match, type ScanResult } from "../types";
import { consoleString, log } from "./logger";

/**
 * Log des vulnérabilités (si pas en mode JSON)
 */
export function printScanResult(result: ScanResult) {
  if (config.json) return;
  const { label, matches, analyzed } = result;
  if (!analyzed || !matches.length) return;

  log.info(`\n${label}: ⚠️ ${matches.length} paquet(s) affecté(s) / potentiellement affecté(s)`);
  for (const m of matches) {
    const vulnVers = m.vulnerableVersions.join(", ");
    if (m.installedVersion) {
      log.info(`  - [${m.source}] ${m.packageName}@${m.installedVersion} (versions vuln.: ${vulnVers})`);
    } else {
      log.info(
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
    const entry = bySource.get(m.source) ?? {
      matches: 0,
      packages: new Set<string>(),
    };
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

function printForMachine(base: JsonSummary) {
  const output = [] as string[];
  output.push("--- Machine readable ---");
  output.push("-- Infos");
  output.push(`mode=${base.mode}`);
  output.push(`total_matches=${base.totalMatches}`);
  output.push(`unique_packages=${base.uniquePackages}`);

  if (base.orgs && base.orgs.length > 0) {
    output.push(`orgs=${base.orgs.join(",")}`);
  }

  if (base.repos && base.repos.length > 0) {
    output.push(`repos=${base.repos.join(",")}`);
  }

  if (!base.allBranches && base.branches && base.branches.length > 0) {
    output.push(`branches=${base.branches.join(",")}`);
  } else if (base.allBranches) {
    output.push(`all_branches=true`);
  }
  output.push("-- Scan Results");
  for (const [source, info] of Object.entries(base.bySource)) {
    output.push(
      `source="${source}" matches=${info.matches} unique_packages=${info.packages.length} packages=${info.packages.join(",")}`,
    );
  }

  output.push("-----------------------");

  log.info(output.join("\n"));
}

function printForHuman(base: JsonSummary, allMatches: Match[]) {
  const output = [] as string[];
  output.push("--- Human readable ---");
  output.push("-- Infos");
  const { bySource, matches: _, ...rest } = base;
  output.push(inspect(rest, { depth: null, colors: true }));

  output.push("----- Details des paquets vulnérables -----");
  output.push(
    consoleString.table(
      Object.entries(bySource)
        .map(([source, info]) => {
          const matchesForSource = allMatches.filter(m => m.source === source);
          // include vulnVers, installed, declared like below
          return matchesForSource.map(m => ({
            source,
            info: `${info.matches} match(es), ${info.packages.length} paquet(s) unique(s)`,
            packageName: m.packageName,
            installedVersion: m.installedVersion ?? "n/a",
            declaredVersion: m.declaredVersion ?? "n/a",
            vulnerableVersions: m.vulnerableVersions.join(", "),
          }));
        })
        .flat(),
    ),
  );

  log.info(output.join("\n"));
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

  // Bloc 1 : TL;DR "grep-able" (WARN)
  log.info("============================");
  printForMachine(base);

  // Bloc 2 : vue plus humaine (INFO)
  printForHuman(base, allMatches);

  log.info("============================");
}
