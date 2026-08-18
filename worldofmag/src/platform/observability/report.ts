/**
 * Z-111 + Z-090: cienka, izomorficzna warstwa raportowania błędów.
 *
 * Domyślnie loguje do konsoli. Integracja z zewnętrznym error-trackingiem (Sentry,
 * Z-090) podpina się tutaj — gdy DSN nie jest ustawiony, działa jak no-op poza
 * konsolą (graceful degradation). Dzięki temu reszta kodu woła jeden punkt
 * (`reportClientError` / `reportServerError`) niezależnie od dostawcy.
 */
import { logEvent } from "@/platform/observability/log";

type Ctx = Record<string, unknown>;

function capture(scope: "client" | "server", error: unknown, context?: Ctx) {
  // Hook dla Sentry (Z-090): jeśli SDK jest załadowane globalnie, użyj go.
  const g = globalThis as unknown as { Sentry?: { captureException?: (e: unknown, c?: unknown) => void } };
  if (g.Sentry?.captureException) {
    try {
      g.Sentry.captureException(error, context ? { extra: context } : undefined);
      return;
    } catch {
      /* spadnij do konsoli */
    }
  }
  // 086: błąd też jest logiem strukturalnym — inaczej połowa strumienia jest JSON-em, a połowa
  // tekstem, i żaden agregator nie umie odpowiedzieć na pytanie „ile błędów w module X".
  logEvent("error", "error.captured", {
    scope,
    error: error instanceof Error ? error.message : String(error),
    ...(context ?? {}),
  });
}

export function reportClientError(error: unknown, context?: Ctx) {
  capture("client", error, context);
}

export function reportServerError(error: unknown, context?: Ctx) {
  capture("server", error, context);
}
