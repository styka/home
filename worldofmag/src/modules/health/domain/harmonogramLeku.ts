/**
 * 069 (zadanie 19, rozdz. 10.1) — REGUŁY HARMONOGRAMU LEKU I PIELĘGNACJI.
 *
 * Wyprowadzone z `actions/medications.ts`, gdzie były przymusowo prywatne (plik `"use server"`
 * eksportuje wyłącznie funkcje asynchroniczne). To reguły o wysokiej cenie pomyłki: ich wynik
 * decyduje, **o której godzinie i w jakie dni** pojawi się przypomnienie o leku.
 *
 * Warstwa nie zna Prismy, sesji ani Reacta — pilnuje tego `npm run check:domain`.
 */

import type { MedicationFreqType } from "@/types";

/**
 * Godziny podania → JSON `["HH:MM", …]`, posortowane i bez powtórzeń.
 *
 * Sortowanie jest częścią reguły, nie kosmetyką: agenda „na dziś" idzie po tej liście po kolei,
 * więc `["20:00","08:00"]` pokazałoby wieczorną dawkę przed poranną. Uzupełnienie wiodącego zera
 * jest po to, żeby sortowanie napisów pokrywało się z porządkiem godzin (`"8:00"` sortuje się po
 * `"20:00"`, `"08:00"` — przed).
 *
 * Brak poprawnej godziny daje `null`, czyli harmonogram bez wyznaczonych pór.
 */
export function normTimes(times: string[] | string | null | undefined): string | null {
  let arr: string[];
  if (Array.isArray(times)) arr = times;
  else if (typeof times === "string" && times.trim()) {
    arr = times.split(",").map((t) => t.trim());
  } else return null;
  const valid = Array.from(
    new Set(
      arr
        .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
        .map((t) => {
          const [h, m] = t.split(":");
          return `${h.padStart(2, "0")}:${m}`;
        })
    )
  ).sort();
  return valid.length ? JSON.stringify(valid) : null;
}

/** Dni tygodnia → CSV `"1,3,5"` (0 = niedziela … 6 = sobota), unikalne i posortowane. */
export function normDays(days: number[] | string | null | undefined): string | null {
  let arr: number[];
  if (Array.isArray(days)) arr = days;
  else if (typeof days === "string" && days.trim()) arr = days.split(",").map((d) => Number(d.trim()));
  else return null;
  const valid = Array.from(new Set(arr.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
  return valid.length ? valid.join(",") : null;
}

/**
 * Rodzaj częstotliwości; **wartość nieznana schodzi do `DAILY`**.
 *
 * To celowy wybór bezpieczniejszej strony: harmonogram leku z nierozpoznaną częstotliwością lepiej,
 * żeby przypominał codziennie (użytkownik zobaczy i poprawi), niż żeby zamilkł.
 */
export function normFreq(v: string | null | undefined): MedicationFreqType {
  return v === "WEEKLY" || v === "HOURLY" ? v : "DAILY";
}
