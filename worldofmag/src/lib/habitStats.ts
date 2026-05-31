// Czyste funkcje pomocnicze dla nawyków: daty lokalne ("YYYY-MM-DD"),
// harmonogram (dni tygodnia), streaki i postęp tygodniowy. Bez zależności od
// Prisma/React — łatwe do testów i współdzielone między serwerem a klientem.

/** Lokalna data jako "YYYY-MM-DD" (bez strefy czasowej). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return isoDate(new Date());
}

/** "YYYY-MM-DD" → Date w lokalne południe (stabilne wobec DST). */
export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/** Zbiór dni tygodnia (0=niedz..6=sob) lub null = codziennie. */
export function parseDays(daysOfWeek: string | null | undefined): Set<number> | null {
  if (!daysOfWeek || !daysOfWeek.trim()) return null;
  const set = new Set<number>();
  for (const part of daysOfWeek.split(",")) {
    const n = Number(part.trim());
    if (Number.isInteger(n) && n >= 0 && n <= 6) set.add(n);
  }
  return set.size > 0 ? set : null;
}

/** Czy nawyk jest zaplanowany na dany dzień (wg daysOfWeek; null = codziennie). */
export function isScheduledOn(daysOfWeek: string | null | undefined, date: Date): boolean {
  const days = parseDays(daysOfWeek);
  if (!days) return true;
  return days.has(date.getDay());
}

/** Dodaje `n` dni do daty (kopia, lokalne południe). */
function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  c.setDate(c.getDate() + n);
  return c;
}

/**
 * Bieżący i najdłuższy streak liczony po DNIACH ZAPLANOWANYCH.
 * - currentStreak: kolejne zaplanowane dni wykonane, licząc wstecz od dziś.
 *   Niewykonany DZISIEJSZY dzień nie zrywa streaka (jeszcze jest czas) — pomijamy go.
 * - longestStreak: najdłuższa seria wykonanych zaplanowanych dni w zakresie wpisów.
 */
export function computeStreaks(
  entryDates: string[],
  daysOfWeek: string | null | undefined
): { currentStreak: number; longestStreak: number } {
  const done = new Set(entryDates);
  const today = new Date();
  const todayStr = isoDate(today);

  // ── currentStreak ──
  let current = 0;
  let cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
  // Maksymalnie 2 lata wstecz — bezpiecznik przeciw nieskończonej pętli.
  for (let i = 0; i < 740; i++) {
    const ds = isoDate(cursor);
    const scheduled = isScheduledOn(daysOfWeek, cursor);
    if (scheduled) {
      if (done.has(ds)) {
        current++;
      } else if (ds === todayStr) {
        // dziś jeszcze nieodhaczone — nie zrywaj, daj szansę do końca dnia
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }

  // ── longestStreak ──
  let longest = 0;
  if (entryDates.length > 0) {
    const sorted = Array.from(new Set(entryDates)).sort();
    const start = fromISO(sorted[0]);
    let run = 0;
    let c = start;
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
    let guard = 0;
    while (c.getTime() <= end.getTime() && guard < 5000) {
      guard++;
      if (isScheduledOn(daysOfWeek, c)) {
        if (done.has(isoDate(c))) {
          run++;
          if (run > longest) longest = run;
        } else {
          run = 0;
        }
      }
      c = addDays(c, 1);
    }
  }
  if (current > longest) longest = current;
  return { currentStreak: current, longestStreak: longest };
}

/** Poniedziałek bieżącego tygodnia (lokalnie, południe). */
export function startOfWeek(date: Date): Date {
  const c = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const dow = c.getDay(); // 0=niedz
  const diff = dow === 0 ? -6 : 1 - dow; // tydzień zaczyna się w poniedziałek
  return addDays(c, diff);
}

/** Postęp w bieżącym tygodniu: ile zaplanowanych dni wykonano vs cel. */
export function weekProgress(
  entryDates: string[],
  daysOfWeek: string | null | undefined
): { done: number; target: number } {
  const set = new Set(entryDates);
  const monday = startOfWeek(new Date());
  const todayStr = todayISO();
  let done = 0;
  let target = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    const ds = isoDate(day);
    if (ds > todayStr) break; // nie licz przyszłych dni tygodnia
    if (isScheduledOn(daysOfWeek, day)) {
      target++;
      if (set.has(ds)) done++;
    }
  }
  return { done, target };
}
