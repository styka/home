"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import type { Reka } from "@/lib/modules";

/**
 * 100: nawigacja jednym gestem — przytrzymaj, przeciągnij, puść.
 *
 * Zgłoszenie właściciela: „by pasek z ikonami ten na dole ekranu był inteligentny i nowatorski tak
 * by najważniejsze rzeczy dało się wybrać prawym kciukiem […] przez wciśnięcie i przytrzymanie to
 * wtedy pojawią się podpowiedzi nawigacji i można przeciągnąć palec/kursor na podpowiedź a potem
 * pojawia sie kolejne podpowiedzi".
 *
 * Trzy decyzje, które warto znać, zanim się tu coś zmieni:
 *
 * 1. **Poziom 1 wachlarza jest ZAWSZE ten sam** — pełna lista dostępnych modułów — niezależnie od
 *    tego, którą pozycję paska przytrzymano. To nie jest uproszczenie, tylko sens gestu: jedna
 *    czynność ma dawać jeden przewidywalny wynik. Wachlarz zależny od punktu startu zmusiłby do
 *    pamiętania, co pod którą ikoną się kryje — czyli odtworzyłby wadę menu ⋮, którą ten sam
 *    przebieg naprawia w Wiadomościach.
 *
 * 2. **Nic nie dopisuje się do żadnej równoległej listy modułów** (C-36). Poziom 1 dostajemy
 *    parametrem z `resolveMenu` (już po uprawnieniach), poziom 2 — z zapisanych widoków
 *    użytkownika. Łańcuch `if (id === "shopping")` w `MobileModuleSubNav` zostaje nietknięty:
 *    to relikt sprzed 048/049 i rozbudowa go byłaby regresją.
 *
 * 3. **Wskaźnika NIE przechwytujemy na `pointerdown`, tylko dopiero przy otwarciu wachlarza.**
 *    Przechwycenie od razu zabrałoby przeglądarce przewijanie — a palec startujący na pozycji
 *    nawigacji musi móc po prostu przewinąć listę. Do czasu otwarcia gest jest „przezroczysty":
 *    ruch powyżej progu albo `pointercancel` od przeglądarki kasuje odliczanie.
 */

/** Ile trzeba przytrzymać, żeby wachlarz się otworzył. Krócej i zwykłe tapnięcie by go wywoływało. */
const PROG_PRZYTRZYMANIA_MS = 350;
/** Ruch powyżej tylu pikseli PRZED otwarciem = użytkownik przewija, nie nawiguje. */
const PROG_RUCHU_PX = 12;
/** Zatrzymanie na podpowiedzi na tyle milisekund otwiera jej drugi poziom. */
const PROG_ZATRZYMANIA_MS = 400;
/** Promień pierwszego pierścienia podpowiedzi. */
const PROMIEN_PX = 120;
/** Promień drugiego pierścienia (nadmiar pozycji ponad `MAKS_W_PIERSCIENIU`). */
const PROMIEN_2_PX = 196;
const MAKS_W_PIERSCIENIU = 8;
/** Jak blisko środka podpowiedzi musi być palec, żeby ją podświetlić. */
const PROG_TRAFIENIA_PX = 56;

export interface PozycjaWachlarza {
  id: string;
  etykieta: string;
  href: string;
  Icon?: LucideIcon;
  color?: string;
}

interface Podpowiedz extends PozycjaWachlarza {
  x: number;
  y: number;
  /** Czy pozycja ma drugi poziom (zapisane widoki tego modułu). */
  maGlebiej: boolean;
}

interface UchwytyGestu {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onContextMenu: (e: { preventDefault: () => void }) => void;
  style: { touchAction: "none"; userSelect: "none"; WebkitUserSelect: "none" };
}

/**
 * 103: ŹRÓDŁO wachlarza — czym jest jego pierwszy poziom i co robi krótkie tapnięcie.
 *
 * Do run 100 pierwszy poziom był zawsze tą samą listą modułów, bo wszystkie wyzwalacze gestu
 * BYŁY modułami. Od 103 pasek ma także kotwice, które modułami nie są (gwiazdka, historia),
 * i one potrzebują własnej treści.
 *
 * **Reguła z run 100 zostaje nienaruszona:** przytrzymanie pozycji MODUŁU nadal daje tę samą listę
 * niezależnie od tego, którą pozycję przytrzymano. Źródło jest sposobem na dołożenie dwóch nowych
 * rodzajów pozycji, a nie furtką do wachlarza zależnego od punktu startu — ten zmuszałby do
 * pamiętania, co pod czym się kryje, czyli odtwarzałby wadę menu ⋮ naprawioną w Wiadomościach.
 */
export interface ZrodloWachlarza {
  /** Poziom 1 dla tej pozycji. Bez tego pola: moduły (zachowanie domyślne). */
  pozycje?: () => PozycjaWachlarza[];
  /** Co robi KRÓTKIE tapnięcie. Bez tego pola: nawigacja pod `href`. */
  naTap?: () => void;
}

interface KontekstWachlarza {
  /**
   * Dla elementu, który **sam nie nawiguje** (przycisk paska kciuka): krótkie tapnięcie kieruje
   * pod `href` imperatywnie. Drugi argument pozwala pozycji podstawić własny poziom 1 i własne
   * tapnięcie; jego BRAK to zachowanie sprzed 103, dlatego jest opcjonalny — wszystkie dzisiejsze
   * wywołania zostają bez zmiany.
   */
  uchwyty: (href: string, zrodlo?: ZrodloWachlarza) => UchwytyGestu;
  /**
   * Dla elementu, który **nawiguje sam** (`<Link>` w nawigacji bocznej): krótkie kliknięcie zostaje
   * odnośnikowi, a gest dokłada wyłącznie wachlarz. `onClick` blokuje kliknięcie, które przyszłoby
   * po wyborze z wachlarza — bez tego przeglądarka poszłaby jeszcze pod adres samego odnośnika,
   * czyli nawigacja wykonałaby się dwa razy, w dwa różne miejsca.
   */
  uchwytyLinku: () => UchwytyGestu & { onClick: (e: { preventDefault: () => void }) => void };
  otwarty: boolean;
}

const Kontekst = createContext<KontekstWachlarza | null>(null);

const PUSTE_UCHWYTY: UchwytyGestu = {
  onPointerDown: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onPointerCancel: () => {},
  onContextMenu: () => {},
  style: { touchAction: "none", userSelect: "none", WebkitUserSelect: "none" },
};

/**
 * Poza dostawcą gest po prostu nie istnieje, a element zachowuje się jak zwykły odnośnik.
 * Degradacja zamiast wyjątku — komponent użyty w izolacji (galeria, test) ma działać.
 */
export function useWachlarz(): KontekstWachlarza {
  return (
    useContext(Kontekst) ?? {
      uchwyty: () => PUSTE_UCHWYTY,
      uchwytyLinku: () => ({ ...PUSTE_UCHWYTY, onClick: () => {} }),
      otwarty: false,
    }
  );
}

/** Rozkłada pozycje na łuku wychylonym w stronę dominującej ręki, przycinając do okna. */
function rozlozNaLuku(
  pozycje: PozycjaWachlarza[],
  srodekX: number,
  srodekY: number,
  reka: Reka,
  maGlebiej: (p: PozycjaWachlarza) => boolean,
): Podpowiedz[] {
  // Kciuk prawej dłoni zatacza łuk w lewo-w-górę; lewej — w prawo-w-górę. Kąty w stopniach,
  // 90° = prosto w górę, 180° = w lewo. Zakres celowo nie sięga poziomu: podpowiedź tuż przy
  // krawędzi ekranu jest poza zasięgiem tego samego kciuka, który ma po nią sięgnąć.
  const [od, doK] = reka === "left" ? [-8, 112] : [68, 188];
  const pierwszy = pozycje.slice(0, MAKS_W_PIERSCIENIU);
  const drugi = pozycje.slice(MAKS_W_PIERSCIENIU);

  const naPierscieniu = (grupa: PozycjaWachlarza[], promien: number): Podpowiedz[] =>
    grupa.map((p, i) => {
      const t = grupa.length === 1 ? 0.5 : i / (grupa.length - 1);
      const kat = ((od + (doK - od) * t) * Math.PI) / 180;
      const x = srodekX + promien * Math.cos(kat);
      const y = srodekY - promien * Math.sin(kat);
      return {
        ...p,
        // Przycięcie do okna — bez niego skrajna podpowiedź potrafi wyjść poza ekran na wąskim
        // telefonie, a wtedy jest nie do trafienia mimo że widać jej połowę.
        x: Math.min(Math.max(x, 44), (typeof window === "undefined" ? 360 : window.innerWidth) - 44),
        y: Math.min(Math.max(y, 60), (typeof window === "undefined" ? 640 : window.innerHeight) - 60),
        maGlebiej: maGlebiej(p),
      };
    });

  return [...naPierscieniu(pierwszy, PROMIEN_PX), ...naPierscieniu(drugi, PROMIEN_2_PX)];
}

export function WachlarzNawigacji({
  pozycje,
  glebiej,
  ustawieniaPaska,
  reka,
  children,
}: {
  /** Poziom 1 — moduły dostępne dla roli (przekazane parametrem: powłoka wie, wachlarz nie). */
  pozycje: PozycjaWachlarza[];
  /**
   * Poziom 2 — dla danego modułu: jego szybkie cele scalone z zapisanymi widokami użytkownika
   * (103; do 100 były to wyłącznie zapisane widoki, więc u konta, które nic nie zapisało, drugiego
   * poziomu po prostu nie było). Pusta lista = pozycja jest liściem.
   */
  glebiej: (idModulu: string) => PozycjaWachlarza[];
  /**
   * 103: STAŁA, OSTATNIA pozycja poziomu 1 — wejście do ustawień samego paska.
   *
   * Właściciel prosił o „ikonę do ustawień tego dolnego paska". Nie dostaje własnego miejsca
   * w pasku świadomie: pasek ma pięć miejsc (arytmetyka 360 px w `lib/modules`), a rzecz otwierana
   * raz na miesiąc nie może zabierać slotu rzeczy dotykanej kilkadziesiąt razy dziennie. Wejście
   * istnieje i jest w tym samym geście, którego ta zmiana uczy.
   */
  ustawieniaPaska: PozycjaWachlarza;
  reka: Reka;
  children: ReactNode;
}) {
  const t = useTranslations("components.shell.WachlarzNawigacji");
  const router = useRouter();
  const [otwarty, setOtwarty] = useState(false);
  const [srodek, setSrodek] = useState({ x: 0, y: 0 });
  const [poziom2, setPoziom2] = useState<{ id: string; pozycje: PozycjaWachlarza[] } | null>(null);
  const [aktywna, setAktywna] = useState<string | null>(null);
  /** Źródło pozycji, która otworzyła bieżący wachlarz — decyduje o treści poziomu 1. */
  const [zrodloOtwarte, setZrodloOtwarte] = useState<ZrodloWachlarza | null>(null);

  const start = useRef<{ x: number; y: number; href: string } | null>(null);
  const licznikOtwarcia = useRef<ReturnType<typeof setTimeout> | null>(null);
  const licznikZatrzymania = useRef<ReturnType<typeof setTimeout> | null>(null);
  const przechwycony = useRef<{ el: Element; id: number } | null>(null);
  /** Ustawiane po wyborze z wachlarza — zjada kliknięcie, które przeglądarka wyśle po puszczeniu. */
  const zjedzoneKlikniecie = useRef(false);

  const zamknij = useCallback(() => {
    if (licznikOtwarcia.current) clearTimeout(licznikOtwarcia.current);
    if (licznikZatrzymania.current) clearTimeout(licznikZatrzymania.current);
    licznikOtwarcia.current = null;
    licznikZatrzymania.current = null;
    if (przechwycony.current) {
      try {
        (przechwycony.current.el as Element & { releasePointerCapture?: (id: number) => void })
          .releasePointerCapture?.(przechwycony.current.id);
      } catch {
        // Wskaźnik mógł już zniknąć (palec puszczony poza oknem) — to nie jest błąd.
      }
      przechwycony.current = null;
    }
    start.current = null;
    setOtwarty(false);
    setPoziom2(null);
    setAktywna(null);
    setZrodloOtwarte(null);
  }, []);

  useEffect(() => {
    if (!otwarty) return;
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") zamknij();
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [otwarty, zamknij]);

  // Sprzątanie odliczeń przy odmontowaniu — inaczej timer odpalony po zniknięciu powłoki
  // ustawiałby stan na komponencie, którego już nie ma.
  useEffect(() => () => zamknij(), [zamknij]);

  const widoczne = useMemo<Podpowiedz[]>(() => {
    if (!otwarty) return [];
    if (poziom2) {
      // Drugi poziom jest liściem — jego pozycje nie mają już nic głębiej.
      return rozlozNaLuku(poziom2.pozycje, srodek.x, srodek.y, reka, () => false);
    }
    /**
     * Poziom 1: albo własne pozycje kotwicy (ulubione, historia), albo moduły. „Ustawienia paska"
     * doklejamy WYŁĄCZNIE do listy modułów — w wachlarzu ulubionych czy historii byłyby obcym
     * ciałem, a wejście do ustawień ma jedno miejsce, nie trzy.
     */
    const wlasne = zrodloOtwarte?.pozycje?.();
    const lista = wlasne ?? [...pozycje, ustawieniaPaska];
    // Głębiej schodzą tylko pozycje modułowe; przy własnym źródle poziomu 2 nie ma.
    return rozlozNaLuku(lista, srodek.x, srodek.y, reka, (p) => !wlasne && glebiej(p.id).length > 0);
  }, [otwarty, poziom2, pozycje, ustawieniaPaska, zrodloOtwarte, srodek, reka, glebiej]);

  const najblizsza = useCallback(
    (x: number, y: number): Podpowiedz | null => {
      let wynik: Podpowiedz | null = null;
      let naj = PROG_TRAFIENIA_PX;
      for (const p of widoczne) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < naj) {
          naj = d;
          wynik = p;
        }
      }
      return wynik;
    },
    [widoczne],
  );

  /**
   * Wspólny rdzeń gestu. `wlasnaNawigacja` rozstrzyga, co robi KRÓTKIE tapnięcie:
   * przy przycisku (pasek kciuka) kierujemy sami, przy `<Link>` zostawiamy to odnośnikowi.
   */
  const zbudujUchwyty = useCallback(
    (href: string, wlasnaNawigacja: boolean, zrodlo?: ZrodloWachlarza): UchwytyGestu => ({
      onPointerDown: (e: ReactPointerEvent) => {
        // Tylko przycisk główny / dotyk / pióro — prawy przycisk myszy ma swoje znaczenie.
        if (e.button !== 0) return;
        const el = e.currentTarget;
        const id = e.pointerId;
        const x = e.clientX;
        const y = e.clientY;
        start.current = { x, y, href };
        licznikOtwarcia.current = setTimeout(() => {
          // Przechwycenie DOPIERO tutaj: do tej chwili przeglądarka mogła swobodnie przewijać.
          try {
            (el as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(id);
            przechwycony.current = { el, id };
          } catch {
            // Wskaźnik już nieaktywny — wachlarz i tak otwieramy, zamknie go `pointercancel`.
          }
          setSrodek({ x, y });
          setZrodloOtwarte(zrodlo ?? null);
          setOtwarty(true);
        }, PROG_PRZYTRZYMANIA_MS);
      },

      onPointerMove: (e: ReactPointerEvent) => {
        if (!start.current) return;
        if (!otwarty) {
          const d = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
          if (d > PROG_RUCHU_PX && licznikOtwarcia.current) {
            clearTimeout(licznikOtwarcia.current);
            licznikOtwarcia.current = null;
            start.current = null;
          }
          return;
        }
        const cel = najblizsza(e.clientX, e.clientY);
        const idCelu = cel?.id ?? null;
        if (idCelu === aktywna) return;
        setAktywna(idCelu);
        if (licznikZatrzymania.current) clearTimeout(licznikZatrzymania.current);
        licznikZatrzymania.current = null;
        // Drugi poziom otwiera się po ZATRZYMANIU na podpowiedzi, bez puszczania palca.
        if (cel?.maGlebiej) {
          const dalsze = glebiej(cel.id);
          licznikZatrzymania.current = setTimeout(() => {
            setPoziom2({ id: cel.id, pozycje: dalsze });
            setSrodek({ x: cel.x, y: cel.y });
            setAktywna(null);
          }, PROG_ZATRZYMANIA_MS);
        }
      },

      onPointerUp: (e: ReactPointerEvent) => {
        const byloOtwarte = otwarty;
        const wlasnyHref = start.current?.href ?? href;
        const cel = byloOtwarte ? najblizsza(e.clientX, e.clientY) : null;
        zamknij();
        if (byloOtwarte) {
          // Wybór z wachlarza unieważnia kliknięcie, które przeglądarka wyśle zaraz potem —
          // inaczej `<Link>` dołożyłby drugą nawigację, pod swój własny adres.
          zjedzoneKlikniecie.current = true;
          // Puszczenie poza podpowiedzią zamyka bez nawigacji — to jest wyjście z gestu.
          if (cel) router.push(cel.href);
          return;
        }
        /**
         * Krótkie tapnięcie: przycisk paska kieruje IMPERATYWNIE, bo nie jest odnośnikiem —
         * i celowo nim nie jest. Przy przechwyconym wskaźniku zdarzenie kliknięcia trafia gdzie
         * indziej niż palec, więc jedna ścieżka nawigacji dla obu wariantów gestu jest tańsza
         * niż dwie, które musiałyby się zgadzać co do piksela.
         */
        if (!wlasnaNawigacja) return;
        // 103: kotwica może mieć własną czynność krótkiego tapnięcia (gwiazdka zapisuje widok,
        // historia cofa o krok). Bez niej — nawigacja, jak dotąd.
        if (zrodlo?.naTap) zrodlo.naTap();
        else router.push(wlasnyHref);
      },

      onPointerCancel: () => zamknij(),
      onContextMenu: (e: { preventDefault: () => void }) => {
        // Bez tego Android pokazuje własne menu na przytrzymaniu i zjada gest.
        e.preventDefault();
      },
      style: { touchAction: "none" as const, userSelect: "none" as const, WebkitUserSelect: "none" as const },
    }),
    [otwarty, aktywna, najblizsza, glebiej, router, zamknij],
  );

  const uchwyty = useCallback(
    (href: string, zrodlo?: ZrodloWachlarza) => zbudujUchwyty(href, true, zrodlo),
    [zbudujUchwyty],
  );

  const uchwytyLinku = useCallback(
    () => ({
      ...zbudujUchwyty("", false),
      onClick: (e: { preventDefault: () => void }) => {
        if (zjedzoneKlikniecie.current) {
          zjedzoneKlikniecie.current = false;
          e.preventDefault();
        }
      },
    }),
    [zbudujUchwyty],
  );

  const wartosc = useMemo<KontekstWachlarza>(() => ({ uchwyty, uchwytyLinku, otwarty }), [uchwyty, uchwytyLinku, otwarty]);

  return (
    <Kontekst.Provider value={wartosc}>
      {children}
      {otwarty && typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("nawigacjaGestem")}
            /* Warstwa 9994 — tuż pod `AnchoredLayer` (9995) i grubo pod trybem wskazywania
               elementu (9998/9999), zgodnie z ustaloną drabinką warstw powłoki. */
            style={{ position: "fixed", inset: 0, zIndex: 9994, pointerEvents: "none" }}
          >
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
            {widoczne.map((p) => {
              const wybrana = p.id === aktywna;
              return (
                <div
                  key={p.id}
                  className="wachlarz-podpowiedz"
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    transform: `translate(-50%, -50%) scale(${wybrana ? 1.15 : 1})`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: wybrana ? "var(--accent-blue)" : "var(--bg-elevated)",
                      color: wybrana ? "var(--on-accent)" : (p.color ?? "var(--text-secondary)"),
                      border: `1px solid ${wybrana ? "var(--accent-blue)" : "var(--border)"}`,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                    }}
                  >
                    {p.Icon ? <p.Icon size={22} /> : <span style={{ fontSize: 16 }}>{p.etykieta.slice(0, 1)}</span>}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      maxWidth: 84,
                      textAlign: "center",
                      color: wybrana ? "var(--text-primary)" : "var(--text-secondary)",
                      background: "var(--bg-base)",
                      borderRadius: 4,
                      padding: "1px 4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.etykieta}
                  </span>
                </div>
              );
            })}
            {/* Animacja jest OZDOBĄ gestu, nigdy jego warunkiem — przy ograniczeniu ruchu
                podpowiedzi po prostu się pojawiają, a gest działa identycznie. */}
            <style>{`
              .wachlarz-podpowiedz { transition: transform 120ms ease-out; }
              @media (prefers-reduced-motion: reduce) {
                .wachlarz-podpowiedz { transition: none; }
              }
            `}</style>
          </div>,
          document.body,
        )}
    </Kontekst.Provider>
  );
}
