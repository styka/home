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

  // Z-131 (T-17): worker kolejki zadań w tle (OCR/analizy AI). In-process; na prod
  // (płatny tier) chodzi ciągle. Wyłączalny `JOBS_WORKER_DISABLED=1` (testy/e2e/build).
  try {
    const { startJobWorker } = await import("@/lib/jobs/worker");
    startJobWorker();
  } catch (e) {
    reportServerError(e, { kind: "jobWorkerStart" });
  }

  // Z-090 (gdy DSN gotowy): odkomentuj po dodaniu zależności @sentry/node:
  // if (process.env.SENTRY_DSN) {
  //   const Sentry = await import("@sentry/node");
  //   Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  //   (globalThis as unknown as { Sentry: unknown }).Sentry = Sentry;
  // }
}
