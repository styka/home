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
 * **Dlaczego nie przez stan Reacta i `requestAnimationFrame`.** iOS przy wysuwaniu klawiatury
 * przesuwa widoczny obszar w górę względem układu strony, a element `fixed` jest pozycjonowany
 * względem UKŁADU — więc na moment „wyjeżdża" nad ekran. Korekta musi trafić do stylu w tym samym
 * zdarzeniu, które o przesunięciu informuje. Przez stan Reacta (albo przez `rAF`) trafiała klatkę
 * PÓŹNIEJ i użytkownik widział przeskok: okno skakało w górę i dopiero potem wracało na miejsce.
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

    const apply = () => {
      // Bez zaokrąglania: `visualViewport` zwraca wartości podpikselowe, a obcinanie zostawiałoby
      // pod oknem szparę na tle strony.
      el.style.setProperty(VV_TOP_VAR, `${vv.offsetTop}px`);
      el.style.setProperty(VV_HEIGHT_VAR, `${vv.height}px`);
      onChangeRef.current?.();
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      // Wyjście z trybu pełnoekranowego (np. obrót na szeroki ekran) — oddaj sterowanie CSS-owi,
      // inaczej zostałyby wpisane na sztywno piksele z telefonu.
      el.style.removeProperty(VV_TOP_VAR);
      el.style.removeProperty(VV_HEIGHT_VAR);
    };
  }, [pinned, ref]);

  return pinned;
}
