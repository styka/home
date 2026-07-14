/**
 * Z-111 + Z-090: cienka, izomorficzna warstwa raportowania błędów.
 *
 * Domyślnie loguje do konsoli. Integracja z zewnętrznym error-trackingiem (Sentry,
 * Z-090) podpina się tutaj — gdy DSN nie jest ustawiony, działa jak no-op poza
 * konsolą (graceful degradation). Dzięki temu reszta kodu woła jeden punkt
 * (`reportClientError` / `reportServerError`) niezależnie od dostawcy.
 */
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
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, error, context ?? "");
}

export function reportClientError(error: unknown, context?: Ctx) {
  capture("client", error, context);
}

export function reportServerError(error: unknown, context?: Ctx) {
  capture("server", error, context);
}
