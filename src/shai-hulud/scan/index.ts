import { type AnalyzeFn } from "../types";

/**
 * Identifiant logique du type de fichier analysé
 * (permet de faire un registry de scanners).
 */
export const ScannerId = [
  "bun-lock",
  "deno-config",
  "deno-lock",
  "npm-lock",
  "package-json",
  "pnpm-lock",
  "yarn-lock",
] as const;

interface ScannerModule {
  default: AnalyzeFn;
}

export type ScannerEntry = [analyzer: AnalyzeFn, fileNames: string[]];

/**
 * Charge dynamiquement tous les scanners disponibles.
 */
export const getScanners = async (): Promise<ScannerEntry[]> =>
  Promise.all(
    ScannerId.map(async id => {
      const p = ((await import(`./analyzers/${id}`)) as ScannerModule).default;

      return [p, p.FILE_NAME_ID];
    }),
  );
