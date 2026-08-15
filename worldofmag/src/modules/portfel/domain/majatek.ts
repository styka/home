/**
 * 069 (zadanie 19, rozdz. 10.1) — WKŁAD ELEMENTU PORTFELA W MAJĄTEK NETTO.
 *
 * Wyprowadzone z `actions/portfel.ts`. Jednolinijkowa reguła o cichej cenie pomyłki: gdyby dług
 * liczył się na plus, majątek netto byłby zawyżony o **dwukrotność** salda kredytu, a nic w UI nie
 * zasygnalizowałoby błędu — liczba po prostu byłaby nieprawdziwa.
 */

/**
 * Saldo elementu z uwzględnieniem jego rodzaju: **zobowiązania wchodzą na minus**.
 *
 * Reguła patrzy wyłącznie na `kind === "debt"`; każdy inny rodzaj (konto, gotówka, oszczędności,
 * inwestycja) wchodzi ze swoim znakiem. Element długu z saldem ujemnym oznacza nadpłatę i wychodzi
 * na plus — to wynika z reguły wprost i jest zamierzone.
 */
export function signedBalance(el: { kind: string; balance: number }): number {
  return el.kind === "debt" ? -el.balance : el.balance;
}
