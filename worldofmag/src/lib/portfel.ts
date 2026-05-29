// Pomocnicze dla modułu Portfel: etykiety rodzajów elementów i formatowanie kwot.

export const ELEMENT_KIND_LABELS: Record<string, string> = {
  cash: "Gotówka",
  account: "Konto",
  savings: "Oszczędności",
  investment: "Inwestycja",
  property: "Nieruchomość",
  receivable: "Należność",
  debt: "Dług",
};

export const ENTRY_KIND_LABELS: Record<string, string> = {
  income: "Przychód",
  expense: "Rozchód",
  adjustment: "Korekta",
};

export function formatMoney(amount: number, currency = "PLN"): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}
