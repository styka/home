import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GROQ_VISION_MODEL, groqChat, stripJsonFence } from "@/lib/groqVision";

// Odczyt CAŁEGO tekstu ze zdjęcia (np. kartki z przepisem) i zwrócenie go jako Markdown.
// W odróżnieniu od /ocr-image (które parsuje ustrukturyzowany przepis) — tu chcemy
// wierną transkrypcję treści kartki, którą prezentujemy obok zdjęcia.
const SYSTEM_PROMPT = `Jesteś OCR-em. Otrzymasz zdjęcie (np. kartka z przepisem, strona książki, notatka).
Przepisz CAŁY widoczny, czytelny tekst i zwróć go jako czysty Markdown — zachowaj nagłówki,
listy (składniki) i akapity (kroki) tak, jak wynikają z układu. Nie tłumacz, nie dodawaj
komentarzy ani treści, której nie ma na zdjęciu. Zachowaj język oryginału.
Zwróć WYŁĄCZNIE obiekt JSON (bez markdown-fence, bez komentarza):
{ "hasText": boolean, "markdown": string }
hasText=false i markdown="" tylko gdy na zdjęciu nie ma żadnego czytelnego tekstu.`;

const MAX_BYTES = 8 * 1024 * 1024;

function isValidDataUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(s);
}

function approxBase64Bytes(s: string): number {
  const idx = s.indexOf(",");
  if (idx < 0) return 0;
  return Math.floor(((s.length - idx - 1) * 3) / 4);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image } = (await req.json().catch(() => ({}))) as { image?: string };
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "Brak obrazu" }, { status: 400 });
  }
  if (!isValidDataUrl(image)) {
    return NextResponse.json({ error: "Niepoprawny format obrazu (oczekiwany data:image/...;base64,...)" }, { status: 400 });
  }
  if (approxBase64Bytes(image) > MAX_BYTES) {
    return NextResponse.json({ error: "Obraz za duży (max 8 MB)" }, { status: 413 });
  }

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w panelu admina." },
      { status: 503 }
    );
  }

  const groq = await groqChat(config.value, {
    model: GROQ_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: SYSTEM_PROMPT },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });

  if (!groq.ok) {
    return NextResponse.json({ error: `Groq (${groq.status}): ${groq.message}` }, { status: 502 });
  }

  const content: string = groq.content || "{}";

  try {
    const parsed = JSON.parse(stripJsonFence(content));
    const markdown = typeof parsed.markdown === "string" ? parsed.markdown.trim() : "";
    const hasText = parsed.hasText === true && markdown.length > 0;
    return NextResponse.json({ hasText, markdown: hasText ? markdown : "" });
  } catch {
    // Gdy model nie zwrócił JSON, ale zwrócił sam tekst — potraktuj go jako transkrypcję.
    const fallback = content.trim();
    if (fallback && fallback !== "{}") {
      return NextResponse.json({ hasText: true, markdown: fallback });
    }
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }
}
