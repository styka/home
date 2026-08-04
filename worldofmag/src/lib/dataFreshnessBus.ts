// 045: lekka magistrala „dane właśnie odświeżono".
//
// `DataFreshness` (powłoka) odświeża dane w tle, a `FreshnessIndicator` (pasek widoku)
// chce o tym wiedzieć. Kontekst Reacta byłby tu droższy niż problem: nadawca jest
// montowany raz w `AppShell`, odbiorca żyje w komponencie strony, a między nimi
// przechodzi `{children}` — czyli granica, przez którą stan i tak musiałby przecisnąć
// się providerem opakowującym CAŁE drzewo i przerysowującym je co 45 sekund.
//
// Ten sam wzorzec, co `lib/favorites/favoritesBus.ts` i `lib/ai/assistantBus.ts`.

export const DATA_REFRESHED_EVENT = "omnia:data-refreshed";

/** Ostatnie odświeżenie w tej karcie. `null` = jeszcze żadnego (świeży render serwera). */
let lastAt: number | null = null;

export function lastRefreshAt(): number | null {
  return lastAt;
}

export function notifyDataRefreshed(): void {
  if (typeof window === "undefined") return;
  lastAt = Date.now();
  window.dispatchEvent(new CustomEvent(DATA_REFRESHED_EVENT, { detail: lastAt }));
}

/** Subskrypcja; zwraca funkcję odsubskrybowania. */
export function onDataRefreshed(handler: (at: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<number>).detail ?? Date.now());
  window.addEventListener(DATA_REFRESHED_EVENT, listener);
  return () => window.removeEventListener(DATA_REFRESHED_EVENT, listener);
}
