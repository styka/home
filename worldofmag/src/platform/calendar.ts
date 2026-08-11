/**
 * 049 — WKŁAD MODUŁU DO WSPÓLNEJ AGENDY (rozdz. 9.3).
 *
 * Kalendarz agregował dotąd dane sześciu modułów **sam**: jedno `Promise.all` z dziewięcioma
 * zapytaniami do cudzych tabel i dziewięć pętli mapujących. Formalnie nie łamało to granicy
 * (Prisma to nie moduł), ale znaczyło dokładnie to samo: dodanie modułu ze zdarzeniami wymagało
 * edycji cudzego pliku, a moduł nie miał jak wnieść swojego wkładu.
 *
 * Typ jest **niewiedzący o żadnym module**: dostaje `userId` i zakres dat, oddaje zdarzenia.
 * Kto je wnosi, rozstrzyga korzeń kompozycji (C-36).
 */

/** Zakres, o który pyta kalendarz — półotwarty `[from, to)`, tak jak `monthRange`. */
export interface CalendarRange {
  from: Date;
  to: Date;
}

/**
 * Zdarzenie w agendzie. `module` jest identyfikatorem modułu, ale platforma go **nie interpretuje**
 * — przekazuje dalej do warstwy, która zna kolory i etykiety.
 */
export interface CalendarContribEvent {
  id: string;
  module: string;
  title: string;
  date: string;
  at: string | null;
  href: string;
  accent: string;
}

export type CalendarContributor = (
  userId: string,
  range: CalendarRange,
) => Promise<CalendarContribEvent[]>;
