// Typy operacji LLM wg CHARAKTERU zadania (nie wg modułu).
// Dzięki temu admin przypisuje model do rodzaju pracy, jaką wykonuje model,
// a nie do konkretnej funkcji aplikacji.

export const OPERATION_TYPES = ["dispatch", "reasoning", "vision", "generation", "speech"] as const;

export type OperationType = (typeof OPERATION_TYPES)[number];

export interface OperationTypeMeta {
  type: OperationType;
  label: string;
  description: string;
  /** Domyślny model Groq, zachowujący dotychczasowe zachowanie aplikacji. */
  defaultModel: string;
}

// Domyślny dostawca: Groq (OpenAI-compatible). Modele dobrane tak, by
// zachować dotychczasowe zachowanie poszczególnych tras.
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export const OPERATION_TYPE_META: Record<OperationType, OperationTypeMeta> = {
  dispatch: {
    type: "dispatch",
    label: "Dispatching / szybkie parsowanie",
    description:
      "Szybka klasyfikacja i wyciąganie struktury z tekstu (tagi, parsowanie zadań, normalizacja listy zakupów, składniki, kategoryzacja).",
    defaultModel: "llama-3.1-8b-instant",
  },
  reasoning: {
    type: "reasoning",
    label: "Myślenie / wnioskowanie",
    description:
      "Złożone wnioskowanie wieloetapowe: agent strony głównej, planowanie tygodnia, wyszukiwanie semantyczne, Q&A, generowanie układu sklepu.",
    defaultModel: "llama-3.3-70b-versatile",
  },
  vision: {
    type: "vision",
    label: "Analiza obrazów (OCR)",
    description: "Rozpoznawanie i odczyt treści z obrazów (OCR przepisów, zdjęcia).",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
  // 031: synteza mowy (lektor asystenta). Domyślny model PUSTY — dopóki admin nie przypisze
  // dostawcy, funkcja jest wyłączona i klient płynnie wraca do głosów przeglądarki.
  speech: {
    type: "speech",
    label: "Synteza mowy (lektor)",
    description:
      "Czytanie odpowiedzi asystenta na głos po stronie serwera — daje polskie głosy niezależne od przeglądarki i systemu. Bez przypisania działają wyłącznie głosy przeglądarki.",
    defaultModel: "",
  },
  generation: {
    type: "generation",
    label: "Generowanie treści",
    description:
      "Dłuższe tworzenie i przeredagowanie tekstu: przepisywanie notatek, generowanie przepisów, generowanie słówek do nauki.",
    defaultModel: "llama-3.3-70b-versatile",
  },
};

export function isOperationType(value: string): value is OperationType {
  return (OPERATION_TYPES as readonly string[]).includes(value);
}

/**
 * 031: poziom pracy asystenta wybiera TYP OPERACJI, nigdy konkretny model — dobór modelu zostaje
 * w rękach administratora (`/admin/llm`, C-40). Tryb oszczędny kieruje wszystko do `dispatch`,
 * czyli do modelu przypisanego przez admina do najprostszych operacji (dla Anthropic to zwykle
 * Haiku).
 *
 * 032: tryb „maksymalny" NIE zmienia typu operacji — działa na modelu, który admin przypisał, ale
 * z podniesionym poziomem wysiłku (patrz `boostEffort` w `chatComplete`). Dzięki temu nadal to
 * admin decyduje, jaki model obsługuje daną operację.
 */
export function effectiveOperation(op: OperationType, level: AssistantWorkLevel | undefined): OperationType {
  return level === "economy" ? "dispatch" : op;
}

/** Poziom pracy asystenta w rozumieniu warstwy LLM (bez importu z `@/types`, żeby nie mieszać warstw). */
export type AssistantWorkLevel = "standard" | "economy" | "max";

/** Czy dla tego poziomu podnosimy wysiłek ustawiony przez admina o jeden stopień. */
export function shouldBoostEffort(level: AssistantWorkLevel | undefined): boolean {
  return level === "max";
}
