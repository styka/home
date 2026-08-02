// 042: lekka magistrala zdarzeń do otwierania przełącznika ulubionych z dowolnego miejsca powłoki.
//
// Po co, skoro to jeden komponent? Bo wyzwalacze są DWA (pasek boczny na desktopie i pasek górny
// na telefonie) i oba są zawsze w drzewie — ukrywa je wyłącznie CSS (`hidden md:flex` / `md:hidden`).
// Gdyby każdy z nich montował własny przełącznik i własny listener skrótów, `Alt+1` odpalałby się
// dwa razy, a w dokumencie żyłyby dwie nakładki. Nakładka i skróty są więc montowane RAZ w
// `AppShell`, a wyzwalacze tylko wysyłają zdarzenie.
//
// Ten sam wzorzec, co `lib/ai/assistantBus.ts`.

export const FAVORITES_OPEN_EVENT = "omnia:favorites-open";

export function openFavoritesSwitcher(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FAVORITES_OPEN_EVENT));
}
