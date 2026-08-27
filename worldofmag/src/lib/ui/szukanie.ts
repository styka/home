/**
 * 110: PORÓWNYWANIE FRAZ DLA WYSZUKIWAREK W INTERFEJSIE.
 *
 * Funkcje powstały w 109 dla spisu ustawień i mieszkały w `src/lib/ustawienia/sekcje.ts`. Nic nie
 * wiedzą o ustawieniach — biorą trzy napisy i frazę — a panel administratora potrzebuje dokładnie
 * tego samego. Przeniesienie zamiast kopii: dwie kopie tej samej normalizacji rozjechałyby się przy
 * pierwszej literze, którą trzeba dołożyć (C-35, C-53).
 */

/**
 * Porównanie odporne na brak diakrytyków: „jezyk" ma znaleźć „Język i strefa czasowa".
 *
 * Rozkład NFD rozbija „ż" na „z" + znak diakrytyczny, który potem wycinamy — dzięki temu nie
 * potrzeba ani tablicy podmian, ani nowej zależności. `ł` nie jest literą z akcentem (NFD go nie
 * rozkłada), więc dostaje jawną podmianę; bez niej „lacze" nie znalazłoby „Połączenia".
 *
 * Zakres `\u0300-\u036f` („Combining Diacritical Marks") świadomie zamiast własności `\p{M}`:
 * ta druga wymaga flagi `u`, której główny `tsconfig` nie dopuszcza przy swoim docelowym
 * standardzie, a zakres pokrywa wszystkie ogonki wychodzące z rozkładu NFD.
 */
export function bezOgonkow(tekst: string): string {
  return tekst
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLocaleLowerCase("pl-PL");
}

/**
 * Czy pozycja pasuje do frazy — po nazwie, opisie i dodatkowych hasłach.
 *
 * Pusta fraza pasuje do wszystkiego: to stan początkowy pola szukania, więc gdyby traktować go jak
 * brak trafień, spis byłby pusty zanim użytkownik cokolwiek napisze.
 */
export function pasujeDoFrazy(fraza: string, nazwa: string, opis: string, hasla: string): boolean {
  const szukane = bezOgonkow(fraza).trim();
  if (szukane === "") return true;
  const stog = bezOgonkow(`${nazwa} ${opis} ${hasla}`);
  return szukane.split(/\s+/).every((slowo) => stog.includes(slowo));
}
