// Aktualny model wizyjny Groq (rozpoznawanie obrazów / OCR).
//
// UWAGA: poprzednio używaliśmy `llama-3.2-11b-vision-preview` i `…-90b-vision-preview` —
// Groq je WYCOFAŁ (model_decommissioned), przez co każde zapytanie OCR kończyło się
// błędem i przepis nie powstawał. Modele z serii Llama 4 (scout/maverick) zastąpiły
// preview wizyjne i przyjmują `image_url` w API zgodnym z OpenAI.
//
// Trzymane w jednym miejscu, by przy kolejnej zmianie nazwy nie rozjechały się
// trasy /api/llm/kitchen/ocr-image i /ocr-text.
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// Model tekstowy do drugiego kroku OCR (strukturyzacja transkrypcji w przepis).
// Rozdzielenie „czytania obrazu" (model wizyjny) od „układania w JSON" (model tekstowy)
// jest dużo pewniejsze niż jednostrzałowe wyciąganie sztywnego JSON-a wprost ze zdjęcia —
// model wizyjny często wtedy „poddawał się" i zwracał not-a-recipe (błąd 422).
export const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";

// Wyciąga czytelny komunikat z odpowiedzi błędu Groq (JSON `{ error: { message } }`
// albo zwykły tekst), żeby na froncie zobaczyć realną przyczynę zamiast samego kodu.
export function parseGroqError(raw: string): string {
  try {
    const j = JSON.parse(raw);
    return j?.error?.message ?? j?.error ?? raw;
  } catch {
    return raw;
  }
}

export type GroqChatResult =
  | { ok: true; content: string }
  | { ok: false; status: number; message: string };

// Cienki wrapper na Groq chat completions (API zgodne z OpenAI). Wspólny dla obu
// kroków OCR i innych tras, by nie powtarzać obsługi błędów i parsowania odpowiedzi.
export async function groqChat(apiKey: string, body: Record<string, unknown>): Promise<GroqChatResult> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    return { ok: false, status: res.status, message: parseGroqError(err).slice(0, 200) };
  }
  const data = await res.json().catch(() => null);
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return { ok: true, content };
}

// Usuwa ewentualne ogrodzenie ```json ... ``` z odpowiedzi modelu przed JSON.parse.
export function stripJsonFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}
