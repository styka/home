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
 * Poziom pracy asystenta w rozumieniu warstwy LLM (bez importu z `@/types`, żeby nie mieszać warstw).
 *
 * 034: `custom` = własny poziom użytkownika (`UserLlmPref`). Trzy pozostałe definiuje administrator
 * w `/admin/llm` — każdy jako pełny zestaw ustawień per typ operacji.
 */
export type AssistantWorkLevel = "standard" | "economy" | "max" | "custom";

/**
 * 034: poziomy definiowane przez ADMINA (bez `custom`, który należy do użytkownika).
 * To zwykły `String` w bazie + union tutaj — żadnego enuma Prisma (C-12).
 */
export const CONFIG_LEVELS = ["economy", "standard", "max"] as const;
export type ConfigLevel = (typeof CONFIG_LEVELS)[number];

export const CONFIG_LEVEL_LABELS: Record<ConfigLevel, string> = {
  economy: "Oszczędny",
  standard: "Standardowy",
  max: "Maksymalny",
};

export const CONFIG_LEVEL_DESCRIPTIONS: Record<ConfigLevel, string> = {
  economy: "Najtańsza obsługa — do prostych pytań i szybkich poleceń.",
  standard: "Domyślny zestaw modeli. Pozostałe poziomy dziedziczą z niego to, czego nie wypełnisz.",
  max: "Najmocniejsza obsługa — do trudnych, wieloetapowych poleceń.",
};

export function isConfigLevel(value: string): value is ConfigLevel {
  return (CONFIG_LEVELS as readonly string[]).includes(value);
}

/** Poziom, z którego dziedziczą pozostałe (i do którego wracamy, gdy czegoś brakuje). */
export const BASE_CONFIG_LEVEL: ConfigLevel = "standard";

/**
 * Poziom pracy → poziom konfiguracji administratora. `custom` startuje od standardowego, bo
 * ustawienia użytkownika są NAKŁADKĄ na niego (a `maxTokens` bierzemy stamtąd zawsze).
 */
export function configLevelFor(level: AssistantWorkLevel | undefined): ConfigLevel {
  return level && level !== "custom" && isConfigLevel(level) ? level : BASE_CONFIG_LEVEL;
}
