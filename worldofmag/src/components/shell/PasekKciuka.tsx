"use client";

import { useTranslations } from "next-intl";
import { Compass, History, Home, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { openAssistant } from "@/platform/ai/assistantBus";
import { stronyPaska, type ModuleDef, type PozycjaPaska, type Reka } from "@/lib/modules";

/**
 * 100/103/104: dolny pasek na telefonie.
 *
 * **100** postawiło geometrię: układ lustrzany wg dominującej ręki i magiczna ikona na środku.
 * **103** zmieniło treść paska na kotwice (dom, ulubione, historia) + miejsca modułowe.
 * **104** odebrało pasKowi GESTY i dołożyło szóstą kotwicę — i to jest treść zgłoszenia właściciela
 * po zobaczeniu paska na żywo:
 *
 *  - „te pierwsze 3 ikony […] mają możliwość rozwijania wachlarzy a one nie mają mieć wachlarzy" —
 *    ikona modułu prowadzi **wprost do modułu**, cokolwiek by z nią robić. Jedna ikona = jedna
 *    czynność. Wcześniej ta sama ikona robiła dwie różne rzeczy zależnie od czasu przytrzymania,
 *    więc **każde dotknięcie paska było ryzykiem**: za wolno cofnięty palec otwierał warstwę na pół
 *    ekranu zamiast przejść do modułu.
 *  - „między gwiazdką a ikoną »wstecz« dodaj nową ikonę […] do szybkiego nawigowania" — kotwica
 *    `nawigacja`, która otwiera panel (patrz `PanelNawigacji`).
 *  - „sposób wachlarza jest słaby, chaotyczny" — łukowy `WachlarzNawigacji` został **skasowany**
 *    z całej aplikacji, nie tylko wypięty z paska.
 *
 * Trzy rzeczy, które zostają nienaruszone:
 *
 * 1. **Magiczna ikona stoi na ŚRODKU i środek jest neutralny względem ręki.** Jedyny element,
 *    którego nigdy nie trzeba szukać, nie zmienia miejsca po przełączeniu ręki.
 * 2. **Skład i lustrzenie liczą czyste funkcje** (`pozycjePaska`, `stronyPaska` w `lib/modules`),
 *    nie ten komponent — tutaj jest wyłącznie rysowanie. Lekcja z run 103: gdy lustrzenie siedziało
 *    w JSX, test sprawdzał listę PRZED odwróceniem i twierdził coś przeciwnego do tego, co widać.
 * 3. **Komponenty pozycji stoją na POZIOMIE MODUŁU.** Powód z run 100 (przechwycony wskaźnik) już
 *    nie obowiązuje, ale deklarowanie komponentu w ciele rodzica nadal odmontowuje węzeł przy
 *    każdym renderze — a razem z nim ogniskowanie i stan pola wyszukiwania w panelu.
 */
export function PasekKciuka({
  dalekie,
  bliskie,
  reka,
  pathname,
  onModul,
  ulubione,
  nawigacja,
  historia,
}: {
  /** Pozycje strony DALSZEJ od kciuka (dom + moduły). */
  dalekie: PozycjaPaska[];
  /** Pozycje strony BLIŻSZEJ kciuka (ulubione, nawigacja, wstecz). */
  bliskie: PozycjaPaska[];
  reka: Reka;
  pathname: string;
  /** Przejście pod adres — jedyne, co robią ikony modułów i domu. */
  onModul: (href: string) => void;
  /** Gwiazdka: stan bieżącego widoku i przełączenie zapisu. */
  ulubione: { zapisany: boolean; przelacz: () => void };
  /** Szybka nawigacja: otwarcie panelu i jego stan (dla `aria-expanded`). */
  nawigacja: { otwarty: boolean; otworz: () => void; kotwicaRef: React.RefObject<HTMLButtonElement> };
  /** „Wstecz": krok wstecz i komunikat, gdy nie ma dokąd wracać. */
  historia: { wstecz: () => void; pusta: boolean };
}) {
  const t = useTranslations("components.shell.PasekKciuka");

  /**
   * Recenzja 100: pasek rysujemy TAKŻE przy pustej liście pozycji modułowych — u konta o wąskich
   * uprawnieniach magiczna ikona nie ma innego miejsca na telefonie, a kotwice nie zależą od
   * uprawnień modułowych w ogóle.
   *
   * Podział na dwa pojemniki `flex: 1` jest tym, co trzyma magiczną ikonę w GEOMETRYCZNYM środku:
   * każdy zajmuje dokładnie połowę wolnej szerokości niezależnie od tego, ile pozycji trzyma.
   * Przy 360 px daje to 292 px na sześć pozycji, czyli ~48,7 px każda — powyżej minimum 44 px (C-31).
   */
  const { lewa, prawa } = stronyPaska(dalekie, bliskie, reka);

  const rysuj = (pozycja: PozycjaPaska, blisko: boolean) => {
    switch (pozycja.rodzaj) {
      case "modul":
        return (
          <PozycjaModulu key={`modul:${pozycja.modul.id}`} m={pozycja.modul} blisko={blisko} pathname={pathname} onKlik={onModul} />
        );
      case "dom":
        return (
          <PozycjaProsta
            key="dom"
            Icon={Home}
            etykieta={t("stronaGlowna")}
            opis={t("stronaGlownaOpis")}
            aktywna={pathname === "/"}
            blisko={blisko}
            naKlik={() => onModul("/")}
          />
        );
      case "ulubione":
        return (
          <PozycjaProsta
            key="ulubione"
            Icon={Star}
            etykieta={t("ulubione")}
            opis={ulubione.zapisany ? t("ulubioneUsun") : t("ulubioneZapisz")}
            wcisnieta={ulubione.zapisany}
            kolor={ulubione.zapisany ? "var(--accent-amber)" : undefined}
            wypelnienie={ulubione.zapisany}
            blisko={blisko}
            naKlik={ulubione.przelacz}
          />
        );
      case "nawigacja":
        return (
          <PozycjaProsta
            key="nawigacja"
            ref={nawigacja.kotwicaRef}
            Icon={Compass}
            etykieta={t("nawigacja")}
            opis={t("nawigacjaOpis")}
            wcisnieta={nawigacja.otwarty}
            rozwijana
            blisko={blisko}
            naKlik={nawigacja.otworz}
          />
        );
      case "historia":
        return (
          <PozycjaProsta
            key="historia"
            Icon={History}
            etykieta={t("historia")}
            opis={historia.pusta ? t("historiaPustaOpis") : t("historiaOpis")}
            przygaszona={historia.pusta}
            blisko={blisko}
            naKlik={historia.wstecz}
          />
        );
      default: {
        /**
         * Wyczerpanie wariantów pilnowane przez TYP, nie przez czujność. Bez tego dołożenie
         * siódmego rodzaju pozycji skompilowałoby się i po prostu **nic by nie narysowało** —
         * a pasek z brakującą ikoną wygląda na wolno ładujący się, nie na zepsuty.
         */
        const nieznany: never = pozycja;
        return nieznany;
      }
    }
  };

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
        {lewa.map((p) => rysuj(p, reka === "left"))}
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
        {prawa.map((p) => rysuj(p, reka === "right"))}
      </div>
    </nav>
  );
}

/**
 * Wspólny styl przycisku pozycji.
 *
 * **104: nie ma tu już `touch-action: none`** i to jest część naprawy, nie sprzątanie. Ta reguła
 * przyszła z gestem (przechwytywanie wskaźnika), a zostawiona po nim nadal odbierałaby przeglądarce
 * przewijanie zaczęte palcem na ikonie — czyli pasek „zacinałby się" w sposób, którego nikt by nie
 * powiązał ze skasowaną funkcją.
 */
const STYL_POZYCJI = {
  flexGrow: 1,
  flexBasis: 0,
  minWidth: 44,
  minHeight: 44,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
} as const;

/** Podpis pod ikoną — jeden wyraz, przycinany. Przy ~49 px zawinięcie rozepchnęłoby wysokość paska. */
const STYL_PODPISU = {
  fontSize: 10,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

function PozycjaModulu({
  m,
  blisko,
  pathname,
  onKlik,
}: {
  m: ModuleDef;
  blisko: boolean;
  pathname: string;
  onKlik: (href: string) => void;
}) {
  const aktywna = m.exact ? pathname === m.href : pathname.startsWith(m.href);
  return (
    <button
      type="button"
      aria-current={aktywna ? "page" : undefined}
      aria-label={m.label}
      onClick={() => onKlik(m.href)}
      className="flex flex-col items-center justify-center gap-0.5"
      style={{ ...STYL_POZYCJI, color: aktywna ? m.color : "var(--text-muted)" }}
    >
      <m.Icon size={blisko ? 22 : 20} />
      <span style={STYL_PODPISU}>{m.label}</span>
    </button>
  );
}

/**
 * Kotwica paska — dom, ulubione, szybka nawigacja, „wstecz".
 *
 * `opis` jest osobny od `etykiety` celowo: pod ikoną musi stać wyraz mieszczący się w ~49 px, ale
 * czytnik ekranu ma usłyszeć, **co przycisk robi** („Zapisz ten widok w ulubionych"), a nie samą
 * nazwę zbioru. Etykieta nazywa miejsce, opis nazywa czynność.
 */
const PozycjaProsta = function PozycjaProsta({
  Icon,
  etykieta,
  opis,
  aktywna,
  wcisnieta,
  przygaszona,
  rozwijana,
  kolor,
  wypelnienie,
  blisko,
  naKlik,
  ref,
}: {
  Icon: LucideIcon;
  etykieta: string;
  opis: string;
  aktywna?: boolean;
  wcisnieta?: boolean;
  przygaszona?: boolean;
  /** Otwiera warstwę — wtedy `aria-haspopup` mówi czytnikowi, czego się spodziewać. */
  rozwijana?: boolean;
  kolor?: string;
  wypelnienie?: boolean;
  blisko: boolean;
  naKlik: () => void;
  ref?: React.RefObject<HTMLButtonElement>;
}) {
  const rozmiar = blisko ? 22 : 20;
  return (
    <button
      ref={ref}
      type="button"
      aria-current={aktywna ? "page" : undefined}
      aria-pressed={rozwijana ? undefined : wcisnieta}
      aria-expanded={rozwijana ? wcisnieta : undefined}
      aria-haspopup={rozwijana ? "dialog" : undefined}
      aria-label={opis}
      title={opis}
      onClick={naKlik}
      className="flex flex-col items-center justify-center gap-0.5"
      style={{
        ...STYL_POZYCJI,
        color: kolor ?? (aktywna || wcisnieta ? "var(--text-primary)" : "var(--text-muted)"),
        // Wyszarzenie zamiast ukrycia: pozycja, która znika i wraca, zmieniałaby szerokość
        // sąsiadów w trakcie pracy — a użytkownik celuje w miejsce, nie w ikonę.
        opacity: przygaszona ? 0.4 : 1,
      }}
    >
      <Icon size={rozmiar} fill={wypelnienie ? (kolor ?? "currentColor") : "none"} />
      <span style={STYL_PODPISU}>{etykieta}</span>
    </button>
  );
};
