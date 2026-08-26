"use client";

import { useTranslations } from "next-intl";
import { Home, History, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { openAssistant } from "@/platform/ai/assistantBus";
import type { ModuleDef, PozycjaPaska, Reka } from "@/lib/modules";
import type { PozycjaWachlarza, ZrodloWachlarza } from "./WachlarzNawigacji";
import { useWachlarz } from "./WachlarzNawigacji";

/** Kształt uchwytów gestu, tak jak zwraca je `useWachlarz().uchwyty`. */
type UchwytyPozycji = ReturnType<ReturnType<typeof useWachlarz>["uchwyty"]>;

/**
 * 100/103: dolny pasek na telefonie — ergonomia kciuka, magiczna ikona na środku, gest przytrzymania.
 *
 * **100** postawiło geometrię: układ lustrzany wg dominującej ręki, magiczna ikona na środku,
 * przytrzymanie otwierające wachlarz nawigacji.
 * **103** zmieniło TREŚĆ paska: przestał być listą modułów. Zgłoszenie właściciela wymieniało skład
 * wprost — „Strona domowa | magiczna ikona asystenta | ulubione (gwiazdka) | nawigacja po przebytych
 * stronach" — więc pasek ma teraz trzy **kotwice** (dom, ulubione, historia), magiczną ikonę na
 * środku i pozostałe miejsca dla modułów wybranych przez użytkownika.
 *
 * Pięć rzeczy, które łatwo zepsuć przy zmianie:
 *
 * 1. **Magiczna ikona stoi na ŚRODKU i środek jest neutralny względem ręki.** To nie jest
 *    niedoróbka lustrzenia, tylko jego cel: jedyny element, którego nigdy nie trzeba szukać, ma
 *    nie zmieniać miejsca po przełączeniu ręki. Reszta paska jest lustrzana, ona nie.
 * 2. **Różnica między ręką dominującą a drugą jest w NADMIARZE, nigdy w niedomiarze.** Pozycje
 *    bliżej kciuka mają większą ikonę, a przy nieparzystej ich liczbie także więcej miejsca —
 *    ale każda, także ta najdalsza, trzyma minimum 44 × 44 px (C-31). Zwężenie „tej dalszej"
 *    byłoby karą za trzymanie telefonu inaczej.
 * 3. **To nie są `<Link>`-i.** Nawigacją steruje gest z `WachlarzNawigacji`: krótkie tapnięcie
 *    prowadzi wprost (albo wykonuje czynność kotwicy), przytrzymanie otwiera wachlarz. Dwie
 *    ścieżki nawigacji (kliknięcie w `<a>` i `router.push` z gestu) musiałyby się zgadzać co do
 *    pikseli, bo przy przechwyconym wskaźniku kliknięcie trafia gdzie indziej niż palec.
 * 4. **Skład paska liczy `pozycjePaska` w `lib/modules`, nie ten komponent.** Tutaj jest wyłącznie
 *    rysowanie. Arytmetyka „ile miejsc zostaje na moduły" musi być policzona raz, bo czyta ją także
 *    ekran ustawień.
 * 5. **Komponenty pozycji stoją na POZIOMIE MODUŁU** (patrz komentarz przy `PozycjaModulu`) — to
 *    wymóg poprawności gestu, nie porządek.
 */
export function PasekKciuka({
  dalekie,
  bliskie,
  reka,
  pathname,
  ulubione,
  historia,
}: {
  /** Pozycje strony DALSZEJ od kciuka (dom + moduły). */
  dalekie: PozycjaPaska[];
  /** Pozycje strony BLIŻSZEJ kciuka (ulubione, historia). */
  bliskie: PozycjaPaska[];
  reka: Reka;
  pathname: string;
  /** Stan i czynność gwiazdki oraz jej wachlarz zapisanych widoków. */
  ulubione: { zapisany: boolean; przelacz: () => void; pozycje: () => PozycjaWachlarza[] };
  /** Odwiedzone strony (najświeższa pierwsza), krok wstecz i komunikat przy pustej liście. */
  historia: { pozycje: () => PozycjaWachlarza[]; wstecz: () => void; pusta: boolean; naPustej: () => void };
}) {
  const t = useTranslations("components.shell.PasekKciuka");
  const { uchwyty } = useWachlarz();

  /**
   * Recenzja 100: pasek rysujemy TAKŻE przy pustej liście pozycji.
   *
   * Wcześniej było tu `return null`, co odbierało magicznej ikonie jej jedyne miejsce na telefonie
   * u konta z bardzo wąskimi uprawnieniami: `resolveTabBar` schodzi wtedy do pustej listy, pasek
   * znikał, a pływający wariant asystenta istnieje dopiero od `md`. Efekt: użytkownik bez dostępu
   * do modułów tracił też dostęp do asystenta — czyli do jedynego narzędzia, które i tak działa
   * niezależnie od uprawnień modułowych. Od 103 argument jest jeszcze mocniejszy: kotwice
   * (ulubione, historia) nie zależą od uprawnień modułowych w ogóle.
   */

  /**
   * Podział na dwie strony wokół środka — i to jest miejsce, w którym łatwo zepsuć AC-13 z run 100.
   *
   * Pierwsza wersja rozdzielała pozycje wprost do jednego rzędu `flex`, dosypując nadmiar po
   * stronie dominującej. Skutek zmierzony klikaczem: przy trzech pozycjach (1 z lewej, 2 z prawej)
   * magiczna ikona stała **74 px od środka paska** — bo „środek" był wtedy środkiem między dwiema
   * nierównymi grupami, a nie środkiem ekranu.
   *
   * Dlatego strony są DWOMA POJEMNIKAMI po `flex: 1`: każdy zajmuje dokładnie połowę wolnej
   * szerokości niezależnie od tego, ile pozycji trzyma, więc ikona jest w geometrycznym środku
   * zawsze. Przewaga kciuka bierze się z dwóch innych rzeczy:
   *  - strona bliższa trzyma MNIEJ pozycji (2 wobec 3), więc każda z nich jest szersza,
   *  - bliższe pozycje mają większą ikonę.
   * Minimum 44 × 44 px obowiązuje wszystkie (C-31) — różnica jest w nadmiarze, nigdy w niedomiarze.
   */
  // Wewnątrz połowy najważniejsza pozycja ma być najdalej od środka (w rogu pod kciukiem), a każda
  // kolejna bliżej — stąd odwrócenie strony bliższej.
  const lewa = reka === "left" ? [...bliskie].reverse() : [...dalekie];
  const prawa = reka === "left" ? [...dalekie].reverse() : [...bliskie].reverse();

  const rysuj = (pozycja: PozycjaPaska, blisko: boolean) => {
    switch (pozycja.rodzaj) {
      case "modul":
        return (
          <PozycjaModulu key={`modul:${pozycja.modul.id}`} m={pozycja.modul} blisko={blisko} pathname={pathname} uchwyty={uchwyty} />
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
            // Krótkie tapnięcie prowadzi na stronę główną, przytrzymanie otwiera zwykły wachlarz
            // modułów — dom nie ma własnego poziomu 1, bo nie jest zbiorem niczego.
            gest={uchwyty("/")}
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
            gest={uchwyty("", { pozycje: ulubione.pozycje, naTap: ulubione.przelacz })}
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
            /**
             * Pusta historia NIE dostaje uchwytów gestu — przytrzymanie otwierałoby warstwę bez
             * jednej podpowiedzi, czyli ekran, z którego jedynym wyjściem jest domyślenie się, że
             * trzeba puścić palec obok. Zamiast tego zwykły przycisk z komunikatem (AC-13).
             */
            gest={historia.pusta ? undefined : uchwyty("", { pozycje: historia.pozycje, naTap: historia.wstecz })}
            naKlik={historia.pusta ? historia.naPustej : undefined}
          />
        );
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

/** Wspólny styl przycisku pozycji — jeden zestaw reguł dla modułów i kotwic. */
const STYL_POZYCJI = {
  // Wewnątrz połowy wszystkie pozycje dzielą ją po równo — przewaga kciuka bierze się
  // z tego, ILE ich w tej połowie jest (patrz podział w `PasekKciuka`), a nie z mnożnika,
  // który między dwoma pojemnikami o stałej szerokości i tak nie miałby czego przesunąć.
  flexGrow: 1,
  flexBasis: 0,
  minWidth: 44,
  minHeight: 44,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
} as const;

/**
 * Pozycja paska — komponent **najwyższego poziomu**, i to jest wymóg poprawności, nie porządek.
 *
 * Pierwsza wersja (100) deklarowała tę funkcję wewnątrz ciała `PasekKciuka`. Każdy render tworzył
 * wtedy **nowy typ komponentu**, a otwarcie wachlarza zmienia wartość kontekstu, więc `PasekKciuka`
 * się przerenderowuje — React widział inny typ i **odmontowywał przyciski, montując nowe**. Razem
 * ze starym węzłem przepadał `setPointerCapture`, więc `pointerup` nigdy nie docierał do uchwytu
 * i gest się nie domykał. Ten sam powód, dla którego `NavItem` w `ModuleSidebar` też stoi na
 * poziomie modułu — i dlatego `PozycjaProsta` niżej też tu stoi.
 */
function PozycjaModulu({
  m,
  blisko,
  pathname,
  uchwyty,
}: {
  m: ModuleDef;
  blisko: boolean;
  pathname: string;
  uchwyty: (href: string, zrodlo?: ZrodloWachlarza) => UchwytyPozycji;
}) {
  const aktywna = m.exact ? pathname === m.href : pathname.startsWith(m.href);
  const { style: styleGestu, ...gest } = uchwyty(m.href);
  return (
    <button
      type="button"
      aria-current={aktywna ? "page" : undefined}
      aria-label={m.label}
      {...gest}
      className="flex flex-col items-center justify-center gap-0.5"
      style={{ ...styleGestu, ...STYL_POZYCJI, color: aktywna ? m.color : "var(--text-muted)" }}
    >
      <m.Icon size={blisko ? 22 : 20} />
      <span style={{ fontSize: 10 }}>{m.label}</span>
    </button>
  );
}

/**
 * Kotwica paska — dom, ulubione, historia.
 *
 * `opis` jest osobny od `etykiety` celowo: pod ikoną musi stać słowo mieszczące się w ~58 px, ale
 * czytnik ekranu ma usłyszeć, **co przycisk robi** („Zapisz ten widok w ulubionych"), a nie samą
 * nazwę zbioru (AC-27). Etykieta nazywa miejsce, opis nazywa czynność.
 */
function PozycjaProsta({
  Icon,
  etykieta,
  opis,
  aktywna,
  wcisnieta,
  przygaszona,
  kolor,
  wypelnienie,
  blisko,
  gest,
  naKlik,
}: {
  Icon: LucideIcon;
  etykieta: string;
  opis: string;
  aktywna?: boolean;
  wcisnieta?: boolean;
  przygaszona?: boolean;
  kolor?: string;
  wypelnienie?: boolean;
  blisko: boolean;
  gest?: UchwytyPozycji;
  naKlik?: () => void;
}) {
  const { style: styleGestu, ...uchwytyGestu } = gest ?? { style: undefined };
  const rozmiar = blisko ? 22 : 20;
  return (
    <button
      type="button"
      aria-current={aktywna ? "page" : undefined}
      aria-pressed={wcisnieta}
      aria-label={opis}
      title={opis}
      onClick={naKlik}
      {...uchwytyGestu}
      className="flex flex-col items-center justify-center gap-0.5"
      style={{
        ...(styleGestu ?? {}),
        ...STYL_POZYCJI,
        color: kolor ?? (aktywna ? "var(--text-primary)" : "var(--text-muted)"),
        // Wyszarzenie zamiast ukrycia: pozycja, która znika i wraca, zmieniałaby szerokość
        // sąsiadów w trakcie pracy — a użytkownik celuje w miejsce, nie w ikonę.
        opacity: przygaszona ? 0.4 : 1,
      }}
    >
      <Icon size={rozmiar} fill={wypelnienie ? (kolor ?? "currentColor") : "none"} />
      <span style={{ fontSize: 10 }}>{etykieta}</span>
    </button>
  );
}
