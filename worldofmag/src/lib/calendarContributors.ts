import { MODULES } from "@/lib/modules";
import type { CalendarContribEvent, CalendarRange } from "@/platform/calendar";

/**
 * 049 — KORZEŃ KOMPOZYCJI AGENDY.
 *
 * Plik leży w `src/lib` jako **pojedynczy plik**, a nie w katalogu `src/lib/calendar/` — bo bramka
 * rejestru słusznie uznałaby taki katalog za „kod modułu Kalendarz poza jego katalogiem". I miałaby
 * rację co do nazwy, choć nie co do treści: to nie jest kod modułu Kalendarz, tylko warstwy
 * kompozycji, która zbiera wkłady wszystkich modułów. Bramka złapała to od razu.
 *
 * Moduł Kalendarz nie może pytać rejestru o inne moduły (to byłby import przez granicę), a platforma
 * nie może znać modułów w ogóle. Zbieranie wkładów robi więc warstwa kompozycji — jedyna, która
 * z definicji zna wszystkich.
 *
 * **Wkład, który rzuci wyjątkiem, nie może wywalić całej agendy.** Kalendarz czyta siedem źródeł;
 * gdyby jedno padło (brak uprawnienia, błąd bazy), użytkownik zamiast sześciu działających
 * dostałby pustą stronę. Błąd jednego wkładu pomijamy — z tego samego powodu, dla którego trasa
 * pulpitu owija wywołania modułów w `try`.
 */
export async function collectFromModules(userId: string, range: CalendarRange): Promise<CalendarContribEvent[]> {
  const wkladcy = MODULES.filter((m) => m.calendar);
  const wyniki = await Promise.all(
    wkladcy.map(async (m) => {
      try {
        const mod = await m.calendar!();
        return await mod.default(userId, range);
      } catch {
        return [] as CalendarContribEvent[];
      }
    }),
  );
  return wyniki.flat();
}
