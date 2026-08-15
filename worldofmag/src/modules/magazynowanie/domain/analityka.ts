/**
 * 069 (zadanie 19, rozdz. 10.1) — REGUŁY ANALITYKI MAGAZYNU.
 *
 * Wyprowadzone z `actions/storage.ts` (`getStorageAnalytics`). **Znalezione inaczej niż reszta 069:**
 * pomiar tego przebiegu liczył NAZWANE funkcje pomocnicze w plikach akcji, a te reguły były pisane
 * **wprost w ciele akcji**, więc żadnej nazwy nie miały i w liczniku 55 nie wystąpiły. Są przez to
 * dokładnie tak samo niesprawdzalne — a mają progi liczbowe (80/95, „martwy" po N dniach), których
 * pomyłki nie widać w żadnym wyniku, bo wykres zawsze coś narysuje.
 *
 * Warstwa nie zna Prismy ani sesji — pobranie danych i sprawdzenie dostępu zostaje w akcji.
 */

/** Pozycja magazynowa w zakresie potrzebnym analityce — nie cały model Prismy. */
export interface PozycjaDoAnalizy {
  id: string;
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  minQuantity?: number | null;
  warehouse?: string | null;
  /** Data ostatniego ruchu; `null` = nigdy nie było ruchu. */
  lastMove?: Date | null;
}

/** Wartość pozycji: stan razy cena jednostkowa. Brak którejkolwiek z liczb znaczy zero. */
export function wartoscPozycji(i: { quantity: number | null; unitPrice: number | null }): number {
  return (i.quantity ?? 0) * (i.unitPrice ?? 0);
}

/** Ile pozycji jest poniżej stanu minimalnego (pozycje bez minimum się nie liczą). */
export function liczbaPonizejMinimum(items: PozycjaDoAnalizy[]): number {
  return items.filter((i) => i.minQuantity != null && (i.quantity ?? 0) < i.minQuantity).length;
}

/** Wartość i liczba pozycji w rozbiciu na magazyny, malejąco po wartości. */
export function wartoscWgMagazynu(
  items: PozycjaDoAnalizy[]
): Array<{ warehouse: string; value: number; items: number }> {
  const mapa = new Map<string, { value: number; items: number }>();
  for (const i of items) {
    const klucz = i.warehouse?.trim() || "—";
    const cur = mapa.get(klucz) ?? { value: 0, items: 0 };
    cur.value += wartoscPozycji(i);
    cur.items += 1;
    mapa.set(klucz, cur);
  }
  return Array.from(mapa.entries())
    .map(([warehouse, v]) => ({ warehouse, ...v }))
    .sort((a, b) => b.value - a.value);
}

export interface PozycjaAbc {
  id: string;
  name: string;
  value: number;
  cumPct: number;
  klasa: "A" | "B" | "C";
}

/**
 * Klasyfikacja ABC (Pareto po wartości).
 *
 * **Progi 80 i 95 liczone są od NARASTAJĄCEGO udziału**, nie od wartości pojedynczej pozycji:
 * klasa A to pozycje, które razem dają pierwsze 80 % wartości magazynu, B — do 95 %, reszta to C.
 * Pozycje bezwartościowe (zerowy stan lub brak ceny) wypadają z zestawienia, bo Pareto liczone
 * z zerami przesunęłoby progi i wpuściło do A rzeczy, których tam nie ma.
 */
export function klasyfikacjaAbc(items: PozycjaDoAnalizy[]): PozycjaAbc[] {
  const zWartoscia = items
    .map((i) => ({ id: i.id, name: i.name, value: wartoscPozycji(i) }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value);
  const suma = zWartoscia.reduce((a, i) => a + i.value, 0) || 1;
  let narastajaco = 0;
  return zWartoscia.map((i) => {
    narastajaco += i.value;
    const cumPct = (narastajaco / suma) * 100;
    const klasa: "A" | "B" | "C" = cumPct <= 80 ? "A" : cumPct <= 95 ? "B" : "C";
    return { ...i, cumPct, klasa };
  });
}

/**
 * Martwy zapas: pozycje ze stanem dodatnim, bez ruchu od `deadDays` (albo w ogóle).
 *
 * „Teraz" wchodzi parametrem, żeby regułę dało się sprawdzić (AC-8); domyślnie bieżący czas, więc
 * wywołanie w akcji pozostaje bez zmian.
 */
export function martwyZapas(
  items: PozycjaDoAnalizy[],
  deadDays: number,
  teraz = new Date()
): Array<{ id: string; name: string; quantity: number; lastMove: Date | null; value: number }> {
  const granica = teraz.getTime() - deadDays * 86_400_000;
  return items
    .filter((i) => (i.quantity ?? 0) > 0)
    .map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity ?? 0,
      lastMove: i.lastMove ?? null,
      value: wartoscPozycji(i),
    }))
    .filter((i) => !i.lastMove || i.lastMove.getTime() < granica)
    .sort((a, b) => b.value - a.value);
}

/**
 * Trend ruchów za ostatnie `dni` dni: przyjęcia i wydania w rozbiciu na doby.
 *
 * Dni **bez ruchu też są w wyniku**, z zerami — inaczej wykres skleiłby ze sobą odległe daty
 * i pokazał ciągłość, której nie było.
 */
export function trendRuchow(
  movements: Array<{ delta: number; createdAt: Date }>,
  dni = 14,
  teraz = new Date()
): Array<{ date: string; in: number; out: number }> {
  const mapa = new Map<string, { in: number; out: number }>();
  for (let d = 0; d < dni; d++) {
    const dzien = new Date(teraz.getTime() - (dni - 1 - d) * 86_400_000).toISOString().slice(0, 10);
    mapa.set(dzien, { in: 0, out: 0 });
  }
  for (const m of movements) {
    const dzien = m.createdAt.toISOString().slice(0, 10);
    const cur = mapa.get(dzien);
    if (!cur) continue;
    if (m.delta >= 0) cur.in += m.delta;
    else cur.out += -m.delta;
  }
  return Array.from(mapa.entries()).map(([date, v]) => ({ date, ...v }));
}
