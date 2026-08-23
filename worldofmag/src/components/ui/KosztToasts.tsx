"use client";

/**
 * 083 — ULOTNE powiadomienia o koszcie operacji AI, dla administratora.
 *
 * Zgłoszenie właściciela: komponent kosztu przy każdej treści zabierał miejsce wszystkim, a i tak
 * interesuje jedną osobę. Rozwiązanie rozdziela dwie różne potrzeby, które wcześniej obsługiwał
 * jeden element:
 *   • „ile to kosztowało PRZED chwilą" → to powiadomienie: pojawia się samo, znika samo, nie
 *     zajmuje miejsca w treści;
 *   • „ile kosztowała TA konkretna treść i z czego się to składa" → wskaźnik przy treści,
 *     włączany przełącznikiem w pasku.
 *
 * Świadomie NIE trafia do dzwonka powiadomień ani do bazy (AC-13). Powiadomienie systemowe znaczy
 * „coś wymaga twojej uwagi później"; koszt wywołania, które właśnie zobaczyłeś, nie jest taką
 * rzeczą. Zapisywanie ich zrobiłoby z dzwonka dziennik techniczny — od tego jest `/admin/ai-calls`.
 *
 * Warstwa: powyżej modali (50) i pływającego przycisku zgłoszeń (10001), bo powiadomienie ma być
 * widoczne także wtedy, gdy operacja AI została uruchomiona z okna modalnego.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { onKoszt } from "@/platform/ai/kosztBus";
import { DEFAULT_USD_PLN_RATE, withPln } from "@/lib/usdPln";

const CZAS_ZYCIA_MS = 6000;
const MAKS_NARAZ = 3;

interface Wpis {
  id: number;
  akcja: string;
  usd: number;
  znany: boolean;
  /** Ile razy ta sama akcja wystąpiła, zanim powiadomienie zniknęło. */
  powtorzenia: number;
}

let licznik = 0;

export function KosztToasts({ rate = DEFAULT_USD_PLN_RATE }: { rate?: number }) {
  const t = useTranslations("components.ui.KosztToasts");
  const [wpisy, setWpisy] = useState<Wpis[]>([]);

  useEffect(() => {
    return onKoszt(({ akcja, usage }) => {
      const usd = usage?.costUsd ?? 0;
      const znany = usage?.costKnown !== false;
      setWpisy((poprzednie) => {
        // Powtórzenie tej samej akcji ŁĄCZY SIĘ z istniejącym wpisem zamiast układać stos.
        // Bez tego jedno kliknięcie uruchamiające serię wywołań zalałoby ekran kolumną kafelków.
        const istniejacy = poprzednie.find((w) => w.akcja === akcja);
        if (istniejacy) {
          return poprzednie.map((w) =>
            w.akcja === akcja
              ? { ...w, usd: w.usd + usd, znany: w.znany && znany, powtorzenia: w.powtorzenia + 1 }
              : w,
          );
        }
        const nowy: Wpis = { id: ++licznik, akcja, usd, znany, powtorzenia: 1 };
        return [...poprzednie, nowy].slice(-MAKS_NARAZ);
      });
    });
  }, []);

  // Znikanie: jeden zegar na wpis, ustawiany po jego pojawieniu się. Przy łączeniu powtórzeń wpis
  // zachowuje pierwotny czas życia — inaczej seria wywołań trzymałaby kafelek na ekranie w
  // nieskończoność.
  useEffect(() => {
    if (wpisy.length === 0) return;
    const najstarszy = wpisy[0];
    const timer = setTimeout(() => {
      setWpisy((poprzednie) => poprzednie.filter((w) => w.id !== najstarszy.id));
    }, CZAS_ZYCIA_MS);
    return () => clearTimeout(timer);
  }, [wpisy]);

  if (wpisy.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 flex flex-col gap-2"
      style={{ zIndex: 10050 }}
    >
      {wpisy.map((w) => (
        <div
          key={w.id}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-lg"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--text-primary)",
            maxWidth: 320,
          }}
        >
          <Sparkles size={13} style={{ color: "var(--accent-purple)", flexShrink: 0 }} aria-hidden />
          <span className="min-w-0 flex-1 truncate" title={w.akcja}>
            {w.akcja}
            {w.powtorzenia > 1 && (
              <span style={{ color: "var(--text-muted)" }}> ×{w.powtorzenia}</span>
            )}
          </span>
          <span className="shrink-0 font-medium" style={{ color: "var(--text-secondary)" }}>
            {/* „Koszt nieznany" zamiast „0 zł" — model bez wpisu w cenniku nie jest darmowy,
                tylko niewyceniony (reguła z 034). */}
            {w.znany ? withPln(`~$${w.usd.toFixed(4)}`, w.usd, rate) : t("kosztNieznany")}
          </span>
        </div>
      ))}
    </div>
  );
}
