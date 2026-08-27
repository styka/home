/**
 * 107 — REGUŁY ROZMOWY, bez bazy, bez Reacta, bez sesji.
 *
 * **Dlaczego to nie mieszka w pliku akcji.** Plik z `"use server"` nie eksportuje funkcji
 * synchronicznych, więc zawartej w nim reguły nie da się zaimportować do testu — jest
 * niesprawdzalna, choćby była prosta (ta sama lekcja, co w module YouTube).
 *
 * Trzy reguły, które łatwo napisać źle i trudno zauważyć:
 *
 *  1. **„Pisze…" liczymy z TTL przy odczycie**, nie kasujemy znacznika w tle. Gdyby wygaszanie
 *     wymagało zapisu, zamknięcie karty w trakcie pisania zostawiłoby rozmówcę z wiecznym
 *     „pisze…" — bo nikt już tego zapisu nie wykona.
 *  2. **Nieprzeczytane liczymy względem `przeczytaneDo`, a WŁASNE wiadomości pomijamy.** Bez tego
 *     wysłanie wiadomości podbijałoby licznik nadawcy.
 *  3. **„Przeczytano" to stan CUDZYCH znaczników**, nie własnego — nadawca pyta, czy dotarło do
 *     drugiej strony.
 */

/** Ile czasu od ostatniego sygnału uznajemy, że rozmówca nadal pisze. */
export const TTL_PISANIA_MS = 6_000;

export interface UczestnikRozmowy {
  userId: string;
  nazwa: string;
  przeczytaneDo: Date | null;
  pisalAt: Date | null;
}

/**
 * Czy uczestnik pisze W TEJ CHWILI. `teraz` jest parametrem, nie `Date.now()` w środku — reguła
 * ma być sprawdzalna bez sterowania zegarem.
 */
export function czyPisze(pisalAt: Date | null, teraz: Date): boolean {
  if (!pisalAt) return false;
  const roznica = teraz.getTime() - pisalAt.getTime();
  // Ujemna różnica (znacznik „z przyszłości", np. rozjazd zegarów) to nie jest pisanie sprzed
  // chwili — traktujemy ją jak brak sygnału, zamiast pokazywać „pisze…" w nieskończoność.
  return roznica >= 0 && roznica < TTL_PISANIA_MS;
}

/** Kto z POZOSTAŁYCH uczestników pisze w tej chwili. */
export function piszacy(uczestnicy: UczestnikRozmowy[], jaId: string, teraz: Date): string[] {
  return uczestnicy
    .filter((u) => u.userId !== jaId && czyPisze(u.pisalAt, teraz))
    .map((u) => u.nazwa);
}

/**
 * Czy wolno edytować albo usunąć wiadomość. Jedyna reguła: **własna i nieusunięta**.
 *
 * To jest reguła prezentacji — serwer i tak sprawdza autorstwo przy każdej mutacji. Gdyby
 * istniała wyłącznie tutaj, wystarczyłoby wywołać akcję wprost (AC-21).
 */
export function czyMozeEdytowac(
  wiadomosc: { autorId: string; deletedAt: Date | null },
  userId: string,
): boolean {
  return wiadomosc.autorId === userId && wiadomosc.deletedAt === null;
}

/**
 * Ile wiadomości w rozmowie jest dla mnie nowych.
 *
 * `przeczytaneDo === null` znaczy „nie otwierałem tej rozmowy", więc nowe jest wszystko cudze —
 * a nie „nic", co byłoby naturalnym skutkiem porównania z pustą datą.
 */
export function policzNieprzeczytane(
  wiadomosci: { autorId: string; createdAt: Date; deletedAt: Date | null }[],
  jaId: string,
  przeczytaneDo: Date | null,
): number {
  return wiadomosci.filter(
    (w) =>
      w.autorId !== jaId &&
      w.deletedAt === null &&
      (przeczytaneDo === null || w.createdAt > przeczytaneDo),
  ).length;
}

/**
 * Czy MOJA wiadomość została przeczytana przez kogoś innego — i przez kogo.
 *
 * Zwracamy listę nazw, a nie samo „tak/nie", bo w kanale zespołu „przeczytano" bez wskazania kto
 * nie niesie informacji: przeczytała jedna osoba z ośmiu czy wszystkie osiem?
 */
export function ktoPrzeczytal(
  wiadomosc: { createdAt: Date },
  uczestnicy: UczestnikRozmowy[],
  autorId: string,
): string[] {
  return uczestnicy
    .filter((u) => u.userId !== autorId && u.przeczytaneDo !== null && u.przeczytaneDo >= wiadomosc.createdAt)
    .map((u) => u.nazwa);
}

/**
 * Etykieta rozmowy na liście.
 *
 * Kanał zespołu ma własny tytuł. Rozmowa prywatna nazywa się **drugą osobą** — i dlatego nazwę
 * wolno wyliczyć dopiero z listy uczestników, którą serwer wydaje po sprawdzeniu uczestnictwa.
 * Rozmowa bez drugiej strony (konto usunięte) dostaje etykietę zastępczą zamiast pustego wiersza.
 */
export function etykietaRozmowy(
  rozmowa: { rodzaj: string; tytul: string | null },
  uczestnicy: UczestnikRozmowy[],
  jaId: string,
  etykietaBezRozmowcy: string,
): string {
  if (rozmowa.rodzaj === "zespol") return rozmowa.tytul ?? etykietaBezRozmowcy;
  const inni = uczestnicy.filter((u) => u.userId !== jaId);
  return inni.length > 0 ? inni.map((u) => u.nazwa).join(", ") : etykietaBezRozmowcy;
}
