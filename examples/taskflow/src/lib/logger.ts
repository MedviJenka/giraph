// Minimal structured logger. Real deployments would swap this for pino/winston,
// but the shape (level + message + fields) stays identical.

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface Logger {
  child(scope: string): Logger;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

function make(scope: string, threshold: Level): Logger {
  const emit = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[threshold]) return;
    const line = { ts: new Date().toISOString(), level, scope, msg, ...fields };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  };
  return {
    child: (sub) => make(`${scope}:${sub}`, threshold),
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}

export const logger: Logger = make("taskflow", "info");
