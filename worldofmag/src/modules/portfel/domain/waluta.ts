/**
 * 069 (zadanie 19, rozdz. 10.1) — KOD WALUTY.
 *
 * Wyprowadzone z `actions/portfelCurrency.ts`. Reguła tożsamościowa: kod waluty jest kluczem, po
 * którym łączą się kursy, salda i budżety, więc `"pln"` i `"PLN "` muszą dać ten sam napis —
 * inaczej ten sam pieniądz rozpadłby się na dwie waluty.
 */

/** Kod waluty: bez białych znaków, wielkimi literami, maks. 8 znaków. */
export function normCurrency(c: string): string {
  return c.trim().toUpperCase().slice(0, 8);
}
