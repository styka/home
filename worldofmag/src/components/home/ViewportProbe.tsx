"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * 036 — NARZĘDZIE DIAGNOSTYCZNE (tymczasowe). Nakładka z liczbami opisującymi geometrię widocznego
 * obszaru, do nagrania ekranu na telefonie.
 *
 * Po co: z samego filmu widać, ŻE okno asystenta na moment wyjeżdża ponad ekran przy animacji
 * klawiatury, ale nie widać, KTÓRA wielkość się rozjeżdża — czy przesuwa się widoczny obszar
 * (`visualViewport.offsetTop`), czy przewija się dokument (`scrollY`), czy nasza korekta po prostu
 * nie zdąża. Te trzy przyczyny mają różne naprawy, więc zgadywanie kosztuje kolejne podejście.
 *
 * **Widoczna ZAWSZE, na czas diagnozy.** Pierwotnie właczana parametrem `?vvdebug=1`, ale aplikacja
 * jest uruchamiana z ikony skrótu (PWA), gdzie nie ma jak dopisać parametru do adresu. Do usunięcia
 * razem z całym plikiem, gdy sprawa drgającego nagłówka zostanie zamknięta.
 *
 * Odczyt leci w pętli `requestAnimationFrame`, a NIE na zdarzeniach: właśnie klatki animacji
 * klawiatury są tu interesujące, a zdarzenia `visualViewport` mogą ich nie pokryć. `rAF` jest tu na
 * miejscu — mierzymy, a nie korygujemy układ (korekta musi być w zdarzeniu, patrz
 * `usePinToVisualViewport`).
 */
export function ViewportProbe({ sheetRef }: { sheetRef: RefObject<HTMLElement | null> }) {
  const boxRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let frame = 0;

    // ROZSTRZYGNIĘCIE: czy iOS podaje geometrię PŁYNNIE, czy SKOKAMI.
    //
    // To jedno pytanie decyduje o kierunku naprawy, a z samego filmu nie da się go odczytać (liczby
    // lecą za szybko). Dlatego zliczamy przebieg ostatniego ruchu klawiatury:
    //   `kroki` — ile RÓŻNYCH wartości `offsetTop` pojawiło się podczas ruchu,
    //   `maxSkok` — największa różnica między dwoma kolejnymi wartościami.
    // Odczyt: `kroki 2 / maxSkok 291` = dane skokowe, u nas nie ma czego poprawiać i zostaje
    // wygładzanie przejścia. `kroki 20 / maxSkok 25` = dane płynne, więc przeskok bierze się z tego,
    // co robimy z nimi dalej. Ruch uznajemy za zakończony po 600 ms bez zmiany.
    let lastTop = Number.NaN;
    let lastChangeAt = 0;
    let steps = 0;
    let maxJump = 0;

    const sampleMovement = (top: number) => {
      const now = performance.now();
      if (top === lastTop) return;
      // Nowy ruch? Zacznij liczyć od zera, żeby odczyt dotyczył JEDNEJ animacji, a nie całej sesji.
      if (now - lastChangeAt > 600) { steps = 0; maxJump = 0; }
      if (Number.isFinite(lastTop)) maxJump = Math.max(maxJump, Math.abs(top - lastTop));
      steps++;
      lastTop = top;
      lastChangeAt = now;
    };

    const tick = () => {
      frame++;
      const el = boxRef.current;
      const vv = window.visualViewport;
      if (vv) sampleMovement(vv.offsetTop);
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
          `--vv-top ${cs?.getPropertyValue("--vv-top").trim() || "-"}`,
          `--vv-h ${cs?.getPropertyValue("--vv-height").trim() || "-"}`,
          `kroki ${steps}`,
          `maxSkok ${maxJump.toFixed(1)}`,
        ].join("\n");
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [sheetRef]);

  return (
    <pre
      ref={boxRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 4,
        // Środek ekranu, NIE góra: nakładka nie może zasłaniać ani nagłówka, ani pola tekstowego —
        // to właśnie ich ruch oglądamy na nagraniu.
        top: "38%",
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
