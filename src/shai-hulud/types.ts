export type VulnMap = Map<string, string[]>;

export interface Match {
  declaredVersion?: string;
  installedVersion?: string;
  packageName: string;
  source: string;
  vulnerableVersions: string[];
}

export interface ScanResult {
  analyzed: boolean;
  label: string;
  matches: Match[];
}

export interface JsonSummary {
  mode: "local" | "repos" | "org";
  org?: string | null;
  repos?: string[];
  branches?: string[];
  allBranches?: boolean;
  totalMatches: number;
  uniquePackages: number;
  matches: Match[];
  bySource: Record<
    string,
    {
      matches: number;
      packages: string[];
    }
  >;
}

export interface CliOptions {
  org: string | null;
  repos: string[];
  branches: string[];
  allBranches: boolean;
  json: boolean;
  verbosity: number;
  failOnDeclaredOnly: boolean;
  concurrency: number;
}