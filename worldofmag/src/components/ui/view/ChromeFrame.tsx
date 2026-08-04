"use client";

/**
 * 045 — dekoracyjne ramki narożne sterowane tokenem `--chrome-frame`.
 *
 * To jest cała „grafika" skórek w Omnii: **wektor generowany kodem**, nie plik.
 * Powód jest praktyczny, nie ideologiczny — SVG skaluje się na każdym ekranie, waży
 * tyle co nic, nie wymaga żądania do sieci i **sam reaguje na tokeny skórki**
 * (`currentColor` bierze kolor z otoczenia). Bitmapa nie robi żadnej z tych rzeczy,
 * a przy zmianie akcentu wyglądałaby jak naklejka z innej aplikacji.
 *
 * Cztery narożniki to cztery osobne, małe SVG przypięte do rogów — a nie jedno
 * rozciągane na cały obszar. Ścieżka SVG nie przyjmuje procentów ani `calc()`, więc
 * „jeden rozciągnięty prostokąt" albo by się nie narysował, albo zniekształcił
 * grubość kreski przy nietypowych proporcjach widoku.
 *
 * Domyślnie `--chrome-frame: none`, więc dla większości skórek `ModuleView` w ogóle
 * tego nie renderuje. Skórka „Mostek" ustawia `corners` i dostaje charakter, którego
 * samymi kolorami osiągnąć się nie da.
 *
 * `aria-hidden`, bo to czysta dekoracja — czytnik ekranu nie ma o czym mówić.
 */

const SIZE = 16;
const STROKE = 2;

/** Jeden narożnik: dwie kreski schodzące się w rogu. `rotate` ustawia go w którymś z czterech. */
function Corner({ rotate, style }: { rotate: number; style: React.CSSProperties }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ position: "absolute", display: "block", transform: `rotate(${rotate}deg)`, ...style }}
    >
      <path
        d={`M0,${SIZE} L0,0 L${SIZE},0`}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="square"
      />
    </svg>
  );
}

export function ChromeFrame() {
  return (
    <div
      aria-hidden
      className="omnia-chrome-frame"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        color: "var(--accent-blue)",
        opacity: 0.55,
      }}
    >
      <Corner rotate={0} style={{ top: 0, left: 0 }} />
      <Corner rotate={90} style={{ top: 0, right: 0 }} />
      <Corner rotate={180} style={{ bottom: 0, right: 0 }} />
      <Corner rotate={270} style={{ bottom: 0, left: 0 }} />
    </div>
  );
}
