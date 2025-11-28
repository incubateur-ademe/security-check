import { config } from "../config";

declare global {
  var __SHAI_HULUD_RUN_ID: string;
}

const RUN_ID = (global.__SHAI_HULUD_RUN_ID ??= crypto.randomUUID());

type LevelName = "debug" | "error" | "info" | "warn";

function shouldLog(level: LevelName) {
  const v = config.verbosity ?? 0;
  if (level === "debug") return v >= 3;
  if (level === "info") return v >= 2;
  if (level === "warn") return v >= 1;
  return true; // error always
}

type LogMeta = Record<string, unknown>;

function writeLog(level: LevelName, msg: string, meta?: LogMeta) {
  const out = {
    ts: new Date().toISOString(),
    run: RUN_ID,
    level,
    msg,
    ...meta,
  } satisfies Record<string, unknown>;

  // Always write structured logs to stderr so stdout stays available for machine output (JSON)
  if (config.json) {
    // still write logs as JSON on stderr for machine consumption
    console.error(JSON.stringify(out));
    return;
  }

  // Human-friendly fallback
  const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  console.error(`[${out.ts}] ${level.toUpperCase()}: ${msg}${metaStr}`);
}

export function logger(level: LevelName, msg?: string, meta?: LogMeta) {
  const name = level;
  if (!msg) return;
  if (!shouldLog(name)) return;
  writeLog(name, msg, meta);
  return;
}

export const log = {
  error: (msg: string, meta?: LogMeta) => {
    logger("error", msg, meta);
  },
  warn: (msg: string, meta?: LogMeta) => {
    logger("warn", msg, meta);
  },
  info: (msg: string, meta?: LogMeta) => {
    logger("info", msg, meta);
  },
  debug: (msg: string, meta?: LogMeta) => {
    logger("debug", msg, meta);
  },
};
