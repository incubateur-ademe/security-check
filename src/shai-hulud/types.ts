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

export interface AnalyzeParams {
  /** Contenu brut du fichier (déjà fetché, local ou remote) */
  content: string;
  /** Label humain, utilisé dans Match.source et dans ScanResult.label */
  source: string;
  /** Liste des paquets vulnérables (CSV DataDog déjà chargé) */
  affected: VulnMap;
}

/**
 * Analyseur "pur" : ne fait AUCUN I/O, prend juste du texte + contexte
 * et retourne les matches.
 */
export type AnalyzeFn = ((params: AnalyzeParams) => Match[]) & { FILE_NAME_ID: string[] };

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
  rootOnly: boolean;
  token?: string | null;
}
