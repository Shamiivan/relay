type LogLevel = "debug" | "info" | "warn" | "error";

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type LogFields = Record<string, unknown>;

export type Logger = {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
};

function normalizeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  return {
    errorValue: String(error),
  };
}

function write(level: LogLevel, context: LogFields, message: string, fields?: LogFields): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...(fields ?? {}),
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

export function createLogger(config: {
  level?: string;
  service: string;
  fields?: LogFields;
}): Logger {
  const configuredLevel = (config.level?.toLowerCase() ?? "info") as LogLevel;
  const threshold = levelRank[configuredLevel] ?? levelRank.info;
  const baseContext: LogFields = {
    service: config.service,
    ...(config.fields ?? {}),
  };

  function log(level: LogLevel, message: string, fields?: LogFields): void {
    if (levelRank[level] < threshold) {
      return;
    }

    const normalizedFields = fields?.error
      ? {
          ...fields,
          ...normalizeError(fields.error),
          error: undefined,
        }
      : fields;

    write(level, baseContext, message, normalizedFields);
  }

  return {
    debug(message, fields) {
      log("debug", message, fields);
    },
    info(message, fields) {
      log("info", message, fields);
    },
    warn(message, fields) {
      log("warn", message, fields);
    },
    error(message, fields) {
      log("error", message, fields);
    },
    child(fields) {
      return createLogger({
        level: configuredLevel,
        service: config.service,
        fields: {
          ...baseContext,
          ...fields,
        },
      });
    },
  };
}
