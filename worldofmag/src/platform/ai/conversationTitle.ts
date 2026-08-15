/**
 * 069 (zadanie 19, rozdz. 10.1) — TYTUŁ ROZMOWY Z ASYSTENTEM.
 *
 * Wyprowadzone z `src/actions/aiConversations.ts`. Reguła przekrojowa (rozmowy asystenta nie należą
 * do żadnego modułu), więc jej miejscem jest zdolność platformy, a nie `modules/<x>/domain/`.
 *
 * Powód wyprowadzenia ten sam co wszędzie w 069: plik `"use server"` nie eksportuje funkcji
 * synchronicznej, więc reguły nie dało się zaimportować do testu.
 */

/**
 * Tytuł rozmowy wyprowadzony z pierwszego polecenia użytkownika.
 *
 * Tytuł ma **zmieścić się w liście historii**, więc bierzemy pierwsze siedem słów i twardo tniemy
 * na 60 znakach. Wielokrotne białe znaki zwijamy do pojedynczych spacji, żeby wklejony fragment
 * z łamaniem wierszy nie rozjechał listy.
 */
export function deriveTitle(firstText: string): string {
  const clean = firstText.trim().replace(/\s+/g, " ");
  if (!clean) return "Nowa rozmowa";
  const words = clean.split(" ").slice(0, 7).join(" ");
  return words.length > 60 ? words.slice(0, 60) + "…" : words;
}
