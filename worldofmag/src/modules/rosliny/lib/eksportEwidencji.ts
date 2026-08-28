/**
 * 113 — EKSPORT EWIDENCJI ZABIEGÓW DO PLIKU CSV.
 *
 * **Dlaczego to jest osobny, czysty plik.** Plik z `"use server"` nie eksportuje funkcji
 * synchronicznych, więc składanie CSV zapisane wewnątrz akcji byłoby niesprawdzalne — a akurat tu
 * chodzi o dokument, którego kompletność sprawdza kontrola (AC-25).
 *
 * **Kolumny odpowiadają wprost wymaganiom obowiązującym od 1 stycznia 2026**, w tym trzem, które
 * wtedy doszły: rodzaj zastosowania środka, numer zezwolenia i dokładna lokalizacja zabiegu.
 * Kolejność kolumn jest częścią umowy z użytkownikiem: to jest dokument, który ktoś przepisze albo
 * wczyta, a nie widok, który wolno przestawić.
 *
 * **Separatorem jest średnik, a plik zaczyna się od BOM.** Nie z upodobania: polski Excel czyta CSV
 * z przecinkiem jako jedną kolumnę, a bez BOM-u rozjeżdża polskie znaki. Plik, którego adresat nie
 * potrafi otworzyć, nie jest eksportem.
 */

export interface WierszEwidencji {
  occurredAt: Date;
  spaceName: string;
  plantName: string | null;
  placeName: string | null;
  productName: string | null;
  permitNumber: string | null;
  applicationKind: string | null;
  doseValue: number | null;
  doseUnit: string | null;
  areaValue: number | null;
  areaUnit: string | null;
  locationText: string | null;
  operator: string | null;
  conditions: string | null;
  withdrawalDays: number | null;
  note: string | null;
}

export const KOLUMNY_EWIDENCJI = [
  "Data zabiegu",
  "Przestrzeń",
  "Uprawa / roślina",
  "Miejsce",
  "Nazwa środka",
  "Numer zezwolenia",
  "Rodzaj zastosowania",
  "Dawka",
  "Jednostka dawki",
  "Powierzchnia",
  "Jednostka powierzchni",
  "Dokładna lokalizacja",
  "Wykonujący",
  "Warunki",
  "Karencja (dni)",
  "Uwagi",
] as const;

/**
 * Data w formacie, który czyta i człowiek, i arkusz: `RRRR-MM-DD` — **w strefie użytkownika**.
 *
 * `getFullYear()` czytałoby instant w strefie PROCESU (na Renderze UTC), więc oprysk odhaczony
 * o 00:30 czasu polskiego trafiał do dokumentu z datą dnia POPRZEDNIEGO — a filtr okresu, który
 * porównuje instanty, wpuszczał go do zakresu zaczynającego się dopiero tego dnia. Wiersz miał
 * wtedy w dokumencie datę spoza okresu, który głosi nazwa pliku. Nazwa pliku i treść muszą liczyć
 * dzień JEDNĄ regułą, inaczej dokument dla kontroli przeczy sam sobie.
 *
 * `en-CA` daje dokładnie `RRRR-MM-DD`, bez ręcznego składania z części.
 */
export function dzien(d: Date, strefa: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: strefa,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Ucieczka pola CSV.
 *
 * Cudzysłów podwajamy, a pole obejmujemy cudzysłowami, gdy zawiera separator, cudzysłów albo
 * złamanie wiersza. Pominięcie tego przy polu „Warunki" (gdzie użytkownik wpisze zdanie
 * z przecinkiem albo średnikiem) rozjechałoby cały wiersz o jedną kolumnę — i to w dokumencie,
 * którego kompletność jest sprawdzana.
 */
function pole(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ewidencjaDoCsv(wiersze: WierszEwidencji[], strefa: string): string {
  const linie: string[] = [KOLUMNY_EWIDENCJI.join(";")];

  for (const w of wiersze) {
    linie.push(
      [
        pole(dzien(w.occurredAt, strefa)),
        pole(w.spaceName),
        pole(w.plantName),
        pole(w.placeName),
        pole(w.productName),
        pole(w.permitNumber),
        pole(w.applicationKind),
        pole(w.doseValue),
        pole(w.doseUnit),
        pole(w.areaValue),
        pole(w.areaUnit),
        pole(w.locationText),
        pole(w.operator),
        pole(w.conditions),
        pole(w.withdrawalDays),
        pole(w.note),
      ].join(";"),
    );
  }

  // BOM — bez niego polski Excel pokazuje „Å›" zamiast „ś".
  return "﻿" + linie.join("\r\n") + "\r\n";
}

/**
 * Czego brakuje w wierszu, żeby ewidencja była kompletna wobec wymogu.
 *
 * Zwracamy listę BRAKÓW, a nie `boolean`: kontrola sprawdza kompletność danych, więc użytkownik
 * musi wiedzieć, którego pola brakuje, a nie tylko że „coś jest nie tak". Wywołujący decyduje,
 * czy to ostrzeżenie, czy blokada — my nie decydujemy za niego, bo zapisu nie wolno zablokować
 * komuś, kto właśnie wrócił z pola i uzupełni numer zezwolenia wieczorem.
 */
export function brakiEwidencji(w: Partial<WierszEwidencji>): string[] {
  const braki: string[] = [];
  // Uprawa albo miejsce — kolumna „czego dotyczył zabieg". Wystarczy jedno z dwojga: oprysk bywa
  // wykonywany na całej grządce z kilkoma roślinami, a wtedy uprawę nazywa miejsce. Brak OBU
  // zostawia w dokumencie zabieg bez przedmiotu, czyli wpis, którego nie da się zweryfikować.
  if (!w.plantName?.trim() && !w.placeName?.trim()) braki.push("uprawa lub miejsce");
  if (!w.productName?.trim()) braki.push("nazwa środka");
  if (!w.permitNumber?.trim()) braki.push("numer zezwolenia");
  if (!w.applicationKind?.trim()) braki.push("rodzaj zastosowania");
  if (!w.locationText?.trim()) braki.push("dokładna lokalizacja");
  if (!(typeof w.doseValue === "number" && w.doseValue > 0)) braki.push("dawka");
  if (!(typeof w.areaValue === "number" && w.areaValue > 0)) braki.push("powierzchnia");
  if (!w.operator?.trim()) braki.push("wykonujący");
  return braki;
}

/**
 * Nazwa pliku wynika z ZAKRESU, którego dokument faktycznie dotyczy.
 *
 * Poprzednia wersja wstawiała w nazwę rok bieżący i eksportowała wszystko, co jest w bazie — więc
 * w 2028 rolnik dostawał `ewidencja-zabiegow-2028.csv` z zabiegami z 2026, 2027 i 2028. Dokument,
 * którego nazwa mówi co innego niż zawartość, jest gorszy niż jego brak: trafia do segregatora
 * i nikt go już nie otworzy, żeby sprawdzić.
 *
 * **Zakres wchodzi jako DATY KALENDARZOWE (`RRRR-MM-DD`), nie jako `Date`.** To nie jest kaprys
 * typu: `<input type="date">` daje instant o północy w strefie PRZEGLĄDARKI, a `getFullYear()`
 * na serwerze czyta go w strefie PROCESU (na Renderze UTC). Wybór „cały rok 2026" przyjeżdżał więc
 * jako `2025-12-31T23:00Z` i nazwa wychodziła `…-2025-12-31_2026-12-31.csv` — treść poprawna,
 * nazwa nie. Data kalendarzowa nie ma strefy, więc nie ma czego pomylić.
 *
 * Zakres bierzemy z filtra, gdy użytkownik go podał, a w przeciwnym razie z **dat skrajnych
 * wyeksportowanych wierszy** — nazwa opisuje wtedy to, co w pliku naprawdę jest. Cały jeden rok
 * kalendarzowy skracamy do samego roku, bo tak nazywa go wymóg (ewidencja za rok X).
 */
export function nazwaPlikuEwidencji(
  opts: { od?: string | null; do?: string | null } | undefined,
  dniWierszy: string[],
): string {
  const posortowane = [...dniWierszy].sort();
  const od = opts?.od || posortowane[0] || null;
  const doo = opts?.do || posortowane[posortowane.length - 1] || null;

  // Pusty eksport też ma prawo istnieć (dowód, że w okresie nie było zabiegów), ale nie ma z czego
  // wziąć zakresu — nazwa mówi wtedy wprost, że jest pusty, zamiast podawać zmyślony rok.
  if (!od || !doo) return "ewidencja-zabiegow-brak-zabiegow.csv";

  const rok = od.slice(0, 4);
  if (od === `${rok}-01-01` && doo === `${rok}-12-31`) return `ewidencja-zabiegow-${rok}.csv`;

  return `ewidencja-zabiegow-${od}_${doo}.csv`;
}
