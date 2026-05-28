// Jedno źródło prawdy dla znaku marki: 10 wariantów rysowanych jako SVG na siatce
// 100×100. Używane przez: ikonę w menu (BrandLogo), klikalny eksperyment na stronie
// domowej (BrandLogoCycler) oraz trasę podglądu. Reguły: krąg/orbita jako DNA, max 2
// pierścienie (bez „celownika"), asymetria/węzeł, premium-minimal, motywy segmentów i
// splotów. Białe znaki na gradientowym kaflu.
export const BRAND_VARIANT_COUNT = 10;

// Inner SVG każdego wariantu (białe kształty); grupa nadrzędna ustawia stroke/fill.
export const BRAND_VARIANTS: string[] = [
  // 0 — Pierścień + węzeł orbitujący (zgodny z faviconem na develop)
  `<circle cx="50" cy="50" r="27"/><circle cx="69.1" cy="30.9" r="7" fill="#fff" stroke="none"/>`,
  // 1 — Dwa współśrodkowe pierścienie + węzeł na zewnętrznym
  `<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="15"/><circle cx="71.2" cy="28.8" r="6" fill="#fff" stroke="none"/>`,
  // 2 — Ekscentryczne pierścienie (efekt orbity) + rdzeń
  `<circle cx="50" cy="50" r="30"/><circle cx="57" cy="43" r="16"/><circle cx="57" cy="43" r="4.5" fill="#fff" stroke="none"/>`,
  // 3 — Splecione kręgi różnej wielkości + węzeł
  `<circle cx="42" cy="54" r="22"/><circle cx="61" cy="47" r="15"/><circle cx="42" cy="30" r="5" fill="#fff" stroke="none"/>`,
  // 4 — Segmentowy pierścień zewnętrzny + pełny wewnętrzny + węzeł
  `<circle cx="50" cy="50" r="30" stroke-dasharray="33 14.1"/><circle cx="50" cy="50" r="14"/><circle cx="50" cy="20" r="6" fill="#fff" stroke="none"/>`,
  // 5 — Pierścień centralny + przechylona orbita + węzeł
  `<g transform="rotate(-28 50 50)"><ellipse cx="50" cy="50" rx="32" ry="13"/></g><circle cx="50" cy="50" r="11"/><circle cx="76" cy="36" r="5.5" fill="#fff" stroke="none"/>`,
  // 6 — Otwarty pierścień (łuk ~300°) z zaokrąglonymi końcami + węzeł w przerwie
  `<path d="M65,75.98 A30,30 0 1 1 65,24.02"/><circle cx="80" cy="50" r="5.5" fill="#fff" stroke="none"/>`,
  // 7 — Dwa równe splecione kręgi (unia/zbiór) + węzeł
  `<circle cx="40" cy="52" r="20"/><circle cx="60" cy="52" r="20"/><circle cx="50" cy="27" r="5" fill="#fff" stroke="none"/>`,
  // 8 — Pierścień + dwa węzły orbitujące (konstelacja)
  `<circle cx="50" cy="50" r="28"/><circle cx="69.8" cy="30.2" r="6.5" fill="#fff" stroke="none"/><circle cx="33" cy="64" r="4.5" fill="#fff" stroke="none"/>`,
  // 9 — Globus (pierścień + południk + równik) — „Omnia / cały świat"
  `<circle cx="50" cy="50" r="30"/><ellipse cx="50" cy="50" rx="12" ry="30"/><line x1="20" y1="50" x2="80" y2="50"/>`,
];

function clamp(i: number): number {
  return ((i % BRAND_VARIANT_COUNT) + BRAND_VARIANT_COUNT) % BRAND_VARIANT_COUNT;
}

const GROUP_OPEN = `<g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">`;

export function brandInnerGroup(i: number): string {
  return `${GROUP_OPEN}${BRAND_VARIANTS[clamp(i)]}</g>`;
}

export function brandTileGradient(prod: boolean): { from: string; to: string } {
  return prod ? { from: "#4f46e5", to: "#7c3aed" } : { from: "#6b7280", to: "#4b5563" };
}

// Pełny SVG (kafel + znak) — dla trasy podglądu / Satori (<img> data-URI).
export function brandSvgString(i: number, prod: boolean): string {
  const g = brandTileGradient(prod);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#bg)"/>${brandInnerGroup(i)}</svg>`;
}
