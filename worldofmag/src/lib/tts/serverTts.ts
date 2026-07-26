import { resolveLlmChain } from "@/lib/llm/resolver";
import { DEFAULT_SERVER_VOICE, isServerVoiceId } from "@/lib/tts/serverVoices";

// 031: serwerowa synteza mowy dla lektora asystenta. Korzysta z tej samej, DB-driven konfiguracji
// co reszta LLM-ów (`LlmProvider` + `LlmAssignment`, typ operacji `speech`) — zero hardcodowania
// dostawcy i modelu (C-40), klucz odszyfrowywany przez resolver (C-41).
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
 * skonfigurowana — wołający ma wtedy odpowiedzieć „nieobsługiwane", a nie błędem.
 * Rzuca wyjątkiem tylko wtedy, gdy dostawca jest skonfigurowany, ale odpowiedział błędem.
 */
export async function synthesizeSpeech(input: { text: string; voiceId?: string | null }): Promise<SpeechResult | null> {
  const text = input.text.trim().slice(0, SPEECH_MAX_CHARS);
  if (!text) return null;

  const chain = await resolveLlmChain("speech");
  const cfg = chain[0];
  if (!cfg) return null; // brak przypisania → funkcja wyłączona

  const voice = isServerVoiceId(input.voiceId) ? input.voiceId! : DEFAULT_SERVER_VOICE;

  const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      voice,
      input: text,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    // Treść błędu dostawcy może zawierać fragmenty konfiguracji — nie przepuszczamy jej do klienta.
    throw new Error(`Synteza mowy nie odpowiedziała poprawnie (status ${res.status}).`);
  }

  return { audio: await res.arrayBuffer(), contentType: res.headers.get("content-type") ?? "audio/mpeg" };
}

/** Czy serwerowa synteza mowy jest skonfigurowana (do decyzji UI, czy pokazywać głosy serwerowe). */
export async function isServerSpeechConfigured(): Promise<boolean> {
  const chain = await resolveLlmChain("speech");
  return chain.length > 0;
}
