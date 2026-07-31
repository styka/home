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

    // Ostatnio ZAPISANE wartości — żeby nie pisać stylu i nie wołać `onGeometryChange` 60 razy na
    // sekundę, gdy nic się nie rusza (pętla niżej chodzi przez całą animację, także w jej ciszy).
    let lastTop = Number.NaN;
    let lastHeight = Number.NaN;

    const apply = () => {
      // Bez zaokrąglania: `visualViewport` zwraca wartości podpikselowe, a obcinanie zostawiałoby
      // pod oknem szparę na tle strony.
      if (vv.offsetTop === lastTop && vv.height === lastHeight) return;
      lastTop = vv.offsetTop;
      lastHeight = vv.height;
      el.style.setProperty(VV_TOP_VAR, `${vv.offsetTop}px`);
      el.style.setProperty(VV_HEIGHT_VAR, `${vv.height}px`);
      onChangeRef.current?.();
    };

    // Nadążanie za ANIMACJĄ klawiatury (`rAF`), a nie tylko za jej krańcami.
    //
    // iOS nie wysyła zdarzeń `visualViewport` co klatkę — dostajemy je na początku i na końcu ruchu.
    // Korekta wpięta wyłącznie w zdarzenia zostawia więc cały środek animacji z geometrią sprzed
    // ruchu, i dokładnie to widać jako drgnięcie nagłówka. (Zmierzyliśmy to już wcześniej sondą
    // `ViewportProbe`, która właśnie dlatego czyta w `rAF` — ale wniosek nie trafił do samej korekty.)
    //
    // Pętla jest OGRANICZONA W CZASIE: startuje na zdarzeniu i chodzi jeszcze przez `FOLLOW_MS`,
    // czyli tyle, ile trwa animacja klawiatury na iOS z zapasem. Stała pętla `rAF` przez cały czas
    // otwarcia okna byłaby podatkiem na baterię za nic — poza animacją nie ma czego nadążać.
    const FOLLOW_MS = 500;
    let raf = 0;
    let followUntil = 0;

    const followFrame = () => {
      apply();
      if (performance.now() < followUntil) {
        raf = window.requestAnimationFrame(followFrame);
      } else {
        raf = 0;
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
      // Wyjście z trybu pełnoekranowego (np. obrót na szeroki ekran) — oddaj sterowanie CSS-owi,
      // inaczej zostałyby wpisane na sztywno piksele z telefonu.
      el.style.removeProperty(VV_TOP_VAR);
      el.style.removeProperty(VV_HEIGHT_VAR);
    };
  }, [pinned, ref]);

  return pinned;
}
