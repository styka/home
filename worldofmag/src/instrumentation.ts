/**
 * Z-090: instrumentacja serwera (Next App Router `register()`).
 *
 * - Łapie `unhandledRejection` po stronie serwera i kieruje je do wspólnej warstwy
 *   raportowania (`reportServerError`), żeby nie ginęły cicho.
 * - Jest miejscem na init zewnętrznego error-trackingu (Sentry) — gdy właściciel
 *   ustawi `SENTRY_DSN`, tutaj należy zainicjować SDK i wystawić je jako
 *   `globalThis.Sentry` (wtedy `report.ts` użyje `captureException`).
 *   Bez DSN działa jak no-op (graceful degradation).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { reportServerError } = await import("@/lib/observability/report");

  process.on("unhandledRejection", (reason) => {
    reportServerError(reason, { kind: "unhandledRejection" });
  });

  // Z-131 (T-17): worker kolejki NIE jest startowany tutaj. `instrumentation.ts` jest
  // bundlowany także dla runtime EDGE, a łańcuch workera (chat→secrets/cache) używa
  // node:crypto → build padał „Can't resolve 'crypto'". Worker startujemy leniwie z tras
  // API (`/api/jobs`, runtime Node) przez `ensureJobWorker()` — idempotentnie.

  // Z-090 (gdy DSN gotowy): odkomentuj po dodaniu zależności @sentry/node:
  // if (process.env.SENTRY_DSN) {
  //   const Sentry = await import("@sentry/node");
  //   Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  //   (globalThis as unknown as { Sentry: unknown }).Sentry = Sentry;
  // }
}
