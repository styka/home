// 045: otwarcie ściągawki skrótów z dowolnego miejsca powłoki.
//
// Ściągawka była dotąd dostępna WYŁĄCZNIE pod klawiszem `?`, czyli dla kogoś, kto już
// wie, że istnieje. Przycisk w pasku widoku czyni ją odkrywalną, ale sama nakładka musi
// pozostać montowana raz (w `AppShell`) — dwie nakładki w dokumencie to dwa nasłuchiwacze
// `?` i podwójne przełączanie.
//
// Ten sam wzorzec, co `lib/favorites/favoritesBus.ts`.

export const SHORTCUTS_OPEN_EVENT = "omnia:shortcuts-open";

export function openShortcutsCheatSheet(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHORTCUTS_OPEN_EVENT));
}
