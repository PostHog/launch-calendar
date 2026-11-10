type Fields = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, message, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export const log = {
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

export function errorFields(err: unknown): Fields {
  if (err instanceof Error) return { error: err.message, stack: err.stack };
  return { error: String(err) };
}
