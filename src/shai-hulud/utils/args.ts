import yargs, { type Argv } from "yargs";

import { config, setConfig, VERSION } from "../config";
import { type CliOptions } from "../types";
import { log } from "./logger";

/* -------------------------------------------------------------------------- */
/*  Construction du parser yargs                                              */
/* -------------------------------------------------------------------------- */

function buildYargs(args: string[]): Argv {
  return (
    yargs(args)
      // On laisse yargs gérer help / version et les exit codes.
      .usage("Usage: shai-hulud-checker [options]")
      .help("help")
      .alias("help", "h")
      // Version : utilise la version depuis le config (proxy vers package.json)
      // On l’expose en --version et -V (on évite -v qui est déjà utilisé).
      .version("version", "Afficher la version", VERSION)
      .alias("version", "V")
      .strict(true)
      .parserConfiguration({
        "short-option-groups": false,
        "camel-case-expansion": false,
        "strip-aliased": true,
        "strip-dashed": true,
      })
      .option("orgs", {
        type: "string",
        describe: "Organisation(s) GitHub à scanner (séparées par des virgules)",
      })
      .option("repos", {
        type: "string",
        describe: "Liste de repos owner/repo séparés par des virgules",
      })
      .option("json", {
        type: "boolean",
        describe: "Sortie JSON uniquement (pas de logs texte)",
      })
      // On garde v / vv / vvv comme dans ta logique actuelle
      .option("v", {
        type: "boolean",
        describe: "Verbosity 1",
      })
      .option("vv", {
        type: "boolean",
        describe: "Verbosity 2",
      })
      .option("vvv", {
        type: "boolean",
        describe: "Verbosity 3",
      })
      .option("all-branches", {
        type: "boolean",
        describe: "Utiliser toutes les branches via l’UI GitHub (/branches/all.json)",
      })
      .option("branches", {
        type: "string",
        describe: 'Liste de branches à scanner, séparées par des virgules (ex: "main,dev")',
      })
      .option("fail-on-declared-only", {
        describe:
          "Contrôle si une vuln déclarée (sans lockfile) fait échouer le scan (true par défaut). Peut prendre true/false.",
      })
      .option("concurrency", {
        type: "number",
        describe: "Nombre de dépôts scannés en parallèle (défaut: 10)",
      })
      .option("root-only", {
        type: "boolean",
        default: true,
        describe:
          "Ne scanner que les lockfiles à la racine du repo. Utiliser --no-root-only pour scanner tout le repo (monorepos).",
      })
      .option("token", {
        type: "string",
        describe: "GitHub token utilisé pour les appels API (requis si --no-root-only)",
      })
  );
}

/* -------------------------------------------------------------------------- */
/*  Parsing CLI : remplit config à partir des args                            */
/* -------------------------------------------------------------------------- */

export function parseArgsToConfig(args: string[]): void {
  const parser = buildYargs(args);

  const argv = parser.parseSync() as {
    orgs?: string[] | string;
    repos?: string;
    json?: boolean;
    v?: boolean;
    vv?: boolean;
    vvv?: boolean;
    ["all-branches"]?: boolean;
    branches?: string;
    ["fail-on-declared-only"]?: boolean | string;
    concurrency?: number;
    ["root-only"]?: boolean;
    token?: string;
  };

  const opts: Partial<CliOptions> = {};

  // --orgs : accept either CSV string or repeated flag => normalize to string[]
  if (typeof argv.orgs === "string" || Array.isArray(argv.orgs)) {
    const raw = Array.isArray(argv.orgs) ? argv.orgs.join(",") : argv.orgs;
    const list = raw
      .split(",")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.toLowerCase());
    // dedupe while preserving iteration order
    opts.orgs = Array.from(new Set(list));
  }

  // --repos a/b,c/d
  if (typeof argv.repos === "string") {
    opts.repos = argv.repos
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }

  // --json
  if (typeof argv.json === "boolean") {
    opts.json = argv.json;
  }

  // --v / --vv / --vvv -> on part de la valeur par défaut dans config
  let verbosity = config.verbosity;
  if (argv.v) {
    verbosity = Math.max(verbosity, 1);
  }
  if (argv.vv) {
    verbosity = Math.max(verbosity, 2);
  }
  if (argv.vvv) {
    verbosity = Math.max(verbosity, 3);
  }
  if (verbosity !== config.verbosity) {
    opts.verbosity = verbosity;
  }

  // --all-branches
  if (typeof argv["all-branches"] === "boolean") {
    opts.allBranches = argv["all-branches"];
  }

  // --branches="main,dev"
  if (typeof argv.branches === "string") {
    opts.branches = argv.branches
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
  }

  // --fail-on-declared-only[=true|false]
  if (typeof argv["fail-on-declared-only"] !== "undefined") {
    const raw = argv["fail-on-declared-only"];
    if (typeof raw === "boolean") {
      opts.failOnDeclaredOnly = raw;
    } else if (typeof raw === "string") {
      const normalized = raw.toLowerCase();
      opts.failOnDeclaredOnly = !(normalized === "false" || normalized === "0" || normalized === "no");
    }
  }

  // --concurrency=N
  if (typeof argv.concurrency === "number" && !Number.isNaN(argv.concurrency) && argv.concurrency > 0) {
    opts.concurrency = argv.concurrency;
  }

  // --root-only / --no-root-only
  // yargs gère automatiquement --no-root-only -> root-only = false
  if (typeof argv["root-only"] === "boolean") {
    opts.rootOnly = argv["root-only"];
  } else {
    // fallback sur la valeur par défaut de la config
    opts.rootOnly = config.rootOnly;
  }

  // --token (ou GITHUB_TOKEN)
  const tokenFromArg = typeof argv.token === "string" ? argv.token.trim() : "";
  const tokenFromEnv = typeof process.env.GITHUB_TOKEN === "string" ? process.env.GITHUB_TOKEN.trim() : "";
  const effectiveToken = tokenFromArg || tokenFromEnv || "";

  if (effectiveToken) {
    opts.token = effectiveToken;
  }

  // Règle métier : --no-root-only nécessite un token
  if (!opts.rootOnly && !effectiveToken) {
    log.error("Erreur: --no-root-only nécessite un token GitHub (utilise --token ou GITHUB_TOKEN).");
    process.exit(1);
  }

  setConfig(opts);
}
