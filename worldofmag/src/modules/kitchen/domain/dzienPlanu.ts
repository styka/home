/**
 * 069 (zadanie 19, rozdz. 10.1) — KLUCZ DNIA W PLANIE POSIŁKÓW.
 *
 * Wyprowadzone z `actions/mealPlans.ts`. Reguła miała komentarz z uzasadnieniem i **zero testu** —
 * bo mieszkała w pliku `"use server"`, z którego funkcji synchronicznej nie da się wyeksportować.
 */

/**
 * Sprowadza dowolny moment do **południa UTC** tego samego dnia kalendarzowego.
 *
 * **Dlaczego południe, a nie północ.** Wpis planu dotyczy dnia, nie chwili, więc potrzebny jest
 * jeden umowny punkt w dobie. `setUTCHours(0, …)` wygląda naturalniej, ale dla stref na wschód od
 * Greenwich (w tym Polski) północ UTC to jeszcze **poprzedni** dzień lokalnie — obiad zapisany
 * w poniedziałek pokazywałby się w niedzielę. Południe UTC leży w środku doby, więc **żadne
 * przesunięcie strefowe w zakresie ±12 h nie zmienia dnia kalendarzowego**.
 */
export function dayKeyUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}
