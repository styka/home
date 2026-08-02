// Z-218: jedno źródło prawdy dla kluczy sekcji pulpitu (Home).
// Wcześniej lista żyła tylko w `HomePage.tsx` (klient), więc akcja zapisu
// preferencji przyjmowała DOWOLNE stringi — literówka w JSON tworzyła „martwą"
// pozycję. Tu jest wspólny whitelist używany i przez UI, i przez Server Action.

// 042: kolejność domyślna to jednocześnie kolejność PIONOWA na wąskim ekranie (AC-16),
// więc zaczyna się od tego, co pilne, a kończy na tym, co historyczne. Użytkownicy z własną
// zapisaną kolejnością zachowują swoją — `HomePage` dokleja nowe klucze na końcu (AC-18).
export const DASHBOARD_SECTIONS = [
  "briefing",
  "favorites",
  "today",
  "modules",
  "quickActions",
  "suggestions",
  "recently",
] as const;

export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

/**
 * Odfiltrowuje nieznane klucze sekcji i duplikaty, zachowując kolejność wejścia.
 * Dzięki temu w `DashboardPref` nigdy nie wyląduje „martwa" pozycja.
 */
export function sanitizeSectionKeys(keys: unknown): string[] {
  if (!Array.isArray(keys)) return [];
  const known = new Set<string>(DASHBOARD_SECTIONS);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (typeof k === "string" && known.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
