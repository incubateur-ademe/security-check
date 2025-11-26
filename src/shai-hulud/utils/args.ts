import { config, setConfig } from '../config';
import { CliOptions } from '../types';

export /* -------------------------------------------------------------------------- */
/*  Aide / version                                                            */
/* -------------------------------------------------------------------------- */

function printHelp() {
  console.log(
    [
      "Usage: shai-hulud-checker [options]",
      "",
      "Modes :",
      "  (sans options)          Scan du projet local (Node + Deno + Bun)",
      "  --repos a/b,c/d         Scan explicite de dépôts GitHub",
      '  --org mon-orga          Scan de tous les repos publics de l’orga "mon-orga"',
      "",
      "Options générales :",
      "  --json                  Sortie JSON uniquement (pas de logs texte)",
      "  --fail-on-declared-only[=true|false]",
      "                          true (defaut): déclare vuln même si seulement déclarée",
      "                          false: ne fait échouer que si un lockfile est touché",
      "  --v | --vv | --vvv      Verbosité (1, 2 ou 3)",
      "  --concurrency=N         Nombre de requêtes GitHub parallèles (défaut: 10)",
      "  --help, -h              Affiche cette aide",
      "  --version               Affiche la version",
      "",
      "Branches :",
      '  --branches="main,dev"   Liste explicite de branches à scanner',
      "  --all-branches          Utilise l'API UI GitHub /branches/all.json pour toutes les branches",
      "",
      "Exemples :",
      "  shai-hulud-checker",
      "  shai-hulud-checker --repos incubateur-ademe/roadmaps-faciles --v",
      "  shai-hulud-checker --org incubateur-ademe --all-branches --json",
    ].join("\n"),
  );
}

/* -------------------------------------------------------------------------- */
/*  Parsing CLI                                                               */
/* -------------------------------------------------------------------------- */
export function parseArgsToConfig(args: string[]): void {
  const opts: Partial<CliOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--org" && args[i + 1]) {
      opts.org = args[++i];
    } else if (arg === "--repos" && args[i + 1]) {
        opts.repos = [];
      opts.repos.push(
        ...args[++i]
          .split(",")
          .map(s => s.trim())
          .filter(Boolean),
      );
    } else if (arg === "--json") {
      opts.json = true;
    } else if (arg === "--v" || arg === "-v") {
      opts.verbosity = Math.max(config.verbosity, 1);
    } else if (arg === "--vv" || arg === "-vv") {
      opts.verbosity = Math.max(config.verbosity, 2);
    } else if (arg === "--vvv" || arg === "-vvv") {
      opts.verbosity = Math.max(config.verbosity, 3);
    } else if (arg === "--all-branches") {
      opts.allBranches = true;
    } else if (arg.startsWith("--branches")) {
      let value: string | undefined;
      const parts = arg.split("=");
      if (parts.length === 2) {
        value = parts[1];
      } else if (args[i + 1] && !args[i + 1].startsWith("-")) {
        value = args[++i];
      }
      if (value) {
        opts.branches = value
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
      }
    } else if (arg.startsWith("--fail-on-declared-only")) {
      let value: string | undefined;
      const parts = arg.split("=");
      if (parts.length === 2) {
        value = parts[1];
      } else if (args[i + 1] && !args[i + 1].startsWith("-")) {
        value = args[++i];
      }

      if (value === undefined) {
        opts.failOnDeclaredOnly = true;
      } else {
        const normalized = value.toLowerCase();
        opts.failOnDeclaredOnly = !(normalized === "false" || normalized === "0" || normalized === "no");
      }
    } else if (arg.startsWith("--concurrency")) {
      let value: string | undefined;
      const parts = arg.split("=");
      if (parts.length === 2) {
        value = parts[1];
      } else if (args[i + 1] && !args[i + 1].startsWith("-")) {
        value = args[++i];
      }
      if (value) {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n > 0) {
          opts.concurrency = n;
        }
      }
    }
  }

  setConfig(opts);
}