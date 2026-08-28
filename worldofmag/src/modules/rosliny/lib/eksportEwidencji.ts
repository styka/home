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

/** Data w formacie, który czyta i człowiek, i arkusz: `RRRR-MM-DD`. */
function dzien(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

export function ewidencjaDoCsv(wiersze: WierszEwidencji[]): string {
  const linie: string[] = [KOLUMNY_EWIDENCJI.join(";")];

  for (const w of wiersze) {
    linie.push(
      [
        pole(dzien(w.occurredAt)),
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
  if (!w.productName?.trim()) braki.push("nazwa środka");
  if (!w.permitNumber?.trim()) braki.push("numer zezwolenia");
  if (!w.applicationKind?.trim()) braki.push("rodzaj zastosowania");
  if (!w.locationText?.trim()) braki.push("dokładna lokalizacja");
  if (!(typeof w.doseValue === "number" && w.doseValue > 0)) braki.push("dawka");
  if (!(typeof w.areaValue === "number" && w.areaValue > 0)) braki.push("powierzchnia");
  if (!w.operator?.trim()) braki.push("wykonujący");
  return braki;
}
