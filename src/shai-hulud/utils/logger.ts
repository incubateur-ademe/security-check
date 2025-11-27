import { config } from '../config';

const RUN_ID = (globalThis as any).__SHAI_HULUD_RUN_ID ??= (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type LevelName = 'error' | 'warn' | 'info' | 'debug';

function numericLevelToName(l: number): LevelName {
  if (l <= 1) return 'error';
  if (l === 2) return 'warn';
  return 'debug';
}

function shouldLog(level: LevelName) {
  const v = config.verbosity ?? 0;
  if (level === 'debug') return v >= 3;
  if (level === 'info') return v >= 2;
  if (level === 'warn') return v >= 1;
  return true; // error always
}

function writeLog(level: LevelName, msg: string, meta?: Record<string, any>) {
  const out = {
    ts: new Date().toISOString(),
    run: RUN_ID,
    level,
    msg,
    ...meta,
  } as Record<string, any>;

  // Always write structured logs to stderr so stdout stays available for machine output (JSON)
  if (config.json) {
    // still write logs as JSON on stderr for machine consumption
    console.error(JSON.stringify(out));
    return;
  }

  // Human-friendly fallback
  const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  console.error(`[${out.ts}] ${level.toUpperCase()}: ${msg}${metaStr}`);
}

// Backward-compatible logger function (keeps existing callsites logger(level:number, msg:string))
export function logger(level: 1 | 2 | 3 | LevelName, msg?: string, meta?: Record<string, any>) {
  if (typeof level === 'string') {
    const name = level as LevelName;
    if (!msg) return;
    if (!shouldLog(name)) return;
    writeLog(name, msg, meta);
    return;
  }

  // numeric form
  if (!msg) return;
  const name = numericLevelToName(level);
  if (!shouldLog(name)) return;
  writeLog(name, msg, meta);
}

export const log = {
  error: (msg: string, meta?: Record<string, any>) => logger('error', msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => logger('warn', msg, meta),
  info: (msg: string, meta?: Record<string, any>) => logger('info', msg, meta),
  debug: (msg: string, meta?: Record<string, any>) => logger('debug', msg, meta),
};
