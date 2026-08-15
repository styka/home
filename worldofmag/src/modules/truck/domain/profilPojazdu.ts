/**
 * 069 (zadanie 19, rozdz. 10.1) — DOPUSZCZALNE WYMIARY POJAZDU CIĘŻAROWEGO.
 *
 * Wyprowadzone z `actions/truck.ts`. Granice nie są kaprysem formularza: trafiają jako
 * ograniczenia do wyznaczania trasy, więc **liczba spoza zakresu przekłada się na trasę
 * przejezdną tylko na papierze**. Reguła siedziała w pliku `"use server"` i nie miała testu.
 */

/** Zakres dopuszczalny dla jednego wymiaru profilu. */
export interface Zakres {
  min: number;
  max: number;
}

/**
 * Zakresy wymiarów, w jednostkach formularza: tony, metry, tony na oś.
 *
 * Górne wartości to granice realnych zestawów drogowych z zapasem (masa 120 t obejmuje transport
 * ponadnormatywny), dolne — minimum, poniżej którego dane nie opisują już pojazdu ciężarowego.
 */
export const ZAKRESY_PROFILU = {
  weight: { min: 1, max: 120 },
  height: { min: 1, max: 6 },
  length: { min: 1, max: 30 },
  width: { min: 1, max: 5 },
  axleload: { min: 0.5, max: 30 },
} as const satisfies Record<string, Zakres>;

/** Wymiary pojazdu tak, jak przychodzą z formularza. */
export type WymiaryPojazdu = { [K in keyof typeof ZAKRESY_PROFILU]: number };

/**
 * Przycina liczbę do zakresu; **wartość nieliczbowa schodzi do dolnej granicy**.
 *
 * Wybór dolnej granicy dla `NaN` jest celowy i po stronie bezpieczeństwa: pusty formularz da
 * najlżejszy i najmniejszy pojazd, czyli trasę o **najsłabszych** ograniczeniach — a nie zestaw
 * 120-tonowy, dla którego planer przepuściłby drogi, których kierowca w rzeczywistości nie przejedzie.
 */
export function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Cały profil sprowadzony do dopuszczalnych zakresów. */
export function ograniczProfil(input: WymiaryPojazdu): WymiaryPojazdu {
  return {
    weight: clamp(input.weight, ZAKRESY_PROFILU.weight.min, ZAKRESY_PROFILU.weight.max),
    height: clamp(input.height, ZAKRESY_PROFILU.height.min, ZAKRESY_PROFILU.height.max),
    length: clamp(input.length, ZAKRESY_PROFILU.length.min, ZAKRESY_PROFILU.length.max),
    width: clamp(input.width, ZAKRESY_PROFILU.width.min, ZAKRESY_PROFILU.width.max),
    axleload: clamp(input.axleload, ZAKRESY_PROFILU.axleload.min, ZAKRESY_PROFILU.axleload.max),
  };
}
