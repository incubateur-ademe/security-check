import { CliOptions } from './types';
import { version } from '../../package.json' with { type: 'json' };

let lock = false;

export const VERSION = version;

export const IOC_CSV_URL =
  "https://raw.githubusercontent.com/DataDog/indicators-of-compromise/refs/heads/main/shai-hulud-2.0/consolidated_iocs.csv";

const DEFAULT_BRANCHES = ["main", "master", "dev", "develop"];
const DEFAULT_REPO_CONCURRENCY = 10;

// === Options globales ===
let defaultConfig: CliOptions = {
  org: null,
  repos: [],
  branches: DEFAULT_BRANCHES,
  allBranches: false,
  json: false,
  verbosity: 0,
  failOnDeclaredOnly: true,
  concurrency: DEFAULT_REPO_CONCURRENCY,
};


export const setConfig = (options: Partial<CliOptions>) => {
  if (lock) throw new Error("Configuration has already been set and cannot be modified");
  lock = true;

  defaultConfig = { ...defaultConfig, ...options };
}

export const config: CliOptions = new Proxy({} as never, {
  get(_, prop: keyof CliOptions) {
    return {...defaultConfig}[prop];
  },
  set() {
    throw new Error("Configuration is read-only");
  },
});