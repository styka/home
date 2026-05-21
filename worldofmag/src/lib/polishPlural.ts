/**
 * Polski plural dla liczb:
 *   1            → forms[0] (one)        np. "przepis"
 *   2-4, 22-24…  → forms[1] (few)        np. "przepisy"
 *   inne         → forms[2] (many)       np. "przepisów"
 *
 * Reguła: n % 10 ∈ [2,4] i n % 100 ∉ [12,14] → few; inaczej many; n === 1 → one.
 */
export function polishPlural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return forms[0];
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
