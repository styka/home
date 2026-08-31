/**
 * 117: OBSZARY — czyste funkcje na drzewie obszarów projektu.
 *
 * Wszystko tutaj operuje na płaskiej liście `{ id, parentId, order, name }` z bazy — bez Prismy,
 * żeby dało się to testować bez DB i żeby trzy warianty widoku (sekcje / drill / panel) oraz
 * restorator kosza korzystały z JEDNEJ definicji drzewa (lekcja 085: jeden zbiór, różni się
 * wyłącznie prezentacja).
 */

export interface WezelObszaru {
  id: string;
  parentId: string | null;
  name: string;
  order: number;
}

export interface ObszarZGlebokoscia<T extends WezelObszaru = WezelObszaru> {
  obszar: T;
  glebokosc: number;
}

/** Porządek rodzeństwa: `order`, a przy remisie nazwa — stabilnie i przewidywalnie. */
function porownajRodzenstwo(a: WezelObszaru, b: WezelObszaru): number {
  return a.order - b.order || a.name.localeCompare(b.name, "pl");
}

/**
 * Spłaszczone drzewo w kolejności prezentacji (rodzic, potem jego dzieci rekurencyjnie),
 * z głębokością do wcięć. Sierota (rodzic spoza listy — np. niespójna migawka) jest doklejana
 * jak korzeń zamiast znikać: zgubiony obszar to zgubione zadania w sekcjach.
 */
export function splaszczDrzewo<T extends WezelObszaru>(obszary: T[]): ObszarZGlebokoscia<T>[] {
  const poRodzicu = new Map<string | null, T[]>();
  const znaneId = new Set(obszary.map((o) => o.id));
  for (const o of obszary) {
    const klucz = o.parentId !== null && znaneId.has(o.parentId) ? o.parentId : null;
    const lista = poRodzicu.get(klucz) ?? [];
    lista.push(o);
    poRodzicu.set(klucz, lista);
  }
  for (const lista of poRodzicu.values()) lista.sort(porownajRodzenstwo);

  const wynik: ObszarZGlebokoscia<T>[] = [];
  const odwiedz = (rodzicId: string | null, glebokosc: number) => {
    for (const o of poRodzicu.get(rodzicId) ?? []) {
      wynik.push({ obszar: o, glebokosc });
      odwiedz(o.id, glebokosc + 1);
    }
  };
  odwiedz(null, 0);
  return wynik;
}

/** Id całego poddrzewa (łącznie z korzeniem). */
export function idPoddrzewa(obszary: WezelObszaru[], korzenId: string): Set<string> {
  const dzieci = new Map<string, string[]>();
  for (const o of obszary) {
    if (o.parentId === null) continue;
    const lista = dzieci.get(o.parentId) ?? [];
    lista.push(o.id);
    dzieci.set(o.parentId, lista);
  }
  const wynik = new Set<string>();
  const stos = [korzenId];
  while (stos.length > 0) {
    const id = stos.pop()!;
    if (wynik.has(id)) continue; // cykl w danych nie może zapętlić funkcji
    wynik.add(id);
    for (const d of dzieci.get(id) ?? []) stos.push(d);
  }
  return wynik;
}

/**
 * Czy przeniesienie `przenoszonyId` pod `nowyRodzicId` tworzy cykl — tzn. cel jest przenoszonym
 * obszarem albo jego potomkiem. `null` (szczyt drzewa) nigdy nie tworzy cyklu.
 */
export function czyRuchTworzyCykl(
  obszary: WezelObszaru[],
  przenoszonyId: string,
  nowyRodzicId: string | null,
): boolean {
  if (nowyRodzicId === null) return false;
  return idPoddrzewa(obszary, przenoszonyId).has(nowyRodzicId);
}

/**
 * Kolejność rodzic→dziecko do odtwarzania z migawki: `createMany` wstawia wiersze w kolejności
 * tablicy, więc rodzic musi stać przed dzieckiem, inaczej klucz obcy odrzuci wiersz.
 * Sieroty (rodzic poza migawką) lądują na początku — restorator i tak zeruje im `parentId`.
 */
export function sortujTopologicznie<T extends WezelObszaru>(obszary: T[]): T[] {
  return splaszczDrzewo(obszary).map((w) => w.obszar);
}
