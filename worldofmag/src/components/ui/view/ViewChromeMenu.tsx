"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";

/**
 * 084 — CHROM POWŁOKI ZWINIĘTY DO JEDNEJ KONTROLKI.
 *
 * Zgłoszenie właściciela: „ta gwiazdka i info o odświeżeniu zabiera przestrzeń na pasek zakładek.
 * To bardzo złe."
 *
 * Rzecz w proporcji, a nie w samych ikonach. Pasek widoku ma trzy strefy — filtry modułu, akcje
 * modułu i chrom powłoki — z których **tylko filtry się kurczą**. Chrom nie kurczył się nigdy, więc
 * na wąskim ekranie zabierał zakładkom dokładnie tyle, ile sam zajmował (zmierzone: 43 px przy
 * ekranie 360 px, czyli 12% szerokości na trzy rzeczy, których używa się raz na jakiś czas).
 *
 * Dlaczego menu, a nie usunięcie którejś pozycji: wszystkie trzy są potrzebne, tylko żadna nie jest
 * potrzebna CIĄGLE. Gwiazdkę klika się przy zapisywaniu widoku, świeżość czyta przy podejrzeniu, że
 * dane są stare, skróty otwiera raz na kilka tygodni. To jest definicja zawartości menu.
 *
 * Komponent nie wie, CO dostaje — przyjmuje gotowe elementy chromu z `ViewChromeProvider`, tak jak
 * dotąd robił to `ViewBar`. Kontrakt widoku nie zmienia się ani o pole.
 */
export function ViewChromeMenu({ pozycje }: { pozycje: ReactNode[] }) {
  const t = useTranslations("components.ui.ViewChromeMenu");
  const [otwarte, setOtwarte] = useState(false);
  const kotwicaRef = useRef<HTMLDivElement>(null);

  if (pozycje.length === 0) return null;

  return (
    <div ref={kotwicaRef} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOtwarte((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={otwarte}
        aria-label={t("wiecej")}
        title={t("wiecej")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          // Cel dotyku pełnej wysokości (C-31) przy szerokości JEDNEJ ikony — o to w tej zmianie chodzi.
          width: 32,
          height: 40,
          borderRadius: 6,
          border: "none",
          background: otwarte ? "var(--bg-elevated)" : "none",
          color: otwarte ? "var(--text-primary)" : "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        <MoreHorizontal size={16} />
      </button>

      <AnchoredLayer
        anchorRef={kotwicaRef}
        open={otwarte}
        onClose={() => setOtwarte(false)}
        side="dol"
        align="koniec"
        role="menu"
        ariaLabel={t("wiecej")}
        style={{ padding: 4 }}
      >
        {/* Pozycje zostają TYM, czym są w pasku — własnymi komponentami powłoki. Menu daje im
            miejsce i odstęp, nie przerysowuje ich. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 180 }}>
          {/**
           * Menu NIE zamyka się samo po kliknięciu pozycji — i to jest konieczność, nie wygoda.
           *
           * Gwiazdka ulubionych otwiera własne okienko z nazwą widoku, zakotwiczone do siebie.
           * Zamknięcie menu odmontowuje gwiazdkę razem z tym okienkiem, więc kliknięcie „zapisz
           * widok" nie robiło NIC: okienko znikało w tej samej klatce, w której się pojawiało.
           * Menu zamyka się klikiem poza obszarem i klawiszem Esc — jak każda inna warstwa.
           */}
          {pozycje.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 6px" }}>
              {p}
            </div>
          ))}
        </div>
      </AnchoredLayer>
    </div>
  );
}
