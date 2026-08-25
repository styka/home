/**
 * 104 (punkt 3 planu domknięcia bezpieczeństwa) — CZY DZIAŁAMY NA HOSTINGU.
 *
 * Potrzebne do odcięcia uproszczonego logowania testowego. Wydawałoby się, że wystarczy sprawdzić
 * `NODE_ENV === "production"` — i **to jest właśnie pułapka**: od 098 klikacze budują aplikację
 * i serwują ją przez `next start`, czyli chodzą w trybie produkcyjnym. Bramka po `NODE_ENV`
 * wyłączyłaby logowanie testowe *w testach*, czyli wywróciłaby cały zestaw klikaczy.
 *
 * Rozróżnienie, o które naprawdę chodzi, brzmi „czy to maszyna hostingu", a nie „czy to build
 * produkcyjny". Render wstrzykuje własne zmienne do każdej swojej usługi — repozytorium już się na
 * nich opiera (`RENDER_GIT_BRANCH` w `next.config.mjs`), więc nie jest to nowe założenie.
 */

/**
 * `true`, gdy proces działa jako usługa na hostingu Render (test, produkcja — obojętnie).
 *
 * Parametr jest zwykłą mapą łańcuchów, a nie `NodeJS.ProcessEnv`: funkcja czyta z niej trzy klucze
 * i nic poza tym, a szerszy typ zmuszałby każde wywołanie w teście do podstawiania pól, których ta
 * funkcja nigdy nie dotyka.
 */
export function czyNaHostingu(env: Record<string, string | undefined> = process.env): boolean {
  return env.RENDER === "true" || !!env.RENDER_SERVICE_ID || !!env.RENDER_GIT_BRANCH;
}
