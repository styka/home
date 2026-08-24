"use client";

/**
 * 085 (AC-9, AC-10) — przełącznik TRYBU ADMINISTRATORA.
 *
 * Był przełącznikiem samych kosztów AI (083). Zgłoszenie właściciela poszerzyło jego znaczenie:
 * ma chować **wszystko**, co w zwykłych widokach widzi tylko administrator, żeby dało się obejrzeć
 * aplikację oczami użytkownika. Etykieta idzie za tym znaczeniem — „pokaż koszty" opisywałoby
 * ćwiartkę tego, co przycisk robi.
 *
 * Stoi w chromie konta (rząd ikon obok dzwonka; w nagłówku asystenta osobno) — dotyczy sposobu
 * oglądania CAŁEJ aplikacji, nie jednego widoku.
 *
 * Renderuje `null` dla każdego, kto nie jest administratorem: nie-administrator nie widzi nawet
 * tego, że taka opcja istnieje. Sam przełącznik NIE znika po wyłączeniu trybu — inaczej nie dałoby
 * się go włączyć z powrotem (AC-9).
 */

import { useTranslations } from "next-intl";
import { ShieldCheck, Shield } from "lucide-react";
import { useTrybAdmina } from "@/platform/admin/trybAdmina";

export function PrzelacznikTrybuAdmina({ rozmiar = 16 }: { rozmiar?: number }) {
  const t = useTranslations("components.ui.PrzelacznikTrybuAdmina");
  const { dostepne, wlaczony, przelacz } = useTrybAdmina();
  if (!dostepne) return null;

  const etykieta = wlaczony ? t("wylaczTrybAdmina") : t("wlaczTrybAdmina");
  const Ikona = wlaczony ? ShieldCheck : Shield;
  return (
    <button
      type="button"
      onClick={przelacz}
      aria-pressed={wlaczony}
      aria-label={etykieta}
      title={etykieta}
      className="flex items-center justify-center rounded"
      style={{
        width: 32,
        height: 32,
        background: "none",
        border: "none",
        cursor: "pointer",
        color: wlaczony ? "var(--accent-amber)" : "var(--text-secondary)",
      }}
    >
      <Ikona size={rozmiar} />
    </button>
  );
}
