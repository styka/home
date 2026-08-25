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

  // 101 (AC-10) — STRAŻNIK SEKRETU SESJI.
  //
  // `session.ts` podstawia wartość zastępczą, gdy brak `AUTH_SECRET` — bo bez niej nie przeszedłby
  // `next build`. Ta wygoda ma jednak cenę: gdyby zmiennej zabrakło na produkcji, aplikacja
  // wstałaby i **działała**, podpisując sesje sekretem leżącym w publicznym repozytorium. Nic by
  // o tym nie powiedziało — a każdy mógłby podrobić cudzą sesję.
  //
  // `register()` uruchamia się przy STARCIE SERWERA, a nie podczas budowania, więc jest to jedyne
  // miejsce, gdzie można zatrzymać proces, nie psując builda (którego wymóg z AC-10 broni wprost).
  const { ZASTEPCZY_SEKRET_SESJI } = await import("@/platform/auth/zastepczySekret");
  const sekret = process.env.AUTH_SECRET;
  if (!sekret || sekret === ZASTEPCZY_SEKRET_SESJI) {
    throw new Error(
      "AUTH_SECRET nie jest ustawiony (albo ma wartość zastępczą z czasu budowania). " +
        "Aplikacja NIE wystartuje: bez własnego sekretu sesje byłyby podpisywane wartością " +
        "znaną publicznie, co pozwala podrobić sesję dowolnego użytkownika. " +
        "Ustaw zmienną środowiskową AUTH_SECRET w konfiguracji usługi."
    );
  }

  // Skutek uboczny strażnika, który warto nazwać: `secrets.ts` wyprowadza klucz szyfrowania
  // z `CONFIG_SECRET` **albo** `AUTH_SECRET`, a dopiero przy braku obu sięga po stałą z repozytorium.
  // Skoro powyżej `AUTH_SECRET` jest już zagwarantowany, ta niebezpieczna gałąź stała się
  // nieosiągalna — ustalenie U-09 z audytu domyka się samo.
  //
  // Zostaje jednak pułapka eksploatacyjna: bez własnego `CONFIG_SECRET` kluczem szyfrującym jest
  // sekret sesji, więc **rotacja `AUTH_SECRET` unieważnia wszystkie zapisane klucze API** (nie dadzą
  // się odszyfrować). Ostrzegamy raz przy starcie, bo w momencie rotacji nikt o tym nie pamięta.
  if (!process.env.CONFIG_SECRET) {
    const { logEvent } = await import("@/platform/observability/log");
    logEvent("warn", "konfiguracja.brak_config_secret", {
      skutek: "klucz szyfrowania sekretów pochodzi z AUTH_SECRET; jego rotacja unieważni zapisane klucze API",
    });
  }

  const { reportServerError } = await import("@/platform/observability/report");

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
