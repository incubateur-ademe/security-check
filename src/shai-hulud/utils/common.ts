import semver from "semver";

import { config } from "../config";
import { type Match, type ScanResult } from "../types";

export function registerInstalledVersion(installed: Map<string, string>, name: string, version: string) {
  if (!semver.valid(version)) return;

  const current = installed.get(name);
  if (!current || semver.gt(version, current)) {
    installed.set(name, version);
  }
}

export function createScanResult(label: string, matches: Match[], analyzed: boolean): ScanResult {
  return { label, matches, analyzed };
}

export function parseJsonLoose<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as unknown as T;
  } catch {
    const cleaned = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned) as unknown as T;
  }
}

export function computeExitCode(allMatches: Match[]): number {
  const relevant = config.failOnDeclaredOnly ? allMatches : allMatches.filter(m => m.installedVersion);
  return relevant.length === 0 ? 0 : 1;
}
