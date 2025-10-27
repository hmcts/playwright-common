import winston, { format as winstonFormat, transports as winstonTransports } from "winston";
import type { Logger } from "winston";
import {
  buildRedactionState,
  REDACTED_VALUE,
  RedactPattern,
  RedactionState,
  SPLAT_SYMBOL,
  sanitizeValue,
} from "./redaction.js";

export type LogFormat = "json" | "pretty";

export interface LoggerOptions {
  serviceName?: string;
  level?: string;
  format?: LogFormat;
  enableRedaction?: boolean;
  redactKeys?: RedactPattern[];
  transports?: winston.transport[];
  defaultMeta?: Record<string, unknown>;
}

function resolveLogLevel(options?: LoggerOptions): string {
  return (
    options?.level ??
    process.env.LOG_LEVEL ??
    "info"
  );
}

function resolveLogFormat(options?: LoggerOptions): LogFormat {
  const value = options?.format ?? process.env.LOG_FORMAT ?? "json";
  return value === "pretty" ? "pretty" : "json";
}

function resolveRedactionState(options?: LoggerOptions): RedactionState {
  const envToggle =
    process.env.LOG_REDACTION === undefined
      ? undefined
      : process.env.LOG_REDACTION.toLowerCase() !== "off";
  return buildRedactionState({
    enabled: options?.enableRedaction ?? envToggle ?? true,
    patterns: options?.redactKeys,
  });
}

function applyRedactionFormat(state: RedactionState) {
  return winstonFormat((info) => {
    if (!state.enabled) {
      return info;
    }

    for (const key of Object.keys(info)) {
      if (key === "level") continue;
      info[key] = sanitizeValue(info[key], state, key);
    }

    const splatValue = info[SPLAT_SYMBOL];
    if (splatValue !== undefined) {
      info[SPLAT_SYMBOL] = sanitizeValue(splatValue, state);
    }

    return info;
  })();
}

function buildFormat(mode: LogFormat, state: RedactionState) {
  const baseFormats = [
    applyRedactionFormat(state),
    winstonFormat.timestamp(),
    winstonFormat((info) => {
      if (!info.service && info.serviceName) {
        info.service = info.serviceName;
      }
      return info;
    })(),
  ];

  if (mode === "pretty") {
    baseFormats.push(
      winstonFormat.colorize({ all: true }),
      winstonFormat.printf((info) => {
        const { timestamp, level, message, ...rest } = info;
        const meta = Object.keys(rest).length
          ? ` ${JSON.stringify(rest, null, 2)}`
          : "";
        return `${timestamp} [${level}]: ${message}${meta}`;
      })
    );
  } else {
    baseFormats.push(winstonFormat.json());
  }

  return winstonFormat.combine(...baseFormats);
}

export function createLogger(options?: LoggerOptions): Logger {
  const level = resolveLogLevel(options);
  const redactionState = resolveRedactionState(options);
  const format = buildFormat(resolveLogFormat(options), redactionState);
  const serviceName =
    options?.serviceName ?? process.env.LOG_SERVICE_NAME ?? "playwright-common";

  const transports =
    options?.transports && options.transports.length > 0
      ? options.transports
      : [
          new winstonTransports.Console({
            stderrLevels: ["error", "warn"],
          }),
        ];

  const logger = winston.createLogger({
    level,
    format,
    defaultMeta: {
      service: serviceName,
      ...options?.defaultMeta,
    },
    transports,
  });

  if (process.env.NODE_ENV === "test") {
    logger.exitOnError = false;
  }

  return logger;
}

export function createChildLogger(
  logger: Logger,
  meta: Record<string, unknown>
): Logger {
  return logger.child(meta);
}

export { REDACTED_VALUE };
export type { RedactPattern, RedactionState } from "./redaction.js";
