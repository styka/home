import { createHash } from "crypto";

/**
 * Z-511: lekki cache odpowiedzi LLM (in-memory, TTL + ograniczony rozmiar, LRU-ish).
 *
 * Włączany per wywołanie (opt-in) — sensowny dla operacji deterministycznych
 * (klasyfikacja/parsowanie), gdzie identyczne wejście daje identyczne wyjście, więc
 * cache oszczędza tokeny/koszt (szczególnie dla planu darmowego). Per instancja
 * procesu; przy wielu instancjach to best-effort (poprawność zachowana — to tylko
 * pominięcie powtórnego wywołania).
 */
interface Entry {
  value: string;
  model?: string;
  expiresAt: number;
}

const store = new Map<string, Entry>();
const MAX_ENTRIES = 500;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function cacheKeyFor(parts: unknown): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export function getCached(key: string): { value: string; model?: string } | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() >= e.expiresAt) {
    store.delete(key);
    return null;
  }
  // odśwież pozycję (LRU): usuń i wstaw ponownie na koniec kolejności
  store.delete(key);
  store.set(key, e);
  return { value: e.value, model: e.model };
}

export function setCached(key: string, value: string, model?: string, ttlMs = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, model, expiresAt: Date.now() + ttlMs });
}
