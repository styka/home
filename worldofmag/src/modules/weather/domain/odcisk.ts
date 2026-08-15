/**
 * 069 (zadanie 19, rozdz. 10.1) — ODCISK WARUNKÓW POGODOWYCH.
 *
 * Wyprowadzone z `actions/weather.ts` (`roundedBrief`, wprowadzone w 038). Nie jest to skrót do
 * czytania ani do promptu — służy **wyłącznie** do rozstrzygnięcia, czy zapamiętana treść AI jest
 * jeszcze aktualna.
 *
 * **Dlaczego zaokrąglenie jest treścią reguły, a nie kosmetyką.** Odcisk liczony z surowych
 * wartości zmieniałby się przy każdej korekcie o dziesiątą część stopnia i unieważniał zapamiętaną
 * treść bez powodu — czyli niweczył oszczędność, dla której ta pamięć powstała. Za grube
 * zaokrąglenie ma wadę odwrotną: treść zostałaby uznana za aktualną mimo realnej zmiany pogody.
 * Przyjęto: temperatura do pełnego stopnia, szansa opadów co 5 punktów procentowych.
 *
 * Pomyłka w tej regule **nie objawia się błędem** — objawia się nieaktualną treścią albo
 * rachunkiem za model. Dlatego test celuje w obie strony progu.
 */

import type { WybranaPora } from "./pora";

/** Odcisk warunków dla wybranego dnia i pory. */
export function roundedBrief(when: WybranaPora): string {
  const d = when.day;
  const head = d
    ? `${d.code}|${Math.round(d.tMin)}|${Math.round(d.tMax)}|${Math.round(d.precipProbMax / 5) * 5}`
    : "";
  const hours = when.hours
    .map((h) => `${h.code}|${Math.round(h.temp)}|${Math.round(h.precipProb / 5) * 5}`)
    .join(";");
  return `${head}#${hours}`;
}
