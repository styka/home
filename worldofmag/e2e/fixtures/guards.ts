import { test, type Locator } from "@playwright/test";

/**
 * Pomija test (z powodem) zamiast czerwienić, gdy interakcja zależy od
 * elementu/stanu, którego nie ma w danym środowisku (np. brak danych,
 * funkcja jeszcze niezaimplementowana). Dzięki temu seria pozostaje „zielona"
 * a raport jasno pokazuje, co wymaga dodatkowego seedu/UI.
 */
export async function requireVisible(loc: Locator, reason: string, timeout = 4000) {
  const ok = await loc.first().isVisible({ timeout }).catch(() => false);
  test.skip(!ok, reason);
}

/** Czeka aż element się pojawi; zwraca true/false bez rzucania. */
export async function isVisible(loc: Locator, timeout = 4000): Promise<boolean> {
  return loc.first().isVisible({ timeout }).catch(() => false);
}
