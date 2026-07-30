"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * 036 — NARZĘDZIE DIAGNOSTYCZNE (tymczasowe). Nakładka z liczbami opisującymi geometrię widocznego
 * obszaru, do nagrania ekranu na telefonie.
 *
 * Po co: z samego filmu widać, ŻE okno asystenta na moment wyjeżdża ponad ekran przy animacji
 * klawiatury, ale nie widać, KTÓRA wielkość się rozjeżdża — czy przesuwa się widoczny obszar
 * (`visualViewport.offsetTop`), czy przewija się dokument (`scrollY`), czy nasza korekta po prostu
 * nie zdąża. Te trzy przyczyny mają różne naprawy, więc zgadywanie kosztuje kolejne podejście.
 *
 * Włączane WYŁĄCZNIE parametrem `?vvdebug=1` w adresie — bez niego komponent nic nie renderuje.
 *
 * Odczyt leci w pętli `requestAnimationFrame`, a NIE na zdarzeniach: właśnie klatki animacji
 * klawiatury są tu interesujące, a zdarzenia `visualViewport` mogą ich nie pokryć. `rAF` jest tu na
 * miejscu — mierzymy, a nie korygujemy układ (korekta musi być w zdarzeniu, patrz
 * `usePinToVisualViewport`).
 */
export function ViewportProbe({ sheetRef }: { sheetRef: RefObject<HTMLElement | null> }) {
  const [on, setOn] = useState(false);
  const boxRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOn(new URLSearchParams(window.location.search).get("vvdebug") === "1");
  }, []);

  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let frame = 0;
    const tick = () => {
      frame++;
      const el = boxRef.current;
      const vv = window.visualViewport;
      if (el) {
        const rect = sheetRef.current?.getBoundingClientRect();
        const cs = sheetRef.current ? getComputedStyle(sheetRef.current) : null;
        el.textContent = [
          `#${frame}`,
          `vv.h  ${vv ? vv.height.toFixed(1) : "-"}`,
          `vv.top ${vv ? vv.offsetTop.toFixed(1) : "-"}`,
          `vv.pgTop ${vv ? vv.pageTop.toFixed(1) : "-"}`,
          `win.h ${window.innerHeight}`,
          `scrollY ${window.scrollY.toFixed(1)}`,
          `docTop ${(document.scrollingElement?.scrollTop ?? -1).toFixed(1)}`,
          `okno.top ${rect ? rect.top.toFixed(1) : "-"}`,
          `okno.h ${rect ? rect.height.toFixed(1) : "-"}`,
          `--vv-h ${cs?.getPropertyValue("--vv-height").trim() || "-"}`,
        ].join("\n");
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [on, sheetRef]);

  if (!on) return null;

  return (
    <pre
      ref={boxRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 4,
        top: 4,
        zIndex: 10000,
        margin: 0,
        padding: "4px 6px",
        // Celowo bez zmiennych motywu: nakładka ma być czytelna na nagraniu niezależnie od skórki.
        background: "rgba(0,0,0,0.82)",
        color: "#0f0",
        font: "700 10px/1.25 ui-monospace, monospace",
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    />
  );
}
