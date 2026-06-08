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
import path from 'path';
import { ensureDir } from './fileHelper.js';
import config from '../config/env.js';

const LOGS_DIR = path.resolve('logs');
ensureDir(LOGS_DIR);

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
