"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { openAssistant } from "@/platform/ai/assistantBus";
import type { ModuleDef, Reka } from "@/lib/modules";
import { useWachlarz } from "./WachlarzNawigacji";

/**
 * 100: dolny pasek na telefonie — ergonomia kciuka, magiczna ikona na środku, gest przytrzymania.
 *
 * Zgłoszenie właściciela: „by najważniejsze rzeczy dało się wybrać prawym kciukiem trzymając mobile
 * w prawej dłoni […] możliwość zamiany stron tego zachowania dla osób leworęcznych […] na tym
 * dolnym pasku na dole na środku paska ma być magiczna ikona tak bardziej wyeksponowana".
 *
 * Trzy rzeczy, które łatwo zepsuć przy zmianie:
 *
 * 1. **Magiczna ikona stoi na ŚRODKU i środek jest neutralny względem ręki.** To nie jest
 *    niedoróbka lustrzenia, tylko jego cel: jedyny element, którego nigdy nie trzeba szukać, ma
 *    nie zmieniać miejsca po przełączeniu ręki. Reszta paska jest lustrzana, ona nie.
 * 2. **Różnica między ręką dominującą a drugą jest w NADMIARZE, nigdy w niedomiarze.** Pozycje
 *    bliżej kciuka są szersze i mają większą ikonę, ale każda — także ta najdalsza — trzyma
 *    minimum 44 × 44 px (C-31). Zwężenie „tej dalszej" byłoby karą za trzymanie telefonu inaczej.
 * 3. **To nie jest `<Link>`.** Nawigacją steruje gest z `WachlarzNawigacji`: krótkie tapnięcie
 *    prowadzi wprost, przytrzymanie otwiera wachlarz. Dwie ścieżki nawigacji (kliknięcie w `<a>`
 *    i `router.push` z gestu) musiałyby się zgadzać co do pikseli, bo przy przechwyconym wskaźniku
 *    kliknięcie trafia gdzie indziej niż palec.
 */
export function PasekKciuka({
  pozycje,
  reka,
  pathname,
}: {
  pozycje: ModuleDef[];
  reka: Reka;
  pathname: string;
}) {
  const t = useTranslations("components.shell.PasekKciuka");
  const { uchwyty } = useWachlarz();

  if (pozycje.length === 0) return null;

  // Podział na dwie strony wokół środka. Przy nieparzystej liczbie nadmiar ląduje po stronie
  // dominującej ręki — tam, gdzie kciuk sięga taniej.
  const polowa = Math.ceil(pozycje.length / 2);
  const bliskie = reka === "left" ? pozycje.slice(0, polowa) : pozycje.slice(pozycje.length - polowa);
  const dalekie = reka === "left" ? pozycje.slice(polowa) : pozycje.slice(0, pozycje.length - polowa);
  const lewa = reka === "left" ? bliskie : dalekie;
  const prawa = reka === "left" ? dalekie : bliskie;

  function Pozycja({ m, blisko }: { m: ModuleDef; blisko: boolean }) {
    const aktywna = m.exact ? pathname === m.href : pathname.startsWith(m.href);
    const { style: styleGestu, ...gest } = uchwyty(m.href);
    return (
      <button
        type="button"
        aria-current={aktywna ? "page" : undefined}
        aria-label={m.label}
        {...gest}
        className="flex flex-col items-center justify-center gap-0.5"
        style={{
          ...styleGestu,
          // Nadmiar po stronie kciuka; minimum jest wspólne i nienaruszalne (C-31).
          flexGrow: blisko ? 1.35 : 1,
          flexBasis: 0,
          minWidth: 44,
          minHeight: 44,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: aktywna ? m.color : "var(--text-muted)",
        }}
      >
        <m.Icon size={blisko ? 22 : 20} />
        <span style={{ fontSize: 10 }}>{m.label}</span>
      </button>
    );
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t"
      aria-label={t("nawigacjaGlowna")}
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
        height: "calc(56px + env(safe-area-inset-bottom))",
      }}
    >
      {lewa.map((m) => (
        <Pozycja key={m.id} m={m} blisko={reka === "left"} />
      ))}

      {/* Magiczna ikona — stałe miejsce, wyeksponowana ponad krawędź paska. Pierścień w kolorze
          tła daje wrażenie, że przycisk „wychodzi" z paska, a nie leży na nim. */}
      <div style={{ flexGrow: 0, flexShrink: 0, width: 68, display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => openAssistant()}
          title={t("asystentAi")}
          aria-label={t("asystentAi")}
          style={{
            width: 52,
            height: 52,
            marginTop: -14,
            borderRadius: "50%",
            border: "4px solid var(--bg-base)",
            background: "var(--accent-blue)",
            color: "var(--on-accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            cursor: "pointer",
          }}
        >
          <Sparkles size={24} />
        </button>
      </div>

      {prawa.map((m) => (
        <Pozycja key={m.id} m={m} blisko={reka === "right"} />
      ))}
    </nav>
  );
}
