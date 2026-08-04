// 045 — liczenie kontrastu wg WCAG 2.1.
//
// Potrzebne, bo „skórka ma być nienachalna i z zachowaniem estetyki i UX" to wymóg
// właściciela, a jedynym sposobem, żeby wymóg nie zamienił się w deklarację, jest
// policzyć go i wpiąć w testy. Ocena wzrokiem zawodzi szczególnie przy skórkach
// ciemnych, gdzie nasycony akcent WYGLĄDA na czytelny, a nie jest.

/** #rgb / #rrggbb → [r, g, b] w 0–255. Zwraca null dla wartości nie-hex. */
export function parseHex(hex: string): [number, number, number] | null {
  const v = hex.trim();
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (m3) return [parseInt(m3[1] + m3[1], 16), parseInt(m3[2] + m3[2], 16), parseInt(m3[3] + m3[3], 16)];
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v);
  if (m6) return [parseInt(m6[1], 16), parseInt(m6[2], 16), parseInt(m6[3], 16)];
  return null;
}

/** Luminancja względna wg WCAG. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Współczynnik kontrastu dwóch kolorów hex; 1 = brak różnicy, 21 = czerń na bieli. */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 0;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Progi WCAG AA. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;
