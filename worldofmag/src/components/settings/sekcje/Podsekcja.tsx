import type { ReactNode } from "react";

/**
 * 109: NAGŁÓWEK PODSEKCJI wewnątrz sekcji ustawień.
 *
 * Trzy sekcje łączą po dwa dawne bloki („Menu" + „Ulubione widoki", „Dysk Google" + „Kalendarz",
 * „Twój plan" + „Wiedza o Tobie"), bo opisują to samo. Tytuł całej sekcji rysuje rama widoku
 * (C-33), więc tutaj zostaje wyłącznie ten drugi poziom — w tym samym stylu, w jakim stały dawne
 * nagłówki, żeby przeniesienie treści nie zmieniło ani jednego piksela.
 *
 * Komponent jedzie razem z pierwszym konsumentem (C-35) — używają go dokładnie te trzy sekcje.
 */
export function Podsekcja({ tytul, children }: { tytul: string; children: ReactNode }) {
  return (
    <section>
      <h2
        style={{
          color: "var(--text-secondary)",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 10,
        }}
      >
        {tytul}
      </h2>
      {children}
    </section>
  );
}
