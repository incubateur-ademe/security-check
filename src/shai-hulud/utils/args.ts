import { config, setConfig, VERSION } from "../config";
import { CliOptions } from "../types";
import yargs, { Argv } from "yargs";

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
      // On ne veut pas être ultra strict pour ne pas casser sur des flags inconnus.
      .strict(false)
      .parserConfiguration({
        "short-option-groups": false,
        "camel-case-expansion": false,
        "strip-aliased": true,
        "strip-dashed": true,
      })
      .option("org", {
        type: "string",
        describe: "Organisation GitHub à scanner",
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
  );
}

/* -------------------------------------------------------------------------- */
/*  Aide “manuelle” (au cas où tu veux l’appeler dans un test, etc.)         */
/* -------------------------------------------------------------------------- */

export function printHelp() {
  buildYargs([]).showHelp();
}

/* -------------------------------------------------------------------------- */
/*  Parsing CLI : remplit config à partir des args                            */
/* -------------------------------------------------------------------------- */

export function parseArgsToConfig(args: string[]): void {
  const parser = buildYargs(args);

  const argv = parser.parseSync() as {
    org?: string;
    repos?: string;
    json?: boolean;
    v?: boolean;
    vv?: boolean;
    vvv?: boolean;
    ["all-branches"]?: boolean;
    branches?: string;
    ["fail-on-declared-only"]?: string | boolean;
    concurrency?: number;
  };

  const opts: Partial<CliOptions> = {};

  // --org
  if (typeof argv.org === "string") {
    opts.org = argv.org;
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

  setConfig(opts);
}
