/**
 * 112: GRANICA SŁOWA ŚWIADOMA POLSKICH LITER.
 *
 * `\b` w JavaScripcie jest ASCII-owe: „ż", „ź", „ć", „ń", „ó", „ę", „ą", „ł", „ś" NIE są dla niego
 * znakami słowa. Skutek jest zdradliwy, bo cichy: w alternatywie `(pokaż|pokaz|…)\b` człon kończący
 * się polską literą **nigdy nie pasuje** — po „ż" i po spacji stoją dwa znaki nie-słowne, więc
 * granicy tam nie ma. Tak samo `\b(…|śniadanie|…)` nie złapie słowa zaczynającego się od „ś".
 *
 * Wydzielone z `fastPath.ts` do WŁASNEGO pliku, bo tamten importuje `chatComplete` (kod serwerowy),
 * a granic słów potrzebują też komponenty klienckie (głosowe „zatwierdź"/„odrzuć" w powłoce
 * asystenta) — import z `fastPath` wciągałby klienta LLM do bundla przeglądarki.
 *
 * Zamiast `\b` używamy asercji na „nie litera" (dowolnego alfabetu) — stąd flaga `u`.
 */
export function granicePolskie(rdzen: string, kotwiczOdPoczatku = false): RegExp {
  const przod = kotwiczOdPoczatku ? "^\\s*" : "(?<!\\p{L})";
  return new RegExp(`${przod}(?:${rdzen})(?!\\p{L})`, "iu");
}
