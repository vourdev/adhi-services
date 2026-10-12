export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): Result<T>;
export function ok(): Result<undefined>;
export function ok<T>(data?: T): Result<T | undefined> {
  return { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string>
): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** True for SQLite UNIQUE violations, including when wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    const message =
      current instanceof Error ? current.message : String(current);
    if (
      message.includes("UNIQUE constraint failed") ||
      message.includes("SQLITE_CONSTRAINT_UNIQUE")
    )
      return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

export function isForeignKeyViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    const message =
      current instanceof Error ? current.message : String(current);
    if (message.includes("FOREIGN KEY constraint failed")) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
