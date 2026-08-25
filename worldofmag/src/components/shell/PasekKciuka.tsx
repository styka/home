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
 *    bliżej kciuka mają większą ikonę, a przy nieparzystej ich liczbie także więcej miejsca —
 *    ale każda, także ta najdalsza, trzyma minimum 44 × 44 px (C-31). Zwężenie „tej dalszej"
 *    byłoby karą za trzymanie telefonu inaczej.
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

  /**
   * Podział na dwie strony wokół środka — i to jest miejsce, w którym łatwo zepsuć AC-13.
   *
   * Pierwsza wersja rozdzielała pozycje wprost do jednego rzędu `flex`, dosypując nadmiar po
   * stronie dominującej. Skutek zmierzony klikaczem: przy trzech pozycjach (1 z lewej, 2 z prawej)
   * magiczna ikona stała **74 px od środka paska** — bo „środek" był wtedy środkiem między dwiema
   * nierównymi grupami, a nie środkiem ekranu.
   *
   * Dlatego strony są DWOMA POJEMNIKAMI po `flex: 1`: każdy zajmuje dokładnie połowę wolnej
   * szerokości niezależnie od tego, ile pozycji trzyma, więc ikona jest w geometrycznym środku
   * zawsze. Przewaga kciuka bierze się z trzech innych rzeczy, nie z rozjechanego środka:
   *  - **kolejność jest lustrzana** — pozycja najważniejsza (pierwsza w kolejności użytkownika)
   *    ląduje w rogu, w którym kciuk spoczywa,
   *  - przy **nieparzystej** liczbie nadmiar idzie na stronę DALSZĄ, więc bliższe pozycje dzielą
   *    tę samą połowę na mniej części i każda wychodzi szersza,
   *  - bliższe pozycje mają większą ikonę.
   * Minimum 44 × 44 px obowiązuje wszystkie (C-31) — różnica jest w nadmiarze, nigdy w niedomiarze.
   */
  const ileBlisko = Math.floor(pozycje.length / 2);
  const bliskie = pozycje.slice(0, ileBlisko);
  const dalekie = pozycje.slice(ileBlisko);
  // Wewnątrz połowy najważniejsza pozycja ma być najdalej od środka (w rogu pod kciukiem), a każda
  // kolejna bliżej — stąd odwrócenie po stronie prawej i naturalna kolejność po lewej.
  const lewa = reka === "left" ? bliskie : [...dalekie].reverse();
  const prawa = reka === "left" ? [...dalekie] : [...bliskie].reverse();

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
          // Wewnątrz połowy wszystkie pozycje dzielą ją po równo — przewaga kciuka bierze się
          // z tego, ILE ich w tej połowie jest (patrz podział wyżej), a nie z mnożnika, który
          // między dwoma pojemnikami o stałej szerokości i tak nie miałby czego przesunąć.
          flexGrow: 1,
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
      <div className="flex flex-1 items-stretch" style={{ minWidth: 0 }}>
        {lewa.map((m) => (
          <Pozycja key={m.id} m={m} blisko={reka === "left"} />
        ))}
      </div>

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

      <div className="flex flex-1 items-stretch" style={{ minWidth: 0 }}>
        {prawa.map((m) => (
          <Pozycja key={m.id} m={m} blisko={reka === "right"} />
        ))}
      </div>
    </nav>
  );
}
