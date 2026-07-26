// 032: rozwiązywanie referencji „identyfikator ALBO nazwa" w read-toolach asystenta.
//
// Problem, który rozwiązuje: agent naturalnie mówi nazwami („w projekcie Omnia", „na liście moje"),
// a read-toole przyjmowały te wartości jako identyfikatory. Zapytanie `where: { id: "moje" }` nie
// pasuje do niczego, więc narzędzie zwracało PUSTKĘ — a asystent na tej podstawie twierdził, że
// „nic tam nie ma", albo powtarzał ten sam odczyt do wyczerpania limitu kroków.
//
// Czysta logika (bez bazy) wydzielona osobno, żeby dała się przetestować jednostkowo — tak samo jak
// `conversationLimits.ts` wydzielono z pliku akcji.

export interface NamedCandidate {
  id: string;
  name: string;
}

export type RefResolution =
  | { id: string }
  /** `matches` niepuste = nazwa niejednoznaczna; puste = brak dopasowania. */
  | { unresolved: string; matches: string[]; available: string[] };

/**
 * Kolejność jest istotna:
 *  1. dokładny identyfikator — prawidłowe id nigdy nie może pójść ścieżką „to chyba nazwa",
 *  2. dokładna nazwa (bez rozróżniania wielkości liter),
 *  3. JEDNOZNACZNE dopasowanie częściowe.
 * Wiele dopasowań i brak dopasowania to DWA RÓŻNE wyniki — wołający ma na nie różnie reagować
 * (dopytać vs. powiedzieć, czego nie ma).
 */
export function matchNamedRef(ref: string, candidates: NamedCandidate[]): RefResolution {
  const needle = ref.trim().toLowerCase();

  const byId = candidates.find((c) => c.id === ref);
  if (byId) return { id: byId.id };

  const exact = candidates.filter((c) => c.name.trim().toLowerCase() === needle);
  if (exact.length === 1) return { id: exact[0].id };
  if (exact.length > 1) {
    return { unresolved: ref, matches: exact.map((c) => c.name), available: candidates.map((c) => c.name) };
  }

  const partial = needle ? candidates.filter((c) => c.name.toLowerCase().includes(needle)) : [];
  if (partial.length === 1) return { id: partial[0].id };

  return { unresolved: ref, matches: partial.map((c) => c.name), available: candidates.map((c) => c.name) };
}

/**
 * Komunikat dla agenta, gdy referencji nie da się rozwiązać. Rozróżnia „pasuje kilka" od „nie ma",
 * bo to prowadzi do zupełnie innej reakcji asystenta.
 *
 * `label` to polska nazwa rodzaju zasobu w dopełniaczu, np. „listy zakupów", „notatki".
 */
export function unresolvedRefMessage(
  res: Extract<RefResolution, { unresolved: string }>,
  label: string
): string {
  if (res.matches.length > 1) {
    return `Nazwa „${res.unresolved}” pasuje do kilku pozycji: ${res.matches.join(", ")}. Doprecyzuj, o którą chodzi.`;
  }
  return `Nie znaleziono ${label} o nazwie „${res.unresolved}”. Dostępne: ${res.available.join(", ") || "(brak)"}. Doprecyzuj nazwę.`;
}
