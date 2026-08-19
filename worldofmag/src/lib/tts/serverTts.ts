import { prisma } from "@/platform/db/prisma";
import { resolveLlmChain } from "@/platform/llm/resolver";
import { buildSpeechRequest, parseSpeechResponse } from "@/lib/tts/adapters";
import { defaultVoiceFor, isVoiceOf, voicesFor } from "@/lib/tts/catalog";
import { readForceBrowserVoice } from "@/lib/tts/forceBrowser";
import type { ServerVoice } from "@/lib/tts/serverVoices";

// Klucz `Config` z domyślnym głosem wybranym przez administratora (ustawiany w /admin/llm).
const SPEECH_VOICE_CONFIG_KEY = "speech_default_voice";

// 031/032: serwerowa synteza mowy dla lektora asystenta. Korzysta z tej samej, DB-driven konfiguracji
// co reszta LLM-ów (`LlmProvider` + `LlmAssignment`, typ operacji `speech`) — zero hardcodowania
// dostawcy i modelu (C-40), klucz odszyfrowywany przez resolver (C-41).
//
// 032: samo żądanie buduje `buildSpeechRequest` (jeden `switch` na rodzaj dostawcy), więc obsługujemy
// nie tylko rodzinę zgodną z OpenAI, ale też ElevenLabs, Google Cloud TTS i Azure Speech.
//
// Brak przypisania w /admin/llm = funkcja WYŁĄCZONA (zwracamy null, klient wraca do głosów
// przeglądarki). Audio nie jest nigdzie trwale zapisywane.

/** Limit długości tekstu — ochrona kosztów (dostawcy liczą per znak). */
export const SPEECH_MAX_CHARS = 1200;

export interface SpeechResult {
  audio: ArrayBuffer;
  contentType: string;
}

/**
 * Syntezuje mowę u skonfigurowanego dostawcy. Zwraca `null`, gdy synteza serwerowa nie jest
 * skonfigurowana — wołający ma wtedy odpowiedzieć „nieobsługiwane”, a nie błędem.
 * Rzuca wyjątkiem tylko wtedy, gdy dostawca jest skonfigurowany, ale odpowiedział błędem.
 */
export async function synthesizeSpeech(input: { text: string; voiceId?: string | null }): Promise<SpeechResult | null> {
  const text = input.text.trim().slice(0, SPEECH_MAX_CHARS);
  if (!text) return null;

  // 080 (Z4): administrator może świadomie wybrać głos systemowy. Wyłączamy warstwę serwerową,
  // nie kasując konfiguracji dostawcy — wybór jest odwracalny jednym przełącznikiem.
  if (await readForceBrowserVoice()) return null;

  const chain = await resolveLlmChain("speech");
  const cfg = chain[0];
  if (!cfg) return null; // brak przypisania → funkcja wyłączona

  // 032: głos musi należeć do TEGO dostawcy. Gdy użytkownik nie wybrał głosu albo ma zapisany głos
  // poprzedniego dostawcy (administrator zmienił konfigurację), schodzimy po kolei: głos domyślny
  // ustawiony przez administratora → pierwszy głos dostawcy z katalogu. Nigdy nie wysyłamy nazwy,
  // której dostawca nie zna.
  const voiceId = isVoiceOf(cfg.kind, cfg.baseUrl, input.voiceId)
    ? input.voiceId!
    : (await adminDefaultVoice(cfg.kind, cfg.baseUrl)) ?? defaultVoiceFor(cfg.kind, cfg.baseUrl);
  if (!voiceId) return null; // dostawca bez znanych głosów — traktujemy jak nieskonfigurowany

  const req = buildSpeechRequest(cfg, { text, voiceId });

  let res: Response;
  try {
    res = await fetch(req.url, req.init);
  } catch (e) {
    throw new SpeechError("network", e instanceof Error ? e.message : undefined);
  }

  if (!res.ok) {
    // Treść błędu dostawcy może zawierać fragmenty konfiguracji — nie przepuszczamy jej do klienta.
    // Wychodzi wyłącznie POWÓD wyprowadzony ze statusu (C-41).
    throw new SpeechError(powodZeStatusu(res.status));
  }

  return parseSpeechResponse(cfg.kind, res, req.contentTypeFallback);
}

/**
 * 080 (Z4): POWÓD ODMOWY, a nie „coś nie zadziałało".
 *
 * Do zgłoszenia doprowadził brak właśnie tego rozróżnienia: trasa zwracała zawsze 502, a panel
 * administratora zawsze zdanie „Sprawdź klucz API i wybrany model". Właściciel wygenerował nowy
 * klucz — na darmo, bo komunikat nie opisywał tego, co się naprawdę stało.
 *
 * Kody są celowo GRUBE. Mają odpowiadać na pytanie „co mam z tym zrobić", a nie odwzorowywać
 * dokumentację dostawcy — każdy dostawca numeruje swoje błędy inaczej.
 */
export type SpeechFailureReason = "auth" | "model" | "quota" | "provider" | "network";

export const SPEECH_FAILURE_REASONS: SpeechFailureReason[] = ["auth", "model", "quota", "provider", "network"];

export function powodZeStatusu(status: number): SpeechFailureReason {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "quota";
  // 402 (payment required) to u części dostawców sposób na powiedzenie „skończył się limit".
  if (status === 402) return "quota";
  if (status === 400 || status === 404 || status === 422) return "model";
  if (status >= 500) return "provider";
  return "provider";
}

/**
 * Błąd syntezy niosący powód. `detail` zostaje NA SERWERZE — służy logowi, nie odpowiedzi:
 * komunikat dostawcy potrafi zawierać fragment konfiguracji albo sam klucz (C-41).
 */
export class SpeechError extends Error {
  constructor(
    readonly reason: SpeechFailureReason,
    readonly detail?: string
  ) {
    super(`Synteza mowy odmówiła (${reason}).`);
    this.name = "SpeechError";
  }
}

/** Domyślny głos ustawiony przez administratora — o ile należy do obecnego dostawcy. */
async function adminDefaultVoice(kind: string, baseUrl: string): Promise<string | null> {
  const row = await prisma.config.findUnique({ where: { key: SPEECH_VOICE_CONFIG_KEY } }).catch(() => null);
  return isVoiceOf(kind, baseUrl, row?.value) ? row!.value : null;
}

/**
 * 032: głosy dostawcy AKTUALNIE przypisanego do syntezy mowy (`null`, gdy nic nie jest przypisane).
 * Ustawienia asystenta pokazują tylko te głosy — użytkownik nie ma wybierać spośród nazw, których
 * skonfigurowany dostawca nie zna (AC-7). Kluczujemy po rodzaju **i adresie bazowym**, bo sam rodzaj
 * nie odróżnia OpenAI od Groq PlayAI (oba `openai_compat`, ale mają zupełnie inne głosy).
 */
export async function configuredSpeechVoices(): Promise<{ voices: ServerVoice[] } | null> {
  const chain = await resolveLlmChain("speech");
  const cfg = chain[0];
  if (!cfg) return null;
  return { voices: voicesFor(cfg.kind, cfg.baseUrl) };
}
