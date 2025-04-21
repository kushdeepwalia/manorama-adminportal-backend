const dayjs = require("dayjs");
const { createLogger, format, transports } = require("winston");
// const { db } = require("../../api/user/userModel");
const { combine, timestamp, printf, colorize } = format;

const timestampFormat = () => dayjs().format("DD/MM/YYYY hh:mm:ss A");

const customFormat = format.printf(({ level, message, timestamp }) => {
  return `[${dayjs(timestamp).format("DD/MM/YYYY hh:mm:ss a")}] ${level.toUpperCase()}: ${message}`;
});

const prettyFormat = format.combine(
  format((info) => {
    info.timestamp = timestampFormat();
    return info;
  })(),
  printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

const ANSI_COLORS = {
  error: '\x1b[91m',   // red
  http: '\x1b[93m',    // yellow
  info: '\x1b[94m',    // blue
  debug: '\x1b[95m',   // magenta
};
const RESET = '\x1b[0m';

const levelToUpper = format((info) => {
  if (info.level) {
    info.level = String(info.level).toUpperCase();
  }
  return info;
});

const consoleFormat = format.combine(
  levelToUpper(),
  format((info) => {
    const color = ANSI_COLORS[info.level.toLowerCase()] || '';
    info.timestamp = `${color}[${timestampFormat()}]${RESET}`;
    info.level = `${color}${info.level}${RESET}`;
    info.message = `${color}${info.message}${RESET}`;
    return info;
  })(),
  printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

const levelFilter = (targetLevel) =>
  format((info) => {
    return info.level === targetLevel ? info : false;
  })();

// Logger cache
const loggerCache = {};


const createCustomLogger = (level, filename, service) =>
  createLogger({
    level,
    format: combine(
      timestamp(),
      customFormat
    ),
    transports: [
      new transports.Console({
        level,
        format: combine(levelFilter(level), levelToUpper(), consoleFormat)
      }),
      new transports.File({
        filename: `./src/log/${service}-${filename}.log`,
        level,
        format: combine(levelFilter(level), levelToUpper(), timestamp(), prettyFormat)
      }),
      new transports.File({
        filename: `./src/log/all-logs.log`,
        level,
        format: combine(levelFilter(level), levelToUpper(), timestamp(), prettyFormat)
      })
    ]
  });

// Shared logger interface
const logger = {
  error: (msg, service = "default") => {
    const key = `${service}-error`;
    if (!loggerCache[key]) {
      loggerCache[key] = createCustomLogger("error", service);
    }
    loggerCache[key].error(msg);
  },
  info: (msg, service = "default") => {
    const key = `${service}-info`;
    if (!loggerCache[key]) {
      loggerCache[key] = createCustomLogger("info", service);
    }
    loggerCache[key].info(msg);
  },
  db: (msg, service = "default") => {
    const key = `${service}-debug`;
    if (!loggerCache[key]) {
      loggerCache[key] = createCustomLogger("debug", service);
    }
    loggerCache[key].debug(msg);
  },
  api: (msg, service = "default") => {
    const key = `${service}-http`;
    if (!loggerCache[key]) {
      loggerCache[key] = createCustomLogger("http", service);
    }
    loggerCache[key].http(msg);
  },
};

module.exports = logger;
