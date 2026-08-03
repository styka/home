"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  buildViewQuery,
  parseViewParams,
  rawParamsFromSearch,
  type RawParams,
  type ViewSpec,
  type ViewValues,
} from "@/lib/viewState/viewState";

export interface SetViewOptions {
  /**
   * `true` = podmień bieżący wpis w historii zamiast dokładać nowy.
   * Używaj dla pól tekstowych (szukajka) — inaczej każda literka byłaby osobnym „wstecz".
   */
  replace?: boolean;
}

/** Łatka wartości albo funkcja licząca ją z poprzedniego stanu (jak w `setState`). */
export type ViewPatch<S extends ViewSpec> =
  | Partial<ViewValues<S>>
  | ((prev: ViewValues<S>) => Partial<ViewValues<S>>);

/**
 * 043: stan widoku trzymany w adresie strony.
 *
 * Trzy decyzje implementacyjne, każda z konkretnego powodu — nie z upodobania:
 *
 *  1. **Wartość startowa przychodzi PROPSEM z serwera** (`page.tsx` czyta `searchParams`), a nie
 *     z `window.location` w pierwszym renderze. Czytanie adresu na kliencie, gdy serwer wyrenderował
 *     widok domyślny, to **rozjazd hydratacji** — a wpis z 2026-08-02 w `doświadczenia.md` opisuje,
 *     jak jeden taki rozjazd degraduje całą aplikację (React porzuca drzewo z serwera, gubi stan
 *     komponentów i rozstraja router). Przy propsie serwer i klient renderują identycznie i nie ma
 *     mignięcia widoku domyślnego.
 *  2. **Zapis przez `window.history.pushState`/`replaceState`, nie `router.push`.** Next 14
 *     integruje natywne History API z App Routerem, a `router.push` na tę samą trasę wymuszałby
 *     pobranie komponentów serwerowych przy KAŻDYM kliknięciu filtra.
 *  3. **Nie używamy `useSearchParams`.** W powłoce wymusza granicę `Suspense` (lekcja z 042,
 *     `FavoriteStarButton`), a tutaj byłoby zbędne — parametry mamy z propsa i z `popstate`.
 *
 * Cofnięcie przeglądarką obsługuje listener `popstate`, który przelicza stan z adresu (AC-6).
 */
export function useViewState<S extends ViewSpec>(
  spec: S,
  initialParams: RawParams,
): [ViewValues<S>, (patch: ViewPatch<S>, opts?: SetViewOptions) => void] {
  // `spec` bywa literałem tworzonym w ciele komponentu — trzymamy go w ref, żeby efekty nie
  // przeliczały się przy każdym renderze. Zestaw kluczy jest z definicji stały w obrębie widoku.
  const specRef = useRef(spec);
  specRef.current = spec;

  const [values, setValues] = useState<ViewValues<S>>(() => parseViewParams(spec, initialParams));

  // Lustro bieżących wartości. Zapis do historii MUSI się dziać poza funkcją aktualizującą stan:
  // React wymaga, żeby te funkcje były czyste, a w trybie ścisłym wywołuje je dwa razy — dwa
  // `pushState` na jedno kliknięcie dawałyby „wstecz", które trzeba nacisnąć dwukrotnie.
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const setView = useCallback((patch: ViewPatch<S>, opts?: SetViewOptions) => {
    const prev = valuesRef.current;
    const resolved = typeof patch === "function" ? patch(prev) : patch;
    const next = { ...prev, ...resolved } as ViewValues<S>;
    valuesRef.current = next;

    if (typeof window !== "undefined") {
      const query = buildViewQuery(specRef.current, next);
      const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
      // Bez zmiany adresu nie dotykamy historii — inaczej powtórne kliknięcie tej samej
      // zakładki dokładałoby pusty wpis, przez który „wstecz" wyglądałoby na zepsute.
      if (url !== window.location.pathname + window.location.search) {
        if (opts?.replace) window.history.replaceState(null, "", url);
        else window.history.pushState(null, "", url);
      }
    }

    setValues(next);
  }, []);

  // Przejście na INNY adres bez przemontowania komponentu (np. przełączenie listy zakupowej albo
  // projektu zadań linkiem w pasku bocznym — Next reużywa ten sam komponent trasy) zostawiało stan
  // widoku z poprzedniej strony, podczas gdy adres był już czysty. Widok pokazywał wtedy filtr,
  // którego w adresie nie było — a zapis do ulubionych brał adres, więc gubił ten filtr.
  // Po zmianie ścieżki przeliczamy stan z adresu, dzięki czemu widok i adres zawsze się zgadzają.
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);
  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    const restored = parseViewParams(specRef.current, rawParamsFromSearch(window.location.search));
    valuesRef.current = restored;
    setValues(restored);
  }, [pathname]);

  useEffect(() => {
    function onPopState() {
      const restored = parseViewParams(specRef.current, rawParamsFromSearch(window.location.search));
      valuesRef.current = restored;
      setValues(restored);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return [values, setView];
}
