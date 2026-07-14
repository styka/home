/**
 * Z-096 — logi strukturalne (JSON, jedna linia) + pomiar czasu operacji.
 *
 * Cel: spójny, parsowalny log (dla agregatorów/observability) zamiast luźnych
 * `console.log`. Lekkie i izomorficzne; `reportServerError`/`reportClientError`
 * (report.ts) służą do BŁĘDÓW, a `logEvent`/`timed` do zdarzeń/metryk
 * (czas akcji, błędy per moduł, koszt LLM).
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

/** Buduje rekord loga (czysta funkcja — testowalna). */
export function buildLogRecord(level: LogLevel, event: string, fields?: LogFields, now: Date = new Date()): Record<string, unknown> {
  return { ts: now.toISOString(), level, event, ...(fields ?? {}) };
}

/** Emituje log strukturalny na właściwy strumień (error→stderr, reszta→stdout). */
export function logEvent(level: LogLevel, event: string, fields?: LogFields): void {
  const line = JSON.stringify(buildLogRecord(level, event, fields));
  // eslint-disable-next-line no-console
  if (level === "error") console.error(line);
  // eslint-disable-next-line no-console
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

/**
 * Mierzy czas wykonania `fn` i loguje zdarzenie z `durationMs` (+ `ok`/`error`).
 * Re-rzuca wyjątek po zalogowaniu — nie zmienia zachowania wołającego.
 */
export async function timed<T>(event: string, fn: () => Promise<T>, fields?: LogFields): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logEvent("info", event, { ...fields, durationMs: Date.now() - start, ok: true });
    return result;
  } catch (e) {
    logEvent("error", event, { ...fields, durationMs: Date.now() - start, ok: false, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
