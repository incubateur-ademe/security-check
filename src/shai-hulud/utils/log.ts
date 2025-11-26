import { config } from '../config';

export function log(level: 1 | 2 | 3, msg: string) {
  if (config.json) return;
  if (config.verbosity >= level) {
    console.log(msg);
  }
}