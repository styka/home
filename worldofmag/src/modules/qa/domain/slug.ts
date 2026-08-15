/**
 * 069 (zadanie 19, rozdz. 10.1) — ADRES SCENARIUSZA QA.
 *
 * Wyprowadzone z `actions/qa.ts`. Reguła tożsamościowa — wynik trafia do adresu
 * `/qa/scenariusz/<slug>`.
 *
 * **Nie jest tożsama ze slugiem Kuchni** (`modules/kitchen/domain/slug.ts`), mimo podobnej nazwy
 * i zadania. Rozbieżności są realne i widać je w teście obok. Nie ujednolicamy ich w 069: obie
 * reguły wyprodukowały już adresy istniejących rekordów, więc scalenie przeniosłoby część z nich
 * pod nowe adresy. To zmiana widoczna dla użytkownika i wymaga własnej decyzji.
 */

const BEZ_OGONKOW: Record<string, string> = {
  ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
};

/** Tytuł → slug scenariusza: bez ogonków, tylko `a-z0-9-_`, bez myślników na brzegach. */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => BEZ_OGONKOW[ch] ?? ch)
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
