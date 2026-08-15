/**
 * 069 (zadanie 19, rozdz. 10.1) — WYBÓR DNIA I PORY Z PROGNOZY.
 *
 * Wyprowadzone z `actions/weather.ts`. Reguła wspólna dla listy propozycji „Co robić?" i dla
 * szczegółowego planu — decyduje, **których godzin prognozy dotyczy wygenerowana treść**.
 *
 * **Zmiana kształtu wymuszona testowalnością (AC-8):** wartość awaryjna daty czytała zegar
 * (`new Date().toISOString()`). Teraz „teraz" wchodzi parametrem z domyślnym `new Date()`, więc
 * wywołanie w akcji jest znakowo identyczne, a test może sprawdzić pustą prognozę.
 */

import { DAY_PARTS, type DayPart } from "../lib/presets";
import type { Forecast, HourPoint, DayPoint } from "../lib/openMeteo";

export interface WybranaPora {
  date: string;
  part: (typeof DAY_PARTS)[number];
  hours: HourPoint[];
  day: DayPoint | undefined;
}

/**
 * Rozstrzyga dzień i porę, na które patrzymy.
 *
 * Trzy zachowania zapasowe, każde z innego powodu:
 * 1. **Data spoza prognozy** → pierwszy dzień prognozy. Użytkownik prosi o dzień, którego model nie
 *    obejmuje; pokazanie najbliższego jest lepsze niż pustka.
 * 2. **Pora bez godzin** → wszystkie godziny tego dnia. Prognoza godzinowa bywa krótsza niż dobowa,
 *    więc „wieczór" na ostatnim dniu potrafi nie mieć ani jednej godziny — a wtedy treść liczona
 *    z pustego zbioru nie mówiłaby nic.
 * 3. **Pusta prognoza** → dzisiejsza data z podanego „teraz".
 */
export function resolveWhen(
  f: Forecast,
  opts?: { date?: string; part?: DayPart },
  teraz = new Date()
): WybranaPora {
  const date =
    opts?.date && f.daily.some((d) => d.date === opts.date)
      ? opts.date
      : f.daily[0]?.date ?? teraz.toISOString().slice(0, 10);
  const partKey: DayPart = opts?.part ?? "morning";
  const part = DAY_PARTS.find((p) => p.key === partKey) ?? DAY_PARTS[0];
  let hours = f.hourly.filter((h) => {
    if (!h.time.startsWith(date)) return false;
    const hour = Number(h.time.slice(11, 13));
    return hour >= part.from && hour < part.to;
  });
  if (hours.length === 0) hours = f.hourly.filter((h) => h.time.startsWith(date));
  const day = f.daily.find((d) => d.date === date);
  return { date, part, hours, day };
}
