// H4: niezawodność AI — rate-limit per użytkownik + strażnik współbieżności.
// Implementacja in-memory (per instancja procesu). Na free-tier Render = jedna instancja,
// więc wystarcza; przy skali (wiele instancji) docelowo Redis/DB — patrz SC2 w roadmapie.

type Window = { count: number; resetAt: number };

const minuteBuckets = new Map<string, Window>();
const hourBuckets = new Map<string, Window>();
const inFlight = new Map<string, number>();

// Limity dobrane pod realnego power-usera; chronią głównie przed pętlą/awarią klienta i kosztami.
const PER_MINUTE = 20;
const PER_HOUR = 250;
const MAX_CONCURRENT = 2; // równoległe ciężkie operacje na użytkownika

function hit(map: Map<string, Window>, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = map.get(key);
  if (!w || now >= w.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= limit) return false;
  w.count++;
  return true;
}

export type RateCheck = { ok: true } | { ok: false; retryAfterSec: number; message: string };

/** Sprawdza limit zapytań AI dla użytkownika (minuta + godzina). */
export function checkRateLimit(userId: string): RateCheck {
  if (!hit(minuteBuckets, userId, PER_MINUTE, 60_000)) {
    const w = minuteBuckets.get(userId)!;
    return { ok: false, retryAfterSec: Math.ceil((w.resetAt - Date.now()) / 1000), message: "Za dużo zapytań do asystenta w krótkim czasie. Spróbuj za chwilę." };
  }
  if (!hit(hourBuckets, userId, PER_HOUR, 3_600_000)) {
    const w = hourBuckets.get(userId)!;
    return { ok: false, retryAfterSec: Math.ceil((w.resetAt - Date.now()) / 1000), message: "Wyczerpano godzinny limit zapytań do asystenta. Spróbuj później." };
  }
  return { ok: true };
}

/** Rezerwuje slot współbieżności; zwraca funkcję zwalniającą lub null gdy zajęte. */
export function acquireSlot(userId: string): (() => void) | null {
  const cur = inFlight.get(userId) ?? 0;
  if (cur >= MAX_CONCURRENT) return null;
  inFlight.set(userId, cur + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const n = (inFlight.get(userId) ?? 1) - 1;
    if (n <= 0) inFlight.delete(userId);
    else inFlight.set(userId, n);
  };
}
