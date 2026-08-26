"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * 036: przypięcie okna pełnoekranowego do **widocznego** obszaru strony (`window.visualViewport`).
 *
 * Po co: jednostki `vh` (a na iOS także `dvh`) liczą się z *layout viewport*, który przy wysunięciu
 * klawiatury ekranowej **się nie kurczy**. Okno na `85vh` zostaje więc tej samej wysokości, a system
 * przewija widoczny obszar, żeby odsłonić pole tekstowe — stąd „okno ucieka w górę".
 * `visualViewport` mówi, ile miejsca REALNIE widać, więc przypięte do niego okno po prostu maleje,
 * oddając przestrzeń klawiaturze.
 */

/**
 * Czy jesteśmy na wąskim ekranie (breakpoint `md` z Tailwinda = 768 px). Potrzebne, bo wysokość i
 * pozycję okna asystenta ustawiamy INLINE — sama klasa `md:` by tu nie wystarczyła.
 */
export function useIsNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const read = () => setNarrow(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  return narrow;
}

/**
 * 106: czy ekran jest SZEROKI (>= 1024 px, czyli Tailwindowe `lg`). Bliźniak `useIsNarrowScreen`,
 * po ten sam wzorzec `matchMedia` + nasłuch zmiany.
 *
 * Start od `false` jest celowy: na serwerze nie ma czego zmierzyć, a fałszywy start znaczy
 * „zachowaj się jak na wąskim ekranie" — czyli tak, jak aplikacja zachowywała się dotąd. Odwrotny
 * domyślny pokazywałby na telefonie układ desktopowy przez jedną klatkę po hydratacji.
 */
export function useIsWideScreen(): boolean {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const read = () => setWide(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  return wide;
}

/** Nazwy zmiennych CSS, przez które hook podaje geometrię. Wołający używa ich w swoim stylu. */
export const VV_TOP_VAR = "--vv-top";
export const VV_HEIGHT_VAR = "--vv-height";

/**
 * Przypina element (`position: fixed`) do WIDOCZNEGO obszaru — pisząc geometrię PROSTO do elementu,
 * synchronicznie w obsłudze zdarzenia `visualViewport`.
 *
 * **`top` MUSI być kompensowany przez `offsetTop`** — sprawdzone dwoma nagraniami ekranu, w obie
 * strony. iOS przy otwartej klawiaturze potrafi ZOSTAWIĆ widoczny obszar przesunięty (mierzone
 * ~360 px) na stałe, nie tylko na czas animacji. Element `fixed` jest pozycjonowany względem UKŁADU
 * strony, więc bez kompensacji renderuje się o te 360 px za wysoko: z okna widać wtedy tylko pole
 * tekstowe, a pod nim całą stronę i dolny pasek zakładek.
 *
 * Próba usunięcia kompensacji („skoro przeglądarka i tak trzyma element przy widocznym obszarze")
 * była błędem i pogorszyła sprawę — trzyma go tylko czasami. Zostaje.
 *
 * Osobną sprawą jest SYNCHRONIZACJA w trakcie animacji klawiatury: iOS nie wysyła zdarzeń
 * `visualViewport` co klatkę, więc sama obsługa zdarzeń zostawia środek animacji z geometrią sprzed
 * ruchu. Dlatego po każdym zdarzeniu (oraz po `focusin`/`focusout` w oknie) domykamy ruch krótką,
 * ograniczoną w czasie pętlą `requestAnimationFrame` — szczegóły przy `FOLLOW_MS` niżej.
 *
 * **Dlaczego zmienne CSS, a nie `style.top` / `style.height`.** Gdyby hook pisał te właściwości
 * wprost, każdy kolejny render Reacta nadpisywałby świeżą geometrię wartością z propsów (albo — gdyby
 * ich w propsach nie było — element nie miałby ich wcale przy pierwszym malowaniu). Zmienna CSS
 * rozdziela role: React deklaruje `top: var(--vv-top, 0px)` raz i na zawsze (stały napis, więc nie ma
 * czego diffować), a hook zmienia samą wartość zmiennej. Domyślne wartości w `var()` obsługują
 * pierwszą klatkę, przed pierwszym efektem.
 *
 * Wysokość elementu zmienia się razem z widocznym obszarem, więc miejsce oddaje wyłącznie ten jego
 * potomek, który jest elastyczny (u nas: przewijana lista wiadomości `flex-1 overflow-y-auto`).
 *
 * Zwraca `true`, gdy przypięcie jest aktywne (przeglądarka udostępnia `visualViewport`) — wyliczane
 * SYNCHRONICZNIE, żeby nie było renderu „przed przypięciem" z innym układem.
 */
export function usePinToVisualViewport(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  /**
   * Wołane SYNCHRONICZNIE po każdej zmianie geometrii — do domknięcia układu wewnątrz okna
   * (u nas: utrzymanie dołu rozmowy, gdy obszar wiadomości się zmniejszy). Ta sama tura zdarzenia,
   * więc użytkownik nie widzi stanu przejściowego.
   */
  onGeometryChange?: () => void
): boolean {
  // Wsparcie dla API to cecha przeglądarki, nie stan — trzymamy je w ref, żeby wynik był znany już
  // przy pierwszym renderze (stan wymusiłby dodatkowy render i mignięcie starym układem).
  const supported = useRef<boolean | null>(null);
  if (supported.current === null && typeof window !== "undefined") {
    supported.current = !!window.visualViewport;
  }
  const pinned = enabled && supported.current === true;

  // Najnowsza wersja wywołania zwrotnego, bez restartu nasłuchu przy każdym renderze.
  const onChangeRef = useRef(onGeometryChange);
  onChangeRef.current = onGeometryChange;

  useEffect(() => {
    if (!pinned) return;
    const vv = window.visualViewport;
    // Element bierzemy RAZ, na wejściu w efekt: przypięcie włącza się dopiero po wyrenderowaniu okna,
    // a ten sam węzeł żyje przez cały czas jego otwarcia. Dzięki temu sprzątanie działa na tym
    // elemencie, który faktycznie stylowaliśmy.
    const el = ref.current;
    if (!vv || !el) return;

    // Ostatnio ZAPISANE wartości — żeby nie pisać stylu w klatkach, w których nic się nie zmieniło
    // (pętla niżej chodzi przez całą animację, a przy danych ze skokiem to niemal wszystkie klatki).
    let lastTop = Number.NaN;
    let lastHeight = Number.NaN;

    /** Zwraca `true`, gdy geometria faktycznie się zmieniła (a nie tylko była sprawdzana). */
    const apply = (): boolean => {
      // Bez zaokrąglania: `visualViewport` zwraca wartości podpikselowe, a obcinanie zostawiałoby
      // pod oknem szparę na tle strony.
      if (vv.offsetTop === lastTop && vv.height === lastHeight) return false;
      lastTop = vv.offsetTop;
      lastHeight = vv.height;
      el.style.setProperty(VV_TOP_VAR, `${vv.offsetTop}px`);
      el.style.setProperty(VV_HEIGHT_VAR, `${vv.height}px`);
      return true;
    };

    // Nadążanie za ANIMACJĄ klawiatury (`rAF`), a nie tylko za jej krańcami.
    //
    // UWAGA na oczekiwania: pomiar z urządzenia (sonda, `kroki 1`) pokazał, że na iOS ta pętla sama
    // z siebie NIE usuwa przeskoku — nie ma czego dogonić, bo wartości pośrednich po prostu nie ma.
    // Za płynność odpowiada przejście CSS ustawiane niżej. Pętla zostaje z dwóch innych powodów:
    // utrzymuje dół rozmowy przez cały czas trwania tego przejścia, a na przeglądarkach, które
    // raportują ruch stopniowo (Android, przyszłe wersje iOS), pozwala nadążyć za każdym krokiem.
    //
    // Pętla jest OGRANICZONA W CZASIE: startuje na zdarzeniu i chodzi jeszcze przez `FOLLOW_MS`,
    // czyli dłużej niż trwa przejście CSS. Stała pętla `rAF` przez cały czas otwarcia okna byłaby
    // podatkiem na baterię za nic — poza animacją nie ma czego nadążać.
    const FOLLOW_MS = 500;
    let raf = 0;
    let followUntil = 0;

    const followFrame = () => {
      // `onGeometryChange` (utrzymanie dołu rozmowy) wołamy TYLKO przy realnej zmianie geometrii oraz
      // RAZ po zakończeniu przejścia — nie co klatkę.
      //
      // Wersja „co klatkę" była błędem: przez 280 ms trwania przejścia wymuszała ~17 przewinięć listy
      // do dołu, podczas gdy pudełko dopiero się kurczyło. Treść przeskakiwała w innym rytmie niż
      // ramka okna i właśnie to widać było jako nierówne rozciąganie. Jedno przewinięcie na starcie
      // (skok geometrii) i jedno na końcu (gdy wysokość już się ustaliła) daje ten sam efekt bez
      // szarpania w środku.
      if (apply()) onChangeRef.current?.();
      if (performance.now() < followUntil) {
        raf = window.requestAnimationFrame(followFrame);
      } else {
        raf = 0;
        onChangeRef.current?.(); // domknięcie: wysokość już docelowa, dosuń rozmowę do dołu
      }
    };

    const startFollowing = () => {
      followUntil = performance.now() + FOLLOW_MS;
      if (!raf) raf = window.requestAnimationFrame(followFrame);
    };

    const onViewportEvent = () => {
      apply();          // natychmiast, w tej samej turze zdarzenia
      startFollowing(); // i dalej co klatkę, przez resztę animacji
    };

    apply();
    onChangeRef.current?.();

    // WYGŁADZENIE PRZEJŚCIA — jedyne, co zostało po zmierzeniu źródła danych.
    //
    // Sonda diagnostyczna (nakładka `ViewportProbe`, usunięta po zamknięciu sprawy — jest w historii
    // repozytorium, gdyby trzeba było powtórzyć pomiar) pokazała: `kroki 1`, `maxSkok 291`. iOS zmienia
    // `offsetTop` DOKŁADNIE RAZ, od razu o pełne 291 px, i nie podaje żadnych wartości pośrednich —
    // przez cały czas, gdy klawiatura płynnie wyjeżdża. Nasze okno dostaje więc końcową geometrię
    // w jednej klatce i teleportuje się do niej, podczas gdy klawiatura jeszcze jedzie. To właśnie
    // widać jako przeskok, i dlatego NIE pomaga ani częstsze próbkowanie (nie ma czego próbkować),
    // ani pętla `rAF` sama w sobie.
    //
    // Skoro brakujących klatek nie dostaniemy, musimy je dorysować sami: przejście CSS zamienia
    // jeden skok w płynny ruch. Czas dobrany do animacji klawiatury iOS (~0,3 s), krzywa
    // wyhamowująca, bo tak zachowuje się klawiatura.
    //
    // ANIMUJEMY WYŁĄCZNIE `height`. `top` MUSI zmieniać się natychmiast i to jest wniosek z pomiaru,
    // a nie ostrożność: gdy animowany był również `top`, dopasowanie klatek z nagrania pokazało
    // wahadło o amplitudzie 80–130 px trwające ~14 klatek i sumujące się do ZERA (treść wracała
    // dokładnie tam, gdzie zaczęła). Powód: przeglądarka SAMA przesuwa element `position: fixed`,
    // gdy jedzie widoczny obszar. Nasza 280-milisekundowa animacja `top` ciągnęła go równolegle w tę
    // samą stronę, więc obie korekty się sumowały i nawzajem znosiły — jeden skok zamienił się w
    // dłuższe dzwonienie. Przy natychmiastowym `top` starcie trwa jedną klatkę, tak jak wcześniej.
    //
    // `height` jest wolne od tego konfliktu: przeglądarka nie zmienia wysokości elementu za nas,
    // a treść okna jest wyrównana do góry, więc animacja wysokości nie przesuwa nagłówka ani listy —
    // oddaje tylko miejsce klawiaturze, płynnie prowadząc dolną krawędź z kompozytorem.
    //
    // Włączane DOPIERO PO pierwszym zapisie geometrii (w kolejnej klatce): inaczej samo otwarcie
    // okna byłoby animowane od wartości domyślnych i widać by było, jak okno „dojeżdża" do ekranu.
    const transitionRaf = window.requestAnimationFrame(() => {
      el.style.transition = "height 280ms cubic-bezier(0.22, 0.61, 0.36, 1)";
    });

    vv.addEventListener("resize", onViewportEvent);
    vv.addEventListener("scroll", onViewportEvent);
    // Klawiatura zaczyna wyjeżdżać na `focusin`, a chować się na `focusout` — czasem ZANIM przyjdzie
    // pierwsze zdarzenie `visualViewport`. Bez tego pierwsze klatki ruchu byłyby nieobsłużone.
    el.addEventListener("focusin", startFollowing);
    el.addEventListener("focusout", startFollowing);

    return () => {
      vv.removeEventListener("resize", onViewportEvent);
      vv.removeEventListener("scroll", onViewportEvent);
      el.removeEventListener("focusin", startFollowing);
      el.removeEventListener("focusout", startFollowing);
      if (raf) window.cancelAnimationFrame(raf);
      window.cancelAnimationFrame(transitionRaf);
      // Wyjście z trybu pełnoekranowego (np. obrót na szeroki ekran) — oddaj sterowanie CSS-owi,
      // inaczej zostałyby wpisane na sztywno piksele z telefonu.
      el.style.removeProperty("transition");
      el.style.removeProperty(VV_TOP_VAR);
      el.style.removeProperty(VV_HEIGHT_VAR);
    };
  }, [pinned, ref]);

  return pinned;
}
