// Z-131 (T-17) — handler: transkrypcja CAŁEGO tekstu ze zdjęcia (Markdown). Logika
// przeniesiona z `/api/llm/kitchen/ocr-text`.
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";
import { JobError, type JobContext } from "@/lib/jobs/types";
import { assertValidImage } from "@/lib/jobs/handlers/imageInput";

const SYSTEM_PROMPT = `Jesteś OCR-em. Otrzymasz zdjęcie (np. kartka z przepisem, strona książki, notatka).
Przepisz CAŁY widoczny, czytelny tekst i zwróć go jako czysty Markdown — zachowaj nagłówki,
listy (składniki) i akapity (kroki) tak, jak wynikają z układu. Nie tłumacz, nie dodawaj
komentarzy ani treści, której nie ma na zdjęciu. Zachowaj język oryginału.
Zwróć WYŁĄCZNIE obiekt JSON (bez markdown-fence, bez komentarza):
{ "hasText": boolean, "markdown": string }
hasText=false i markdown="" tylko gdy na zdjęciu nie ma żadnego czytelnego tekstu.`;

export interface OcrTextPayload { image?: string }
export interface OcrTextResult { hasText: boolean; markdown: string }

export async function kitchenOcrTextHandler(payload: OcrTextPayload, ctx: JobContext): Promise<OcrTextResult> {
  const image = assertValidImage(payload?.image);
  const groq = await chatComplete({
    op: "vision",
    userId: ctx.ownerId ?? undefined,
    messages: [{ role: "user", content: [
      { type: "text", text: SYSTEM_PROMPT },
      { type: "image_url", image_url: { url: image } },
    ] }],
    temperature: 0.1,
    maxTokens: 3000,
    json: true,
  });
  if (!groq.ok) throw new JobError(groq.message, groq.status);

  const content = groq.content || "{}";
  try {
    const parsed = JSON.parse(stripJsonFence(content));
    const markdown = typeof parsed.markdown === "string" ? parsed.markdown.trim() : "";
    const hasText = parsed.hasText === true && markdown.length > 0;
    return { hasText, markdown: hasText ? markdown : "" };
  } catch {
    const fallback = content.trim();
    if (fallback && fallback !== "{}") return { hasText: true, markdown: fallback };
    throw new JobError("LLM zwrócił nieprawidłowy format", 502);
  }
}
