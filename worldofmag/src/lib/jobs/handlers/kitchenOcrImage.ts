// Z-131 (T-17) — handler zadania: import przepisu ze zdjęcia (OCR wizyjny, 2-etapowy).
// Logika przeniesiona z trasy `/api/llm/kitchen/ocr-image` (jedno źródło prawdy).
// Rzuca `JobError(status)` przy błędach — worker mapuje na porażkę, cienka trasa na HTTP.

import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";
import { JobError, type JobContext } from "@/lib/jobs/types";

const TRANSCRIBE_PROMPT = `Jesteś precyzyjnym OCR-em. Przepisz CAŁY czytelny tekst ze zdjęcia
(kartka, strona książki kucharskiej, notatka albo ekran z przepisem). Zachowaj składniki i kroki
tak jak są. Nie tłumacz, nie streszczaj, nie dodawaj niczego od siebie. Zwróć wyłącznie przepisany
tekst (może być w Markdown). Jeśli na zdjęciu nie ma żadnego czytelnego tekstu — zwróć dokładnie: BRAK.`;

const STRUCTURE_PROMPT = `Otrzymasz transkrypcję przepisu kulinarnego (tekst odczytany ze zdjęcia).
Ułóż go w obiekt JSON (zwróć WYŁĄCZNIE JSON, bez markdown, bez komentarza) w schemacie:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prepMinutes": number|null,
  "cookMinutes": number|null,
  "cuisine": string|null,
  "mealType": "breakfast"|"lunch"|"dinner"|"snack"|"dessert"|null,
  "ingredients": [{"name":string,"quantity":number|null,"unit":string|null,"note":string|null,"isOptional":boolean}],
  "steps": [{"text":string}]
}
Wszystko po polsku, pole name małymi literami. Nie wymyślaj składników ani kroków, których nie ma
w transkrypcji. Jeśli czegoś nie podano — użyj null (lub pustej listy). Gdy brak tytułu — utwórz krótki
na podstawie głównego składnika.`;

const MAX_BYTES = 8 * 1024 * 1024;

export interface OcrImagePayload {
  image?: string;
}

function isValidDataUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(s);
}
function approxBase64Bytes(s: string): number {
  const idx = s.indexOf(",");
  if (idx < 0) return 0;
  return Math.floor(((s.length - idx - 1) * 3) / 4);
}

export interface OcrRecipeResult {
  recipe: {
    title: string;
    description: string | null;
    servings: number | null;
    prepMinutes: number | null;
    cookMinutes: number | null;
    cuisine: string | null;
    mealType: string | null;
    ingredients: unknown[];
    steps: unknown[];
  };
}

/** Rdzeń: obraz (data URL) → ustrukturyzowany przepis. Rzuca JobError przy błędach. */
export async function kitchenOcrImageHandler(payload: OcrImagePayload, ctx: JobContext): Promise<OcrRecipeResult> {
  const image = payload?.image;
  if (!image || typeof image !== "string") throw new JobError("Brak obrazu", 400);
  if (!isValidDataUrl(image)) throw new JobError("Niepoprawny format obrazu (oczekiwany data:image/...;base64,...)", 400);
  if (approxBase64Bytes(image) > MAX_BYTES) throw new JobError("Obraz za duży (max 8 MB)", 413);

  // Krok 1: transkrypcja (model wizyjny). userId → budżet + zliczenie tokenów.
  const vision = await chatComplete({
    op: "vision",
    userId: ctx.ownerId ?? undefined,
    messages: [
      { role: "user", content: [
        { type: "text", text: TRANSCRIBE_PROMPT },
        { type: "image_url", image_url: { url: image } },
      ] },
    ],
    temperature: 0.1,
    maxTokens: 3000,
  });
  if (!vision.ok) throw new JobError(vision.message, vision.status);

  const transcript = vision.content.trim();
  if (!transcript || /^brak\.?$/i.test(transcript) || transcript.length < 12) {
    throw new JobError("Na zdjęciu nie udało się odczytać tekstu przepisu. Spróbuj wyraźniejszego/jaśniejszego zdjęcia.", 422);
  }

  // Krok 2: strukturyzacja transkrypcji (model tekstowy, JSON).
  const structured = await chatComplete({
    op: "generation",
    userId: ctx.ownerId ?? undefined,
    messages: [
      { role: "system", content: STRUCTURE_PROMPT },
      { role: "user", content: transcript },
    ],
    temperature: 0.1,
    maxTokens: 3000,
    json: true,
  });
  if (!structured.ok) throw new JobError(structured.message, structured.status);

  try {
    const parsed = JSON.parse(stripJsonFence(structured.content));
    return {
      recipe: {
        title: String(parsed.title ?? "Bez nazwy"),
        description: parsed.description ?? null,
        servings: parsed.servings ?? null,
        prepMinutes: parsed.prepMinutes ?? null,
        cookMinutes: parsed.cookMinutes ?? null,
        cuisine: parsed.cuisine ?? null,
        mealType: parsed.mealType ?? null,
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      },
    };
  } catch {
    throw new JobError("LLM zwrócił nieprawidłowy format", 502);
  }
}
