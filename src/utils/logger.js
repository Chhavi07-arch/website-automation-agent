/**
 * logger.js
 *
 * Winston-based logger with four custom OTAV levels layered on top of the
 * standard Winston levels.  Every module in the project imports this singleton
 * so all logs flow through one consistent channel.
 *
 * Custom levels (highest → lowest priority inside OTAV):
 *   observe  – something was detected / read from the page
 *   think    – a decision was made or reasoning was performed
 *   act      – an action is being executed
 *   verify   – the result of an action was checked
 *
 * Standard Winston levels (error, warn, info, …) remain available.
 */

import winston from 'winston';
import path from 'path';
import { ensureDir } from './fileHelper.js';
import config from '../config/env.js';

const LOGS_DIR = path.resolve('logs');
ensureDir(LOGS_DIR);

// Extend default levels with OTAV cycle levels.
// Lower numeric value = higher severity in Winston's convention.
const customLevels = {
  levels: {
    error:   0,
    warn:    1,
    observe: 2,
    think:   3,
    act:     4,
    verify:  5,
    info:    6,
    debug:   7,
  },
  colors: {
    error:   'red',
    warn:    'yellow',
    observe: 'cyan',
    think:   'magenta',
    act:     'green',
    verify:  'blue',
    info:    'white',
    debug:   'grey',
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
