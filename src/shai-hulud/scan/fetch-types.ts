import { type AnalyzeFn } from "../types";
import { type ScannerEntry } from "./index";

/**
 * Un fichier prêt à être analysé.
 * - `analyzer`: fonction pure qui fait l'analyse
 * - `source`: label humain (servira pour Match.source + ScanResult.label)
 * - `filename`: chemin du fichier (relatif au repo ou au cwd)
 * - `content`: contenu brut
 */
export interface FileToAnalyze {
  analyzer: AnalyzeFn;
  filename: string;
  source: string;
  content: string;
}

/**
 * Contexte générique pour un fetcher.
 * On le typpe un minimum pour que tu puisses brancher dans main.
 */
export type FetchContext =
  | { mode: "local" }
  | { mode: "remote-root"; owner: string; repo: string; branch: string }
  | { mode: "remote-tree"; owner: string; repo: string; branch: string };

/**
 * Type commun à tous les fetchers :
 * - prend un contexte (local, remote root-only, remote monorepo)
 * - et la liste des scanners (analyzer + FILE_NAME_ID)
 * - renvoie une liste de fichiers à analyser
 */
export type FetcherFn = (ctx: FetchContext, scanners: ScannerEntry[]) => Promise<FileToAnalyze[]>;
