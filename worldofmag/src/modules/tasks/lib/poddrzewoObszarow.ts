/**
 * 125: czysta arytmetyka poddrzewa obszarów-kategorii — wspólna dla serwera (zakres widoku
 * obszaru) i klienta (filtr jednowartościowy w widokach zbiorczych). Zero importów — plik musi
 * być bezpieczny w bundlu przeglądarki.
 */

export type WezelObszaru = { id: string; parentId: string | null };

/** Id wszystkich obszarów poddrzewa (łącznie z korzeniem). Odporne na cykl (odwiedzone pomijamy). */
export function idPoddrzewa(obszary: WezelObszaru[], korzenId: string): Set<string> {
  const dzieci = new Map<string, string[]>();
  for (const o of obszary) {
    if (!o.parentId) continue;
    const arr = dzieci.get(o.parentId);
    if (arr) arr.push(o.id);
    else dzieci.set(o.parentId, [o.id]);
  }
  const wynik = new Set<string>([korzenId]);
  const kolejka = [korzenId];
  while (kolejka.length > 0) {
    const id = kolejka.pop()!;
    for (const dziecko of dzieci.get(id) ?? []) {
      if (wynik.has(dziecko)) continue;
      wynik.add(dziecko);
      kolejka.push(dziecko);
    }
  }
  return wynik;
}

/** Id projektów przypisanych do dowolnego obszaru poddrzewa. */
export function projektyPoddrzewa(
  obszary: WezelObszaru[],
  korzenId: string,
  projekty: Array<{ id: string; areaId?: string | null }>
): string[] {
  const zakres = idPoddrzewa(obszary, korzenId);
  return projekty.filter((p) => p.areaId && zakres.has(p.areaId)).map((p) => p.id);
}

/** Spłaszczenie drzewa do listy render-ready (kolejność: order rodzica, potem wgłąb) z głębokością. */
export function splaszczDrzewo<T extends { id: string; parentId: string | null }>(
  obszary: T[]
): Array<T & { glebokosc: number }> {
  const dzieci = new Map<string | null, T[]>();
  for (const o of obszary) {
    const k = o.parentId ?? null;
    const arr = dzieci.get(k);
    if (arr) arr.push(o);
    else dzieci.set(k, [o]);
  }
  const wynik: Array<T & { glebokosc: number }> = [];
  const odwiedzone = new Set<string>();
  const zejdz = (parentId: string | null, glebokosc: number) => {
    for (const o of dzieci.get(parentId) ?? []) {
      if (odwiedzone.has(o.id)) continue;
      odwiedzone.add(o.id);
      wynik.push({ ...o, glebokosc });
      zejdz(o.id, glebokosc + 1);
    }
  };
  zejdz(null, 0);
  // Sierota (rodzic spoza listy) nie może zniknąć z UI.
  for (const o of obszary) if (!odwiedzone.has(o.id)) wynik.push({ ...o, glebokosc: 0 });
  return wynik;
}
