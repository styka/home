// 029: przelicznik USD→PLN dla kwot pokazywanych w USD (koszty AI itp.).
//
// Wartość przelicznika ustawia admin w panelu LLM (`/admin/llm`); domyślnie
// 1 USD = 3,81 PLN gdy nie ustawiono. Wszędzie, gdzie pokazujemy kwotę w USD,
// doklejamy w nawiasie równowartość w PLN wg tego przelicznika.
//
// Ten moduł jest CZYSTY (bez importów serwerowych) — bezpieczny do użycia w
// komponentach klienckich. Odczyt wartości z bazy jest w `@/lib/usdPlnRate` (serwer).

export const USD_PLN_CONFIG_KEY = "usd_pln_rate";
export const DEFAULT_USD_PLN_RATE = 3.81;

/** Parsuje wartość przelicznika (akceptuje przecinek lub kropkę). Nieprawidłowa/≤0 → fallback. */
export function parseUsdPlnRate(raw: string | null | undefined, fallback = DEFAULT_USD_PLN_RATE): number {
  if (raw == null) return fallback;
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function usdToPln(usd: number, rate: number): number {
  return usd * rate;
}

/** Kwota PLN po polsku: przecinek dziesiętny + " zł". Dla wartości <1 więcej miejsc (drobne koszty). */
export function formatPln(pln: number): string {
  const decimals = Math.abs(pln) < 1 ? 4 : 2;
  return (
    pln.toLocaleString("pl-PL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " zł"
  );
}

/**
 * Dokleja równowartość PLN w nawiasie do gotowego napisu z kwotą USD.
 * Np. withPln("$0.0012", 0.0012, 3.81) → "$0.0012 (0,0046 zł)".
 */
export function withPln(usdText: string, usd: number, rate: number): string {
  return `${usdText} (${formatPln(usdToPln(usd, rate))})`;
}
