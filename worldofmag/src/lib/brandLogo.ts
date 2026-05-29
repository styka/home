// Jedno źródło prawdy dla znaku marki „pierścienie głębi".
// Koncentryczne okręgi dające efekt tunelu/głębi: ku środkowi CIEŃSZE, GĘŚCIEJ
// (mniejsze przerwy — promienie w ciągu geometrycznym) i BARDZIEJ PRZEZROCZYSTE.
// Tło przezroczyste (bez kafla). Używane i w DOM (BrandLogo), i w generatorach PNG
// (icon.tsx / apple-icon.tsx / pwa-icon) przez brandLogoSvgString().
//
// Geometria: siatka SVG 100×100, środek (50,50). rₙ = rₙ₋₁·k (k<1) → przerwy maleją
// ku środkowi (perspektywa tunelu). Grubość ∝ promień → cieńsze ku środkowi.
// Opacity maleje liniowo po indeksie (zewn. ~1.0 → wewn. ~0.22).

export interface RingSpec {
  r: number;
  sw: number;
  opacity: number;
}

const K = 0.74; // współczynnik kurczenia promienia
const MIN_R = 5;
const SW_FACTOR = 0.11;
const MIN_SW = 1.2;
const MAX_SW = 5;
// Margines bezpieczeństwa w siatce 100×100 (≈„2px" w przestrzeni projektowej),
// jednolity dla każdego rozmiaru ikony. Promień zewnętrzny dobrany tak, by ZEWNĘTRZNA
// krawędź pociągnięcia (R + MAX_SW/2) kończyła się MARGIN jednostek od krawędzi ikony.
// Wewnętrzne pierścienie kurczą się same (r *= K), więc całość dopasowuje się do mniejszej powierzchni.
const MARGIN = 2;
const R = 50 - MARGIN - MAX_SW / 2; // = 45.5
const OUTER_OPACITY = 1.0;
const INNER_OPACITY = 0.22;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function depthRings(): RingSpec[] {
  const radii: number[] = [];
  let r = R;
  while (r >= MIN_R) {
    radii.push(r);
    r *= K;
  }
  const n = radii.length;
  return radii.map((rad, i) => ({
    r: rad,
    sw: clamp(rad * SW_FACTOR, MIN_SW, MAX_SW),
    opacity: n > 1 ? OUTER_OPACITY + (INNER_OPACITY - OUTER_OPACITY) * (i / (n - 1)) : OUTER_OPACITY,
  }));
}

export type BrandColors =
  | { kind: "gradient"; from: string; to: string }
  | { kind: "solid"; color: string };

export function brandColors(prod: boolean): BrandColors {
  return prod
    ? { kind: "gradient", from: "#4f46e5", to: "#7c3aed" } // prod: indygo→fiolet (premium)
    : { kind: "solid", color: "#22d3ee" }; // dev: cyjan (wyraźnie inny)
}

// Wyróżnik środowiska DEV: jasny symbol </> na środku (≈ 42% szerokości ikony,
// czyli prawie dwa razy mniejszy niż cała ikona), rysowany NAD kręgami. Tylko dev.
// Pod symbolem półprzezroczysty ciemny krążek, by biały znak był czytelny na jasnych kręgach.
export function devMarkerInner(): string {
  return (
    `<circle cx="50" cy="50" r="23" fill="#0d0d0d" fill-opacity="0.55"/>` +
    `<g fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M38 40 L29 50 L38 60"/>` + // lewy chevron <
    `<path d="M62 40 L71 50 L62 60"/>` + // prawy chevron >
    `<path d="M56 38 L44 62"/>` + // ukośnik /
    `</g>`
  );
}

// Pełny SVG (przezroczyste tło) — dla generatorów PNG (ImageResponse przez <img> data-URI).
export function brandLogoSvgString(prod: boolean): string {
  const colors = brandColors(prod);
  const rings = depthRings();
  const stroke = colors.kind === "gradient" ? "url(#brandGrad)" : colors.color;
  const defs =
    colors.kind === "gradient"
      ? `<defs><linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors.from}"/><stop offset="1" stop-color="${colors.to}"/></linearGradient></defs>`
      : "";
  const circles = rings
    .map(
      (ring) =>
        `<circle cx="50" cy="50" r="${ring.r.toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${ring.sw.toFixed(2)}" stroke-opacity="${ring.opacity.toFixed(3)}"/>`,
    )
    .join("");
  const marker = prod ? "" : devMarkerInner();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${defs}${circles}${marker}</svg>`;
}
