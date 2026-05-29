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
