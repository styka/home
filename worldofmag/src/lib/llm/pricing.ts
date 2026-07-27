// Cennik modeli LLM (USD za 1M tokenów) — podstawa obserwowalności kosztów (log `AiCall`,
// wskaźnik kosztu pod odpowiedzią asystenta).
//
// 034: cennik żyje w BAZIE (`LlmModelPrice`, edytowalny w /admin/llm), a tablica poniżej jest tylko
// wartością startową/awaryjną — wcześniej stawki były zaszyte w kodzie, więc ich aktualizacja
// wymagała wdrożenia nowej wersji aplikacji. Odczyt jest cache'owany w module (TTL 60 s), bo
// `estimateCost` wołamy synchronicznie w gorących ścieżkach; odświeżenie robi `ensurePricesLoaded()`
// wołane z `chatComplete`/`chatStream`, które i tak idą do bazy po konfigurację modelu.
//
// To dalej SZACUNEK: rzeczywisty koszt zależy od dostawcy i planu. Model spoza cennika ma koszt
// NIEZNANY (`known: false`) — pokazujemy to wprost, zamiast udawać, że kosztował 0.

import { prisma } from "@/lib/prisma";

export interface ModelPrice {
  /** USD za 1M tokenów wejścia. */
  inputPer1M: number;
  /** USD za 1M tokenów wyjścia. */
  outputPer1M: number;
  /** Mnożnik ceny wejścia dla tokenów ODCZYTANYCH z cache promptu (Anthropic ≈ 0,1×). */
  cacheReadMult: number;
  /** Mnożnik ceny wejścia dla tokenów ZAPISANYCH do cache promptu (Anthropic ≈ 1,25×). */
  cacheWriteMult: number;
}

const DEFAULT_CACHE_READ_MULT = 0.1;
const DEFAULT_CACHE_WRITE_MULT = 1.25;

type PriceRow = { prefix: string; price: ModelPrice };

const p = (inputPer1M: number, outputPer1M: number): ModelPrice => ({
  inputPer1M,
  outputPer1M,
  cacheReadMult: DEFAULT_CACHE_READ_MULT,
  cacheWriteMult: DEFAULT_CACHE_WRITE_MULT,
});

/** Wartości startowe = to, co było zaszyte w kodzie przed 034 (migracja 0212 seeduje je do bazy). */
const FALLBACK_PRICES: PriceRow[] = [
  { prefix: "claude-sonnet-5", price: p(3.0, 15.0) },
  { prefix: "claude-haiku-4-5", price: p(1.0, 5.0) },
  { prefix: "claude-opus-4", price: p(5.0, 25.0) },
  { prefix: "claude-sonnet-4", price: p(3.0, 15.0) },
  { prefix: "claude-haiku", price: p(1.0, 5.0) },
  { prefix: "llama-3.3-70b", price: p(0.59, 0.79) },
  { prefix: "llama-3.1-8b", price: p(0.05, 0.08) },
  { prefix: "meta-llama/llama-4", price: p(0.11, 0.34) },
];

const PRICE_TTL_MS = 60_000;
let cachedPrices: PriceRow[] = FALLBACK_PRICES;
let cachedAt = 0;

/**
 * Odświeża cache cennika z bazy (najwyżej raz na `PRICE_TTL_MS`). Wołaj z warstwy asynchronicznej
 * PRZED liczeniem kosztu; błąd odczytu zostawia poprzedni cache (albo wartości startowe), żeby
 * awaria bazy nie wyzerowała kosztów.
 */
export async function ensurePricesLoaded(force = false): Promise<void> {
  if (!force && Date.now() - cachedAt < PRICE_TTL_MS) return;
  try {
    const rows = await prisma.llmModelPrice.findMany();
    cachedAt = Date.now();
    if (rows.length === 0) {
      cachedPrices = FALLBACK_PRICES;
      return;
    }
    // Dłuższy prefiks wygrywa — „claude-haiku-4-5" musi być sprawdzony przed „claude-haiku".
    cachedPrices = rows
      .map((r) => ({
        prefix: r.modelPrefix,
        price: {
          inputPer1M: r.inputPer1M,
          outputPer1M: r.outputPer1M,
          cacheReadMult: r.cacheReadMult,
          cacheWriteMult: r.cacheWriteMult,
        },
      }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
  } catch {
    cachedAt = Date.now();
  }
}

/** Wymusza ponowny odczyt cennika przy najbliższym użyciu (po edycji w panelu admina). */
export function invalidatePriceCache(): void {
  cachedAt = 0;
}

/** Cennik modelu (po dopasowaniu prefiksu) albo null, gdy nieznany. */
export function priceFor(model: string): ModelPrice | null {
  const m = model.toLowerCase();
  for (const { prefix, price } of cachedPrices) {
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

/** Koszt rozbity na składowe — dokładnie te, które pokazujemy użytkownikowi. */
export interface CostBreakdown {
  /** Łączny koszt w USD (0, gdy model nieznany). */
  usd: number;
  /** Czy model jest w cenniku. `false` = „koszt nieznany", NIE „koszt zerowy". */
  known: boolean;
  parts: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
}

/**
 * Szacowany koszt wywołania, ROZBITY na składowe. `promptTokens` to tokeny NIE-cache'owane
 * (pełna cena wejścia); tokeny cache liczone wg mnożników z cennika.
 *
 * 034: rozbicie istnieje, bo bez niego kwoty były nie do zweryfikowania — wywołanie z dużym
 * ZAPISEM do cache promptu kosztuje wielokrotnie więcej, niż sugeruje samo „wejście+wyjście",
 * a UI pokazywało tylko te dwa składniki (zgłoszenie Z7: „router 332 tok. = $0,0004" obok
 * „agent 306 tok. = $0,0090" — różnicę robiło ~6,5 tys. tokenów zapisu do cache).
 *
 * Ani wysiłek modelu, ani temperatura NIE zmieniają ceny za token — wysiłek podnosi natomiast
 * LICZBĘ tokenów wyjścia (tokeny myślenia dostawcy raportują jako wyjściowe), więc jest już
 * uwzględniony w tym rachunku.
 */
export function estimateCost(usage: CostUsage, model: string): CostBreakdown {
  const price = priceFor(model);
  if (!price) return { usd: 0, known: false, parts: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  const inRate = price.inputPer1M / 1_000_000;
  const outRate = price.outputPer1M / 1_000_000;
  const parts = {
    input: usage.promptTokens * inRate,
    output: usage.completionTokens * outRate,
    cacheRead: (usage.cacheReadTokens ?? 0) * inRate * price.cacheReadMult,
    cacheWrite: (usage.cacheWriteTokens ?? 0) * inRate * price.cacheWriteMult,
  };
  return { usd: parts.input + parts.output + parts.cacheRead + parts.cacheWrite, known: true, parts };
}

/** Sam koszt w USD (nieznany model → 0). Cienka nakładka na `estimateCost`. */
export function estimateCostUsd(usage: CostUsage, model: string): number {
  return estimateCost(usage, model).usd;
}
