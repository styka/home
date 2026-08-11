// 033: POZIOM WYSIŁKU („effort") modelu LLM — jedno miejsce tłumaczenia wspólnej skali na parametr
// właściwy dla dostawcy.
//
// Problem: „effort" znaczy co innego u każdego dostawcy. Anthropic ma rozszerzone myślenie z
// budżetem tokenów, modele rozumujące zgodne z OpenAI mają `reasoning_effort`, a zwykłe modele
// czatowe (np. llama na Groqu) nie mają tego wcale — i potrafią odrzucić nieznany parametr błędem
// 400. To groźne, bo 400 jest NIEPRZEJŚCIOWY (`isRetryableLlmStatus` → false), więc przerywa
// łańcuch fallbacku i wywala całego agenta.
//
// Dlatego admin wybiera opisowy poziom (brak / niski / średni / wysoki), a tłumaczenie na parametr
// dostawcy siedzi TUTAJ, razem z konserwatywną tabelą możliwości: parametru wysyłamy tylko wtedy,
// gdy jesteśmy pewni rodziny modelu. Panel administratora korzysta z tych samych funkcji, żeby
// powiedzieć wprost, że dla wybranego modelu ustawienie zostanie pominięte.

import type { ProviderKind } from "@/platform/llm/resolver";

export type LlmEffort = "none" | "low" | "medium" | "high";

/** Skala rosnąco — kolejność ma znaczenie dla `bumpEffort`. */
export const LLM_EFFORT_LEVELS: LlmEffort[] = ["none", "low", "medium", "high"];

export const LLM_EFFORT_LABELS: Record<LlmEffort, string> = {
  none: "Brak",
  low: "Niski",
  medium: "Średni",
  high: "Wysoki",
};

export const LLM_EFFORT_DESCRIPTIONS: Record<LlmEffort, string> = {
  none: "Model odpowiada bez dodatkowego etapu rozumowania (zachowanie domyślne).",
  low: "Krótkie rozumowanie — nieznacznie wyższy koszt i czas odpowiedzi.",
  medium: "Wyraźnie więcej rozumowania — dobry kompromis jakość/koszt.",
  high: "Maksymalne rozumowanie — najlepsza jakość, najwyższy koszt i czas.",
};

/** Bezpieczne wczytanie wartości z bazy / od klienta. Nieznana wartość → „brak". */
export function parseEffort(value: string | null | undefined): LlmEffort {
  return LLM_EFFORT_LEVELS.includes(value as LlmEffort) ? (value as LlmEffort) : "none";
}

/**
 * Podnosi wysiłek o JEDEN stopień (najwyższy zostaje najwyższy). Używane przez tryb „maksymalny"
 * asystenta: wychodzimy od tego, co ustawił admin, i podnosimy — nigdy nie wybieramy modelu za
 * niego (C-40).
 */
export function bumpEffort(effort: LlmEffort): LlmEffort {
  const i = LLM_EFFORT_LEVELS.indexOf(effort);
  return LLM_EFFORT_LEVELS[Math.min(LLM_EFFORT_LEVELS.length - 1, i < 0 ? 1 : i + 1)];
}

// ── Tabela możliwości (konserwatywna) ────────────────────────────────────────
// Rodziny modeli Anthropic z rozszerzonym myśleniem: Claude 4 i nowsze (Opus/Sonnet/Haiku 4.x,
// Sonnet/Opus 5). Świadomie WYKLUCZAMY Claude 3.x — tam rozszerzonego myślenia nie ma.
const ANTHROPIC_THINKING_RE = /claude.*-(?:4(?:[.-]\d+)?|5)\b|claude-(?:opus|sonnet|haiku)-(?:4|5)/i;
const ANTHROPIC_LEGACY_RE = /claude-3/i;

// Rodziny modeli zgodnych z OpenAI, które przyjmują `reasoning_effort`.
const OPENAI_REASONING_RE = /\b(?:o1|o3|o4)(?:-|$)|gpt-5|gpt-oss|qwen3|deepseek-r1/i;

/** Czy dla tej pary (dostawca, model) wolno wysłać parametr wysiłku. */
export function effortSupported(kind: ProviderKind, model: string): boolean {
  const m = (model ?? "").trim();
  if (!m) return false;
  if (kind === "anthropic") return ANTHROPIC_THINKING_RE.test(m) && !ANTHROPIC_LEGACY_RE.test(m);
  return OPENAI_REASONING_RE.test(m);
}

/**
 * Czy dostawca przyjmuje `temperature`. Anthropic — NIE: nowsze modele Claude odrzucają ten
 * parametr błędem 400 (patrz `doświadczenia.md`, 026-anthropic-temperature-fix). Ta funkcja jest
 * źródłem prawdy zarówno dla budowy żądania, jak i dla komunikatu w panelu administratora.
 */
export function supportsTemperature(kind: ProviderKind): boolean {
  return kind !== "anthropic";
}

// Budżet tokenów rozszerzonego myślenia dla Anthropic (per poziom skali).
const THINKING_BUDGET: Record<Exclude<LlmEffort, "none">, number> = {
  low: 2048,
  medium: 6144,
  high: 12288,
};

// Anthropic wymaga, by `max_tokens` był WIĘKSZY od `budget_tokens` — inaczej 400.
// Zapas na samą odpowiedź (poza myśleniem).
const THINKING_ANSWER_HEADROOM = 1024;

/** Nazwa parametru wysiłku u danego dostawcy — do rozpoznawania odrzuceń i do diagnostyki. */
export const EFFORT_PARAM_NAMES = ["thinking", "budget_tokens", "reasoning_effort"] as const;

/**
 * Dokłada parametr wysiłku do ciała żądania — **mutuje** przekazany obiekt (tak jak sąsiednie
 * `openAiBody`/`anthropicBody` budują ciało). Gdy poziom to „brak" albo model/dostawca tego nie
 * obsługuje — nie robi NIC, więc żądanie wygląda dokładnie jak przed tą zmianą.
 */
export function applyEffort(
  body: Record<string, unknown>,
  kind: ProviderKind,
  model: string,
  effort: LlmEffort
): void {
  if (effort === "none") return;
  if (!effortSupported(kind, model)) return;

  if (kind === "anthropic") {
    const budget = THINKING_BUDGET[effort];
    body.thinking = { type: "enabled", budget_tokens: budget };
    // `max_tokens` musi zostawić miejsce na odpowiedź PONAD budżet myślenia.
    const current = typeof body.max_tokens === "number" ? body.max_tokens : 0;
    const required = budget + THINKING_ANSWER_HEADROOM;
    if (current < required) body.max_tokens = required;
    return;
  }

  body.reasoning_effort = effort;
}

/**
 * Czy błąd dostawcy to odrzucenie PARAMETRU WYSIŁKU (a nie inny problem z żądaniem). Pozwala
 * zdegradować wywołanie (jedna próba bez wysiłku) zamiast wywalić agenta — 400 nie jest
 * przejściowy, więc bez tego przerwałby łańcuch fallbacku.
 */
export function isEffortRejection(status: number, text: string | null | undefined): boolean {
  if (status !== 400) return false;
  const t = (text ?? "").toLowerCase();
  if (!t) return false;
  return EFFORT_PARAM_NAMES.some((p) => t.includes(p)) || t.includes("extended thinking");
}
