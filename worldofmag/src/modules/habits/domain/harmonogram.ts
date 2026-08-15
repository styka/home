/**
 * 069 (zadanie 19, rozdz. 10.1) — REGUŁY HARMONOGRAMU NAWYKU.
 *
 * Wyprowadzone z `actions/habits.ts`. Powód nie jest kosmetyczny: plik `"use server"` **nie może
 * wyeksportować niczego poza funkcją asynchroniczną**, więc reguła siedząca w nim jest przymusowo
 * prywatna — nie da się jej zaimportować do testu. Te trzy funkcje podejmują decyzje dziedzinowe
 * („pełny tydzień znaczy codziennie"), a nie bronią się przed złym typem, i nie były sprawdzone
 * żadnym testem.
 *
 * Warstwa nie zna Prismy, sesji ani Reacta — pilnuje tego `npm run check:domain`.
 */

/**
 * Dni tygodnia nawyku → posortowany, unikalny CSV (0 = niedziela … 6 = sobota).
 *
 * **Pełny tydzień zapisujemy jako `null`, nie jako `"0,1,2,3,4,5,6"`.** To decyzja dziedzinowa:
 * „codziennie" i „w każdy z siedmiu dni" to ten sam nawyk, a dwa zapisy tego samego stanu
 * rozjeżdżałyby porównania i podpowiedzi. Pusty zbiór znaczy to samo co brak wskazania.
 */
export function normalizeDays(daysOfWeek?: string | null): string | null {
  if (daysOfWeek == null) return null;
  const parts = daysOfWeek
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  const uniq = Array.from(new Set(parts)).sort((a, b) => a - b);
  if (uniq.length === 0 || uniq.length === 7) return null;
  return uniq.join(",");
}

/**
 * Cel tygodniowy → liczba całkowita 1–7 albo `null`.
 *
 * Górna granica to fakt z dziedziny, nie arbitralny limit: tydzień ma siedem dni, więc cel „10 razy
 * w tygodniu" jest nawykiem, którego nie da się wykonać. Wartość poniżej 1 nie jest celem.
 */
export function normalizeGoal(weeklyGoal?: number | null): number | null {
  if (weeklyGoal == null) return null;
  const n = Math.round(Number(weeklyGoal));
  if (!Number.isInteger(n) || n < 1) return null;
  return Math.min(7, n);
}

/** Godzina przypomnienia → `HH:MM` z wiodącym zerem; wartość spoza doby przycięta do 23:59. */
export function normalizeReminder(reminderTime?: string | null): string | null {
  if (!reminderTime || !reminderTime.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(reminderTime.trim());
  if (!m) return null;
  const hh = Math.min(23, Number(m[1]));
  const mm = Math.min(59, Number(m[2]));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
