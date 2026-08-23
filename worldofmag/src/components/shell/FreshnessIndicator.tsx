"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { onDataRefreshed, lastRefreshAt } from "@/lib/dataFreshnessBus";

/**
 * 045 — widoczny wskaźnik świeżości danych w pasku widoku.
 *
 * `DataFreshness` odświeża dane w tle od dawna, ale renderuje `null` — użytkownik nie
 * miał żadnego sygnału, czy patrzy na dane sprzed sekundy, czy sprzed kwadransa.
 *
 * ZAKRES JEST CELOWO WĄSKI: to uwidacznia istniejący mechanizm i **nie dokłada ani
 * jednego zapytania**. Usunięcie odpytywania w tle i zastąpienie go kanałem zdarzeń to
 * Faza 4 przebudowy (rozdz. 11.1) — mieszanie tego z warstwą UI dałoby zmianę, której
 * nie da się osobno wycofać.
 */

function formatAge(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "teraz";
  if (minutes === 1) return "1 min temu";
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "godzinę temu" : `${hours} godz. temu`;
}

export function FreshnessIndicator() {
  const [at, setAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setAt(lastRefreshAt());
    const unsubscribe = onDataRefreshed((ts) => setAt(ts));
    // Przerysowanie co 30 s, żeby napis się starzał. To timer WYŁĄCZNIE na tekst —
    // nie odpytuje niczego i nie dotyka sieci.
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  // Do pierwszego odświeżenia nie mamy czego pokazać — pusty wskaźnik jest lepszy niż
  // zmyślony („teraz" przy danych z serwera sprzed minuty byłoby kłamstwem).
  if (at === null) return null;

  const label = formatAge(Date.now() - at);

  return (
    <span
      title={`Dane odświeżono: ${label}`}
      aria-label={`Dane odświeżono ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "0 6px",
        height: 32,
        fontSize: 11,
        color: "var(--text-muted)",
        whiteSpace: "nowrap",
        // Bez afordancji kontrolki: brak wskaźnika myszy, brak tła, brak obramowania.
        cursor: "default",
      }}
    >
      {/* 083: ZEGAR, nie strzałka odświeżania.
          Zgłoszenie właściciela: „ikona odświeżania, która wygląda na wyłączoną i nie wiadomo, do
          czego służy, a powyżej niej jest przycisk «Odśwież»". Rozpoznanie było trafne w połowie:
          to nigdy nie był przycisk — to podpis z wiekiem danych. Winna była IKONA: kołowa strzałka
          jest powszechnym symbolem akcji odświeżania, więc element bez reakcji na kliknięcie
          czytało się jako zepsuty, a stojąc obok prawdziwego „Odśwież" — jako jego duplikat.
          Zegar mówi „czas", nie „zrób", i nie konkuruje z niczym.
          Ikona jest `aria-hidden`, bo znaczenie niesie tekst obok. */}
      <Clock size={12} aria-hidden />
      {/* Tekst pokazujemy ZAWSZE. Wcześniej znikał na wąskim ekranie (`hidden sm:inline`) i zostawała
          sama ikona — czyli dokładnie ten stan, w którym nie wiadomo, co element znaczy. */}
      <span>{label}</span>
    </span>
  );
}
