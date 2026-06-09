/**
 * logger.js
 *
 * Winston-based logger with custom levels for the OTAV cycle + planning layer.
 * Every module imports this singleton so all logs flow through one channel.
 *
 * Level hierarchy (lower number = higher priority):
 *   error    – unrecoverable failure
 *   warn     – recoverable problem (includes [RETRY] attempt logs)
 *   recovery – self-healing decision (scroll & re-scan, force rescan, …)
 *   plan     – Planner emitting a numbered step (always visible)
 *   observe  – something detected / read from the page
 *   think    – reasoning or decision made
 *   act      – action is being executed
 *   verify   – result of an action checked
 *   info     – general lifecycle messages
 *   debug    – verbose internal state
 */

import winston from 'winston';
import Transport from 'winston-transport';
import path from 'path';
import { ensureDir } from './fileHelper.js';
import config from '../config/env.js';

const LOGS_DIR = path.resolve('logs');
ensureDir(LOGS_DIR);

// ---------------------------------------------------------------------------
// In-memory log buffer (used by the HTML run report — see utils/report.js)
// ---------------------------------------------------------------------------

const LOG_BUFFER = [];
const LOG_BUFFER_MAX = 5000;

/** Returns a shallow copy of the captured log records for this process. */
export function getLogBuffer() {
  return LOG_BUFFER.slice();
}

/** Clears the buffer (call at the start of a run). */
export function clearLogBuffer() {
  LOG_BUFFER.length = 0;
}

/**
 * A passive Winston transport that records every log record into LOG_BUFFER.
 * No formatting/colour — stores the raw level + message so the report can parse
 * it. This is how the report captures retry/recovery/screenshot/step events
 * without any change to the executor or tools.
 */
class MemoryTransport extends Transport {
  log(info, callback) {
    LOG_BUFFER.push({ level: info.level, message: String(info.message), t: Date.now() });
    if (LOG_BUFFER.length > LOG_BUFFER_MAX) LOG_BUFFER.shift();
    callback();
  }
}

// Extend default levels with OTAV + planning levels.
// Lower numeric value = higher severity in Winston's convention.
const customLevels = {
  levels: {
    error:    0,
    warn:     1,
    recovery: 2,   // self-healing decisions — high visibility, above plan
    plan:     3,   // Planner steps — always visible, above observe/think/act
    observe:  4,
    think:    5,
    act:      6,
    verify:   7,
    info:     8,
    debug:    9,
  },
  colors: {
    error:    'red',
    warn:     'yellow',
    recovery: 'bold red',    // stands out: agent is healing from a failure
    plan:     'bold yellow', // distinct from warn; signals structured plan output
    observe:  'cyan',
    think:    'magenta',
    act:      'green',
    verify:   'blue',
    info:     'white',
    debug:    'grey',
  },
};

winston.addColors(customLevels.colors);

/** Formats a log record as a coloured, human-readable console line. */
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    const tag = level.toUpperCase().padEnd(7);
    return `[${timestamp}] [${tag}] ${message}`;
  }),
);

/** Formats a log record as clean JSON for file storage. */
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

const transports = [
  new winston.transports.Console({ format: consoleFormat }),
  // Capture everything in memory for the HTML run report (level 'debug' = all).
  new MemoryTransport({ level: 'debug' }),
];

if (config.logging.toFile) {
  transports.push(
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'agent.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 3,
    }),
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'errors.log'),
      level: 'error',
      format: fileFormat,
    }),
  );
}

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: config.logging.level,
  transports,
});

export default logger;
