"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/server-utils";
import {
  ASSISTANT_LEVELS,
  ASSISTANT_VOICE_KINDS,
  type AssistantLevel,
  type AssistantVoiceKind,
} from "@/types";

// 031: ustawienia asystenta AI trzymane PER UŻYTKOWNIK (model `AssistantPref`), a nie w
// pamięci przeglądarki — dzięki temu stałe preferencje i poziom pracy asystenta są te same
// na komputerze i na telefonie. Wzorzec: `dashboardPrefs.ts`.

/** Maksymalna długość stałych preferencji — wchodzą do KAŻDEGO promptu, więc trzymamy je krótko. */
export const ASSISTANT_INSTRUCTIONS_MAX = 2000;

export interface AssistantPrefsDTO {
  instructions: string;
  level: AssistantLevel;
  voiceKind: AssistantVoiceKind;
  voiceId: string | null;
}

export interface AssistantPrefsInput {
  instructions?: string;
  level?: string;
  voiceKind?: string;
  voiceId?: string | null;
}

const DEFAULTS: AssistantPrefsDTO = {
  instructions: "",
  level: "standard",
  voiceKind: "browser",
  voiceId: null,
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
  } = {};

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
    data.voiceId = input.voiceId?.trim() ? input.voiceId.trim().slice(0, 120) : null;
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
  };
}
