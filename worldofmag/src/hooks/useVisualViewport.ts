"use client";

import { useEffect, useState } from "react";

/**
 * 036: rozmiar i przesunięcie **widocznego** obszaru strony (`window.visualViewport`).
 *
 * Po co: jednostki `vh` (a na iOS także `dvh`) liczą się z *layout viewport*, który przy wysunięciu
 * klawiatury ekranowej **się nie kurczy**. Okno na `85vh` zostaje więc tej samej wysokości, a system
 * przewija całą stronę, żeby odsłonić pole tekstowe — stąd „okno ucieka w górę" i karetka trafia
 * w złe miejsce. `visualViewport` mówi, ile miejsca REALNIE widać, więc przypięte do niego okno po
 * prostu maleje, oddając przestrzeń klawiaturze.
 *
 * Zwraca `null`, gdy przeglądarka nie udostępnia API (albo podczas renderu na serwerze) — wołający
 * ma wtedy zostać przy dotychczasowym układzie.
 */
export interface VisualViewportSize {
  /** Wysokość widocznego obszaru w pikselach CSS. */
  height: number;
  /** Przesunięcie widocznego obszaru względem góry strony (rośnie, gdy system przewinie stronę). */
  offsetTop: number;
}

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

export function useVisualViewport(enabled = true): VisualViewportSize | null {
  const [size, setSize] = useState<VisualViewportSize | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setSize(null);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) {
      setSize(null);
      return;
    }

    let frame = 0;
    const read = () => {
      // Zdarzenia `resize`/`scroll` sypią się seriami w trakcie animacji klawiatury — czytamy raz
      // na klatkę, żeby nie przerysowywać okna kilkanaście razy na sekundę.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const current = window.visualViewport;
        if (!current) return;
        setSize({ height: current.height, offsetTop: current.offsetTop });
      });
    };

    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, [enabled]);

  return size;
}
