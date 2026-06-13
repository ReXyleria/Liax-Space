type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const sensitiveKeyPattern =
  /(password|passwd|pwd|token|secret|totp|passkey|credential|publickey|privatekey|authorization|cookie|pepper|jwt|api[-_]?key|apikey)/i;

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[REDACTED]" : redactValue(nestedValue)
      ])
    );
  }

  return value;
}

function writeLog(level: LogLevel, message: string, fields: LogFields = {}) {
  const redactedFields = redactValue(fields) as LogFields;
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...redactedFields
  };

  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => writeLog("debug", message, fields),
  info: (message: string, fields?: LogFields) => writeLog("info", message, fields),
  warn: (message: string, fields?: LogFields) => writeLog("warn", message, fields),
  error: (message: string, fields?: LogFields) => writeLog("error", message, fields)
};
