#!/usr/bin/env tsx

/**
 * Shai-Hulud 2.0 IOC checker (DataDog)
 *
 * Source IOC:
 *   https://raw.githubusercontent.com/DataDog/indicators-of-compromise/refs/heads/main/shai-hulud-2.0/consolidated_iocs.csv
 *
 * Modes :
 *   - Sans arguments -> scan du projet local (cwd)
 *   - --repos org1/repo1,org2/repo2 -> scan de ces dépôts GitHub
 *   - --orgs mon-orga,autre-orga -> scan de tous les repos publics des orgs
 *
 * Fichiers supportés (local & remote) :
 *   - Node :
 *     - package.json
 *     - package-lock.json / npm-shrinkwrap.json
 *     - yarn.lock
 *     - pnpm-lock.yaml
 *   - Deno :
 *     - deno.json / deno.jsonc (imports "npm:")
 *     - deno.lock (section "npm")
 *   - Bun :
 *     - bun.lock (texte JSONC-like)
 *
 * CLI :
 *   --orgs <name1,name2>
 *   --repos owner1/repo1,owner2/repo2
 *   --json
 *   --fail-on-declared-only[=true|false]
 *   --v | --vv | --vvv
 *   --help | -h
 *   --version
 *   --concurrency=N   (nombre de requêtes GitHub parallèles, défaut: 10)
 *   --branches="main,master"
 *   --all-branches   (utilise https://github.com/<org>/<repo>/branches/all.json?page=N)
 *
 * Exit codes :
 *   - 0 : aucun IOC trouvé (pertinent selon fail-on-declared-only)
 *   - 1 : IOC trouvé
 *   - 2 : erreur de runtime (réseau, parse, etc.)
 */

import { parseArgsToConfig } from "./utils/args";
import { runScan } from "./main"; // ou ton équivalent
import { log } from "./utils/logger";

async function main() {
  // Laisse yargs gérer --help / --version + les exit
  parseArgsToConfig(process.argv.slice(2));

  // Si l'utilisateur a passé --help ou --version,
  // yargs a déjà affiché et fait process.exit(0) -> le code ci-dessous ne s’exécutera pas.
  await runScan();
}

try {
  await main()
} catch (err) {
  log.error("Erreur pendant le scan", { error: (err as Error).message ?? String(err) });
  process.exitCode = 2;
}
