import { unstable_cache } from "next/cache";
import { getAccessContext } from "@/platform/sharing/cache";
import { stempelPrzestrzeni, TTL_AGREGATU_SEK } from "@/platform/cache/stempel";
import { collectDashboardSnapshot } from "@/lib/dashboardSnapshot";
import { collectCalendarEvents } from "@/lib/calendarAgenda";
import type { DashboardSnapshot } from "@/modules/home/contract";
import type { CalendarEvent } from "@/modules/calendar/contract";
import type { DashboardContext } from "@/platform/dashboard";

/**
 * 085 (zadanie 29, Faza 5) — CACHE AGREGATÓW.
 *
 * Dwa agregaty z rozdz. 11.5: migawka pulpitu i agenda kalendarza. Oba są składane z kilkunastu
 * wkładów modułowych (084 zmierzył: 11 i 14 zapytań), oba są czytane przy każdym wejściu na stronę
 * i oba prawie nigdy nie zmieniają się między tymi wejściami.
 *
 * **Korzeń kompozycji, nie platforma** — bo składanie wymaga listy modułów, a platformie jej nie
 * wolno znać (C-36). Platforma daje sam stempel (`platform/cache/stempel.ts`).
 *
 * ### Trzy rzeczy w kluczu i każda z osobnego powodu
 *
 * 1. **`userId`** — oczywiste; wspólny klucz byłby wyciekiem danych między kontami.
 * 2. **Stempel przestrzeni** — unieważnianie. Wciągnięte do klucza zamiast wypychane
 *    `revalidateTag`-iem, bo tag unieważnia cache JEDNEJ instancji (uzasadnienie przy stemplu).
 * 3. **Odcisk uprawnień** — migawka pulpitu zawiera tylko te moduły, do których użytkownik ma
 *    prawo. Bez uprawnień w kluczu odebranie dostępu do modułu zostawiłoby jego dane w cache'u
 *    i pokazywałoby je do wygaśnięcia wpisu. To jest ta sama klasa błędu, przed którą ostrzega
 *    rozdz. 11.1.3 — z tą różnicą, że tutaj da się jej uniknąć bez żadnego mechanizmu.
 *
 * ### Czego świadomie NIE cache'ujemy
 *
 * **Rozstrzygnięcia dostępu** (`access:<userId>:<resourceType>:<resourceId>` z tabeli w rozdz. 11.5)
 * i **listy przestrzeni użytkownika**. Rozdz. 11.5 sam nazywa pierwszy z nich „najważniejszym
 * i najbardziej ryzykownym" i odsyła do 11.1.3: cache dostępu bez natychmiastowego unieważnienia
 * to dziura bezpieczeństwa wprowadzona przez optymalizację. Unieważniać miałyby go zdarzenia
 * `sharing.grant.*` — a **strona zapisu nadań nie istnieje** (zadanie 14 jest w toku), więc nie ma
 * dziś producenta tych zdarzeń. Kolejność jest tu jednokierunkowa: najpierw zdarzenie, potem cache.
 * Do tego czasu obowiązuje zakres żądania (052) i zakres operacji (084) — memoizacja, która znika
 * razem z pracą, więc nie ma czego unieważniać. Test odwołania dostępu (063) pilnuje, żeby ta
 * decyzja nie zmieniła się po cichu.
 */

/** Odcisk uprawnień — stabilny (sortowany), krótki, bez ujawniania pełnej listy w kluczu cache'u. */
export function odciskUprawnien(permissions: string[]): string {
  const posortowane = [...permissions].sort().join(",");
  let h = 0;
  for (let i = 0; i < posortowane.length; i++) h = (Math.imul(31, h) + posortowane.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Klucz cache'u migawki — wydzielony, żeby dał się sprawdzić testem. Bez tego jedynym sposobem na
 * udowodnienie, że uprawnienia SĄ w kluczu, byłoby zaufanie lekturze.
 */
export function kluczPulpitu(userId: string, stempel: string, permissions: string[]): string[] {
  return ["dashboard", userId, stempel, odciskUprawnien(permissions)];
}

export async function cachowanaMigawkaPulpitu(
  userId: string,
  permissions: string[],
  ctx: DashboardContext,
): Promise<DashboardSnapshot> {
  const { workspaceIds } = await getAccessContext(userId);
  const stempel = await stempelPrzestrzeni(workspaceIds);
  const klucz = kluczPulpitu(userId, stempel, permissions);
  // `ctx` (granice dnia) celowo NIE wchodzi do klucza: to bieżący czas, więc każde wejście miałoby
  // inny klucz i cache nigdy by nie trafił. Przesunięcie doby pokrywa TTL — 60 s nieaktualnej
  // granicy dnia o północy jest niezauważalne, a klucz z zegarem byłby cache'em bez trafień.
  return unstable_cache(() => collectDashboardSnapshot(userId, permissions, ctx), klucz, {
    revalidate: TTL_AGREGATU_SEK,
  })();
}

export async function cachowanaAgenda(userId: string, year: number, month0: number): Promise<CalendarEvent[]> {
  const { workspaceIds } = await getAccessContext(userId);
  const stempel = await stempelPrzestrzeni(workspaceIds);
  return unstable_cache(
    () => collectCalendarEvents(userId, year, month0),
    ["calendar-events", userId, String(year), String(month0), stempel],
    { revalidate: TTL_AGREGATU_SEK, tags: [`calendar:${userId}`] },
  )();
}
