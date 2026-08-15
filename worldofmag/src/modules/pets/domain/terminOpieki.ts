/**
 * 069 (zadanie 19, rozdz. 10.1) — NASTĘPNY TERMIN ZADANIA OPIEKI.
 *
 * Wyprowadzone z `actions/petCare.ts`. Reguła nawrotu z **ucięciem po dacie końca** — czyli
 * decyzja „czy to zadanie jeszcze się powtórzy". Mieszkała w pliku `"use server"` i nie miała testu.
 *
 * `computeNextDue` pochodzi ze wspólnego `@/lib/recurrence` — pliku **czystego i współdzielonego
 * przez kilka modułów**, więc zgodnie z regułą przynależności z CLAUDE.md zostaje tam, gdzie jest.
 */

import { computeNextDue } from "@/lib/recurrence";
import type { RecurringRule } from "@/types";

/**
 * Następny termin po `base` dla podanej reguły nawrotu.
 *
 * Zwraca `null` w trzech różnych sytuacjach, które dla wywołującego znaczą to samo („nie planuj
 * kolejnego"), ale biorą się skądinąd: zadanie jednorazowe (brak reguły), reguła bez kolejnego
 * wystąpienia, oraz **termin wypadający po dacie zakończenia reguły**. Ten trzeci przypadek jest
 * właściwą treścią tej funkcji — samo `computeNextDue` o `endDate` nie wie.
 */
export function nextDueFrom(base: Date, rule: RecurringRule | null): Date | null {
  if (!rule) return null;
  const next = computeNextDue(base, rule);
  if (!next) return null;
  if (rule.endDate && next > new Date(rule.endDate)) return null;
  return next;
}
