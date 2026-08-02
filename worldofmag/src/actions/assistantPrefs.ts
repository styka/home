"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import { configuredSpeechVoices } from "@/lib/tts/serverTts";
import { type ServerVoice } from "@/lib/tts/serverVoices";
import {
  ASSISTANT_LEVELS,
  ASSISTANT_VOICE_KINDS,
  type AssistantLevel,
  type AssistantVoiceKind,
} from "@/types";
import {
  BASE_CONFIG_LEVEL,
  OPERATION_TYPES,
  OPERATION_TYPE_META,
  isOperationType,
} from "@/lib/llm/operationTypes";
import { isSpeechOnlyKind, type ProviderKind } from "@/lib/llm/resolver";
import {
  LLM_EFFORT_LEVELS,
  effortSupported,
  parseEffort,
  supportsTemperature,
  type LlmEffort,
} from "@/lib/llm/effort";

// 031: ustawienia asystenta AI trzymane PER UŻYTKOWNIK (model `AssistantPref`), a nie w
// pamięci przeglądarki — dzięki temu stałe preferencje i poziom pracy asystenta są te same
// na komputerze i na telefonie. Wzorzec: `dashboardPrefs.ts`.

// Maksymalna długość stałych preferencji — wchodzą do KAŻDEGO promptu, więc trzymamy je krótko.
// NIE eksportujemy: w pliku "use server" wolno eksportować wyłącznie funkcje async.
const ASSISTANT_INSTRUCTIONS_MAX = 2000;

export interface AssistantPrefsDTO {
  instructions: string;
  level: AssistantLevel;
  voiceKind: AssistantVoiceKind;
  voiceId: string | null;
  /**
   * 041: auto-zatwierdzanie BEZPIECZNYCH akcji asystenta. Akcje niszczące pytają zawsze —
   * klasyfikacja idzie z `DESTRUCTIVE_ACTION_TYPES`, tego samego zbioru, którego używa szuflada.
   */
  autoApprove: boolean;
}

export interface AssistantPrefsInput {
  instructions?: string;
  level?: string;
  voiceKind?: string;
  voiceId?: string | null;
  autoApprove?: boolean;
}

const DEFAULTS: AssistantPrefsDTO = {
  instructions: "",
  level: "standard",
  voiceKind: "browser",
  voiceId: null,
  autoApprove: false,
};

function parseLevel(value: string | null | undefined): AssistantLevel {
  return ASSISTANT_LEVELS.includes(value as AssistantLevel) ? (value as AssistantLevel) : DEFAULTS.level;
}

function parseVoiceKind(value: string | null | undefined): AssistantVoiceKind {
  return ASSISTANT_VOICE_KINDS.includes(value as AssistantVoiceKind)
    ? (value as AssistantVoiceKind)
    : DEFAULTS.voiceKind;
}

/**
 * Ustawienia asystenta zalogowanego użytkownika. Brak wiersza = wartości domyślne
 * zwracane w locie (bez zapisu) — nie zaśmiecamy bazy rekordami dla kont, które
 * nigdy nic nie zmieniły.
 */
export async function getAssistantPrefs(): Promise<AssistantPrefsDTO> {
  const user = await requireAuth();
  const row = await prisma.assistantPref.findUnique({ where: { userId: user.id } });
  if (!row) return { ...DEFAULTS };
  return {
    instructions: row.instructions ?? "",
    level: parseLevel(row.level),
    voiceKind: parseVoiceKind(row.voiceKind),
    voiceId: row.voiceId ?? null,
    autoApprove: row.autoApprove,
  };
}

/**
 * Zapis ustawień asystenta. Aktualizujemy TYLKO przekazane pola (panel zapisuje
 * pojedyncze kontrolki niezależnie). Wartości spoza dozwolonego zbioru odrzucamy z
 * czytelnym komunikatem, zamiast po cichu zapisywać śmieć do bazy.
 */
export async function updateAssistantPrefs(input: AssistantPrefsInput): Promise<AssistantPrefsDTO> {
  const user = await requireAuth();

  const data: {
    instructions?: string;
    level?: AssistantLevel;
    voiceKind?: AssistantVoiceKind;
    voiceId?: string | null;
    autoApprove?: boolean;
  } = {};

  if (input.autoApprove !== undefined) data.autoApprove = input.autoApprove === true;

  if (input.instructions !== undefined) {
    if (input.instructions.length > ASSISTANT_INSTRUCTIONS_MAX) {
      throw new Error(`Stałe preferencje mogą mieć maksymalnie ${ASSISTANT_INSTRUCTIONS_MAX} znaków.`);
    }
    data.instructions = input.instructions;
  }
  if (input.level !== undefined) {
    if (!ASSISTANT_LEVELS.includes(input.level as AssistantLevel)) {
      throw new Error("Nieznany poziom pracy asystenta.");
    }
    data.level = input.level as AssistantLevel;
  }
  if (input.voiceKind !== undefined) {
    if (!ASSISTANT_VOICE_KINDS.includes(input.voiceKind as AssistantVoiceKind)) {
      throw new Error("Nieznane źródło głosu lektora.");
    }
    data.voiceKind = input.voiceKind as AssistantVoiceKind;
  }
  if (input.voiceId !== undefined) {
    const raw = input.voiceId?.trim() ? input.voiceId.trim().slice(0, 120) : null;
    // 032: głos serwerowy musi należeć do dostawcy, który JEST przypisany do syntezy mowy. Głos
    // nierozpoznany (np. po przełączeniu dostawcy przez administratora) zapisujemy jako `null`, czyli
    // „domyślny głos dostawcy" — nigdy nie zapisujemy po cichu nazwy, której dostawca nie zna, i nie
    // wywalamy użytkownikowi błędu za coś, czego nie zmieniał (AC-7).
    // Walidujemy tylko przy JAWNYM wyborze głosu serwerowego — klient zawsze wysyła `voiceKind`
    // razem z `voiceId`, a identyfikatory głosów przeglądarki (voiceURI) nie należą do katalogu.
    if (raw && data.voiceKind === "server") {
      const configured = await configuredSpeechVoices().catch(() => null);
      data.voiceId = configured?.voices.some((v) => v.id === raw) ? raw : null;
    } else {
      data.voiceId = raw;
    }
  }

  // Zapis WYŁĄCZNIE po userId z sesji — użytkownik nie może dotknąć cudzych ustawień.
  const row = await prisma.assistantPref.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...DEFAULTS, ...data, voiceId: data.voiceId ?? null },
    update: data,
  });

  revalidatePath("/");
  return {
    instructions: row.instructions ?? "",
    level: parseLevel(row.level),
    voiceKind: parseVoiceKind(row.voiceKind),
    voiceId: row.voiceId ?? null,
    autoApprove: row.autoApprove,
  };
}

// ─── 034: WŁASNY poziom pracy asystenta (per użytkownik) ────────────────────
//
// Użytkownik może zbudować własny zestaw ustawień per rodzaj działania: model, wysiłek i
// temperaturę. Świadomie NIE dostaje limitu odpowiedzi (`maxTokens`) — to parametr kosztowo-
// techniczny, który zostaje przy administratorze. Model wolno wybrać WYŁĄCZNIE z modeli, które
// administrator już skonfigurował (C-40: to on decyduje, co w ogóle wolno wołać).

export interface AssistantModelChoiceDTO {
  /** Identyfikator wyboru = „providerId|model" (jedna wartość dla kontrolki select). */
  key: string;
  providerId: string;
  model: string;
  providerLabel: string;
  providerKind: string;
  /** Czy dla tego modelu ma sens suwak wysiłku / temperatury (AC-8). */
  supportsEffort: boolean;
  supportsTemperature: boolean;
}

export interface AssistantOperationPrefDTO {
  operationType: string;
  label: string;
  description: string;
  /** Ustawienia poziomu standardowego — punkt wyjścia, gdy użytkownik niczego nie zmieni. */
  defaultKey: string | null;
  defaultEffort: LlmEffort;
  defaultTemperature: number | null;
  /** Wybór użytkownika (null = „jak w poziomie standardowym"). */
  key: string | null;
  effort: LlmEffort | null;
  temperature: number | null;
}

export interface AssistantLevelConfigDTO {
  choices: AssistantModelChoiceDTO[];
  operations: AssistantOperationPrefDTO[];
}

function choiceKey(providerId: string, model: string): string {
  return `${providerId}|${model}`;
}

/**
 * Katalog modeli dostępnych użytkownikowi + jego własne ustawienia per rodzaj działania.
 * Katalog = modele przypisane przez administratora na DOWOLNYM poziomie (u włączonych dostawców
 * z kluczem) — użytkownik nie wpisuje nazwy modelu z palca.
 */
export async function getAssistantLevelConfig(): Promise<AssistantLevelConfigDTO> {
  const user = await requireAuth();
  const [assignments, prefs] = await Promise.all([
    prisma.llmAssignment.findMany({ include: { provider: true } }),
    prisma.userLlmPref.findMany({ where: { userId: user.id } }),
  ]);

  const usable = assignments.filter(
    (a) => a.model && a.provider.enabled && a.provider.apiKey && !isSpeechOnlyKind(a.provider.kind)
  );
  const byKey = new Map<string, AssistantModelChoiceDTO>();
  for (const a of usable) {
    const key = choiceKey(a.providerId, a.model!);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      key,
      providerId: a.providerId,
      model: a.model!,
      providerLabel: a.provider.label,
      providerKind: a.provider.kind,
      supportsEffort: effortSupported(a.provider.kind as ProviderKind, a.model!),
      supportsTemperature: supportsTemperature(a.provider.kind as ProviderKind),
    });
  }

  const standard = new Map(
    assignments.filter((a) => a.level === BASE_CONFIG_LEVEL).map((a) => [a.operationType, a])
  );
  const byOp = new Map(prefs.map((p) => [p.operationType, p]));

  const operations = OPERATION_TYPES.filter((op) => op !== "speech").map((op) => {
    const base = standard.get(op);
    const pref = byOp.get(op);
    return {
      operationType: op,
      label: OPERATION_TYPE_META[op].label,
      description: OPERATION_TYPE_META[op].description,
      defaultKey: base?.model ? choiceKey(base.providerId, base.model) : null,
      defaultEffort: parseEffort(base?.effort),
      defaultTemperature: base?.temperature ?? null,
      key: pref?.model && pref.providerId ? choiceKey(pref.providerId, pref.model) : null,
      effort: pref?.effort ? parseEffort(pref.effort) : null,
      temperature: pref?.temperature ?? null,
    };
  });

  return { choices: Array.from(byKey.values()), operations };
}

/**
 * Zapis jednego rodzaju działania we własnym poziomie. Pola puste = „jak w poziomie standardowym".
 * Model musi pochodzić z katalogu administratora — inaczej użytkownik mógłby wskazać dowolny
 * (także nieistniejący albo drogi) model.
 */
export async function updateUserLlmPref(input: {
  operationType: string;
  /** „providerId|model" z katalogu; null = wróć do modelu z poziomu standardowego. */
  key?: string | null;
  effort?: string | null;
  temperature?: number | null;
}): Promise<void> {
  const user = await requireAuth();
  if (!isOperationType(input.operationType) || input.operationType === "speech") {
    throw new Error("Nieznany rodzaj działania asystenta.");
  }

  let providerId: string | null = null;
  let model: string | null = null;
  if (input.key) {
    const { choices } = await getAssistantLevelConfig();
    const chosen = choices.find((c) => c.key === input.key);
    if (!chosen) throw new Error("Ten model nie jest dostępny — wybierz jeden z listy.");
    providerId = chosen.providerId;
    model = chosen.model;
  }

  let effort: string | null = null;
  if (input.effort != null && input.effort !== "") {
    if (!LLM_EFFORT_LEVELS.includes(input.effort as LlmEffort)) throw new Error("Nieznany poziom wysiłku modelu.");
    effort = input.effort === "none" ? null : input.effort;
  }

  const temperature = input.temperature ?? null;
  if (temperature !== null && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
    throw new Error("Temperatura musi być liczbą z zakresu 0–2.");
  }

  const fields = { providerId, model, effort, temperature };
  await prisma.userLlmPref.upsert({
    where: { userId_operationType: { userId: user.id, operationType: input.operationType } },
    create: { userId: user.id, operationType: input.operationType, ...fields },
    update: fields,
  });
  revalidatePath("/");
}

/** Czyści cały własny poziom (powrót do ustawień administratora). */
export async function resetUserLlmPrefs(): Promise<void> {
  const user = await requireAuth();
  await prisma.userLlmPref.deleteMany({ where: { userId: user.id } });
  revalidatePath("/");
}

/**
 * 031: czy administrator skonfigurował serwerową syntezę mowy (typ operacji `speech` w /admin/llm)
 * i jakie głosy są wtedy dostępne. Gdy nie — UI pokazuje wyłącznie głosy przeglądarki i nie obiecuje
 * czegoś, czego nie ma.
 *
 * 032: lista głosów pochodzi teraz od DOSTAWCY, który jest przypisany (a nie ze stałej listy głosów
 * rodziny OpenAI). Po przełączeniu dostawcy użytkownik widzi jego głosy — nie nazwy, których nowy
 * dostawca nie zna (AC-7).
 */
export async function getSpeechOptions(): Promise<{ serverAvailable: boolean; voices: ServerVoice[] }> {
  await requireAuth();
  const configured = await configuredSpeechVoices().catch(() => null);
  if (!configured) return { serverAvailable: false, voices: [] };
  return { serverAvailable: true, voices: configured.voices };
}
