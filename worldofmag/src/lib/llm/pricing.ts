// Szacunkowy cennik modeli LLM (USD za 1M tokenów) — do obserwowalności kosztów
// (log AiCall). To SZACUNEK: rzeczywisty koszt zależy od dostawcy/planu i może się
// zmienić. Nieznany model → koszt 0 (log i tak niesie tokeny/czas).
//
// Źródła: Anthropic (Sonnet 5 / Haiku 4.5) — cennik publiczny; Groq (Llama) — orientacyjnie.

export interface ModelPrice {
  /** USD za 1M tokenów wejścia. */
  inputPer1M: number;
  /** USD za 1M tokenów wyjścia. */
  outputPer1M: number;
}

// Mnożniki cache promptu Anthropic względem ceny wejścia.
const CACHE_READ_MULT = 0.1; // odczyt z cache ≈ 0.1× input
const CACHE_WRITE_MULT = 1.25; // zapis do cache (5 min TTL) ≈ 1.25× input

// Dopasowanie po prefiksie nazwy modelu (id bywają z sufiksami/wersjami).
const PRICES: Array<{ prefix: string; price: ModelPrice }> = [
  // Anthropic (rekomendowany profil asystenta)
  { prefix: "claude-sonnet-5", price: { inputPer1M: 3.0, outputPer1M: 15.0 } },
  { prefix: "claude-haiku-4-5", price: { inputPer1M: 1.0, outputPer1M: 5.0 } },
  { prefix: "claude-opus-4", price: { inputPer1M: 5.0, outputPer1M: 25.0 } },
  { prefix: "claude-sonnet-4", price: { inputPer1M: 3.0, outputPer1M: 15.0 } },
  { prefix: "claude-haiku", price: { inputPer1M: 1.0, outputPer1M: 5.0 } },
  // Groq / Llama (dostawca domyślny) — orientacyjnie, niski koszt
  { prefix: "llama-3.3-70b", price: { inputPer1M: 0.59, outputPer1M: 0.79 } },
  { prefix: "llama-3.1-8b", price: { inputPer1M: 0.05, outputPer1M: 0.08 } },
  { prefix: "meta-llama/llama-4", price: { inputPer1M: 0.11, outputPer1M: 0.34 } },
];

/** Cennik modelu (po dopasowaniu prefiksu) albo null, gdy nieznany. */
export function priceFor(model: string): ModelPrice | null {
  const m = model.toLowerCase();
  for (const { prefix, price } of PRICES) {
    if (m.startsWith(prefix.toLowerCase())) return price;
  }
  return null;
}

export interface CostUsage {
  promptTokens: number;
  completionTokens: number;
  /** Tokeny odczytane z cache promptu (Anthropic), liczone taniej. */
  cacheReadTokens?: number;
  /** Tokeny zapisane do cache promptu (Anthropic), liczone drożej. */
  cacheWriteTokens?: number;
}

/**
 * Szacowany koszt wywołania w USD. `promptTokens` to tokeny NIE-cache'owane
 * (pełna cena wejścia); tokeny cache liczone wg mnożników. Nieznany model → 0.
 */
export function estimateCostUsd(usage: CostUsage, model: string): number {
  const price = priceFor(model);
  if (!price) return 0;
  const inRate = price.inputPer1M / 1_000_000;
  const outRate = price.outputPer1M / 1_000_000;
  const cost =
    usage.promptTokens * inRate +
    usage.completionTokens * outRate +
    (usage.cacheReadTokens ?? 0) * inRate * CACHE_READ_MULT +
    (usage.cacheWriteTokens ?? 0) * inRate * CACHE_WRITE_MULT;
  return cost;
}
