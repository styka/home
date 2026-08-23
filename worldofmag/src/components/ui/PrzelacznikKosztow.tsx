"use client";

/**
 * 083 — przełącznik pokazywania kosztów AI przy treściach.
 *
 * Stoi w chromie konta (obok dzwonka na telefonie, w nagłówku sekcji Ulubione na desktopie,
 * w nagłówku asystenta) — a nie w treści, bo dotyczy sposobu oglądania CAŁEJ aplikacji, nie
 * jednego widoku.
 *
 * Renderuje `null`, gdy przełącznik jest niedostępny — czyli dla każdego, kto nie jest
 * administratorem, oraz gdy systemowy wyłącznik kosztów jest zgaszony. Nie-administrator nie widzi
 * nawet tego, że taka opcja istnieje.
 */

import { useTranslations } from "next-intl";
import { Coins } from "lucide-react";
import { usePokazKoszty } from "@/platform/ai/kosztWidocznosc";

export function PrzelacznikKosztow({ rozmiar = 16 }: { rozmiar?: number }) {
  const t = useTranslations("components.ui.PrzelacznikKosztow");
  const { dostepne, pokazuj, przelacz } = usePokazKoszty();
  if (!dostepne) return null;

  const etykieta = pokazuj ? t("ukryjKoszty") : t("pokazKoszty");
  return (
    <button
      type="button"
      onClick={przelacz}
      aria-pressed={pokazuj}
      aria-label={etykieta}
      title={etykieta}
      className="flex items-center justify-center rounded"
      style={{
        width: 32,
        height: 32,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: pokazuj ? "var(--accent-amber)" : "var(--text-secondary)",
      }}
    >
      <Coins size={rozmiar} />
    </button>
  );
}
