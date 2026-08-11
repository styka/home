// Pacing pod limit tokenów-na-minutę (TPM) dostawcy LLM — głównie Groq (free-tier
// llama-3.3-70b: 12000 TPM). Problem: proste zapytanie do asystenta odpala kilka
// wywołań modelu w tej samej minucie; ich SUMA tokenów przebija TPM i dostawca
// zwraca 429 za każdym razem — retry tego nie ratuje, bo okno się nie zwalnia.
//
// Rozwiązanie: przed każdym wywołaniem do dostawcy z limitem rezerwujemy szacowaną
// liczbę tokenów w kroczącym oknie 60 s; gdy okno nie ma miejsca, CZEKAMY aż
// najstarsze rezerwacje z niego wypadną. Świadomie wolimy „wolniej, ale działa"
// (zgodnie z decyzją właściciela) niż surowy błąd limitu. In-memory per proces —
// na free-tier Render to jedna instancja, więc wystarcza (jak rateLimit.ts).

type Reservation = { at: number; tokens: number };

const windows = new Map<string, Reservation[]>();
const WINDOW_MS = 60_000;

// Domyślny TPM (Groq free-tier). Nadpisywalny przez env GROQ_TPM_LIMIT, gdyby
// właściciel miał wyższy plan. Trzymamy margines (używamy CAP_RATIO limitu), bo
// nasze szacowanie tokenów jest przybliżone (dostawca liczy nieco inaczej).
const DEFAULT_TPM = 12_000;
const CAP_RATIO = 0.9;
const MAX_WAIT_TOTAL_MS = 30_000; // twardy limit łącznego oczekiwania (nie wisimy w nieskończoność)

// 025-assistant-chat-reliability-ux: limity TPM RÓŻNIĄ SIĘ per model (Groq free-tier).
// Wcześniej wszystkie modele capowaliśmy jednym DEFAULT_TPM=12000 — przez to zapytanie
// ~7,5k tokenów przechodziło rezerwację i lądowało na llama-3.1-8b-instant (limit 6000
// TPM), gdzie dostawca odbijał je 413 „Request too large". Trzymamy limit per model, żeby
// pacing (i logika pomijania w chat.ts) liczyły się wobec RZECZYWISTEGO limitu modelu.
const MODEL_TPM: Record<string, number> = {
  "llama-3.3-70b-versatile": 12_000,
  "llama-3.1-8b-instant": 6_000,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Szacunek tokenów wiadomości (proste ~4 znaki/token) — do rezerwacji w oknie TPM. */
export function estimateTokens(text: string): number {
  return Math.ceil((text?.length ?? 0) / 4);
}

/**
 * Limit TPM dla konkretnego modelu. Globalny override `GROQ_TPM_LIMIT` (env) ma
 * pierwszeństwo (gdyby właściciel miał wyższy plan); inaczej limit per model z mapy,
 * a w ostateczności DEFAULT_TPM.
 */
export function modelTpmLimit(model?: string): number {
  const env = Number(process.env.GROQ_TPM_LIMIT);
  if (Number.isFinite(env) && env > 0) return env;
  if (model && MODEL_TPM[model]) return MODEL_TPM[model];
  return DEFAULT_TPM;
}

function tpmLimitFor(model?: string): number {
  return modelTpmLimit(model);
}

function usedTokens(key: string, now: number): number {
  const fresh = (windows.get(key) ?? []).filter((r) => now - r.at < WINDOW_MS);
  windows.set(key, fresh);
  return fresh.reduce((s, r) => s + r.tokens, 0);
}

/**
 * Rezerwuje `tokens` w oknie minutowym dla `key` (np. model). Czeka, aż będzie
 * miejsce pod capem (CAP_RATIO * TPM). Zwraca faktyczny czas oczekiwania (ms) —
 * do diagnostyki. Nie rzuca; po MAX_WAIT_TOTAL_MS przepuszcza (retry/backoff w
 * chat.ts jest drugą linią obrony).
 */
export async function reserveTpm(key: string, tokens: number, limit = tpmLimitFor(key)): Promise<number> {
  const cap = Math.max(1, Math.floor(limit * CAP_RATIO));
  const need = Math.min(Math.max(1, tokens), cap); // pojedyncze żądanie nie przekroczy capu
  const startedAt = Date.now();
  for (;;) {
    const now = Date.now();
    if (usedTokens(key, now) + need <= cap) {
      const arr = windows.get(key) ?? [];
      arr.push({ at: now, tokens: need });
      windows.set(key, arr);
      return now - startedAt;
    }
    if (now - startedAt >= MAX_WAIT_TOTAL_MS) {
      // Przepuść mimo braku miejsca — niech zadziała retry/backoff/fallback dostawcy.
      const arr = windows.get(key) ?? [];
      arr.push({ at: now, tokens: need });
      windows.set(key, arr);
      return now - startedAt;
    }
    // Poczekaj aż najstarsza rezerwacja wypadnie z okna (min. 250 ms, max 3 s na krok).
    const arr = windows.get(key) ?? [];
    const oldest = arr[0];
    const wait = oldest ? Math.max(250, WINDOW_MS - (now - oldest.at)) : 500;
    await sleep(Math.min(wait, 3_000));
  }
}
