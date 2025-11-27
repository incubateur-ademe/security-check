import { config } from '../config';

export function logger(level: 1 | 2 | 3, msg: string) {
  if (config.json) return;
  if (config.verbosity >= level) {
    console[level === 1 ? 'error' : level === 2 ? 'warn' : 'log'](msg);
  }
}
