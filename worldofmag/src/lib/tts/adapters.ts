// 032: ADAPTERY SYNTEZY MOWY — cała różnica między dostawcami w JEDNYM miejscu.
//
// Właściciel wybrał wariant „katalog + adaptery wszystkich znanych dostawców" (decyzja D-1 w specu),
// więc obsługujemy pięć rodzin naraz. Żeby nie zapłacić za to kosztem utrzymania (C-53), różnice
// mieszczą się w dwóch funkcjach z jednym `switch` na rodzaj dostawcy — bez klas, fabryk i nowych
// zależności (wszystko na `fetch`).
//
// Uwaga bezpieczeństwa (C-41): tu NIE logujemy ani nie zwracamy klucza; treść błędu dostawcy
// zostaje po stronie serwera (interpretuje ją `serverTts.ts`).

import type { ResolvedLlm } from "@/lib/llm/resolver";

export interface SpeechRequest {
  url: string;
  init: RequestInit;
  /** Typ MIME, gdy dostawca nie odda go w nagłówkach. */
  contentTypeFallback: string;
}

export interface SpeechInput {
  text: string;
  voiceId: string;
}

/** Escapowanie tekstu wstawianego do SSML — inaczej `&` albo `<` w treści psuje cały dokument. */
export function escapeSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const stripSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * Buduje żądanie do dostawcy syntezy mowy. `cfg` pochodzi z `resolveLlmChain("speech")`, więc model,
 * adres i klucz są zawsze tymi z konfiguracji administratora (C-40).
 */
export function buildSpeechRequest(cfg: ResolvedLlm, input: SpeechInput): SpeechRequest {
  const base = stripSlash(cfg.baseUrl);
  const { text, voiceId } = input;

  switch (cfg.kind) {
    // ElevenLabs: głos jest częścią ŚCIEŻKI, model idzie w body, klucz we własnym nagłówku.
    case "elevenlabs":
      return {
        url: `${base}/text-to-speech/${encodeURIComponent(voiceId)}`,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": cfg.apiKey,
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({ text, model_id: cfg.model }),
        },
        contentTypeFallback: "audio/mpeg",
      };

    // Google Cloud TTS: klucz w query stringu, odpowiedź to JSON z audio w base64 (patrz parser).
    case "google_tts":
      return {
        url: `${base}/text:synthesize?key=${encodeURIComponent(cfg.apiKey)}`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: "pl-PL", name: voiceId },
            audioConfig: { audioEncoding: "MP3" },
          }),
        },
        contentTypeFallback: "audio/mpeg",
      };

    // Azure Speech: body to SSML (nie JSON), format wyjścia deklarujemy nagłówkiem.
    case "azure_tts":
      return {
        url: `${base}/cognitiveservices/v1`,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/ssml+xml",
            "Ocp-Apim-Subscription-Key": cfg.apiKey,
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          },
          body:
            `<speak version="1.0" xml:lang="pl-PL">` +
            `<voice name="${escapeSsml(voiceId)}">${escapeSsml(text)}</voice>` +
            `</speak>`,
        },
        contentTypeFallback: "audio/mpeg",
      };

    // Rodzina zgodna z OpenAI (OpenAI, Groq PlayAI, proxy) — dotychczasowa, jedyna obsługiwana
    // ścieżka; `anthropic` też tu wpada, ale nie ma syntezy mowy i nie da się go przypisać.
    case "openai_compat":
    case "anthropic":
    default:
      return {
        url: `${base}/audio/speech`,
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.model,
            voice: voiceId,
            input: text,
            response_format: "mp3",
          }),
        },
        contentTypeFallback: "audio/mpeg",
      };
  }
}

/**
 * Wyciąga audio z odpowiedzi dostawcy. Wszyscy poza Google oddają surowe bajty; Google zwraca JSON
 * `{ audioContent: "<base64>" }`.
 */
export async function parseSpeechResponse(
  kind: string,
  res: Response,
  contentTypeFallback: string
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  if (kind === "google_tts") {
    const json = (await res.json()) as { audioContent?: string };
    if (!json.audioContent) throw new Error("Dostawca nie zwrócił treści audio.");
    const bytes = Buffer.from(json.audioContent, "base64");
    // Kopiujemy do samodzielnego ArrayBuffer — bufory Node bywają widokiem na większą pulę.
    const audio = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return { audio, contentType: "audio/mpeg" };
  }
  return {
    audio: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? contentTypeFallback,
  };
}
