import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GROQ_VISION_MODEL, parseGroqError } from "@/lib/groqVision";

const SYSTEM_PROMPT = `Jesteś OCR-em przepisów kulinarnych. Otrzymasz zdjęcie strony książki kucharskiej, kartki z notatkami albo ekranu z przepisem.
Wyciągnij przepis i zwróć WYŁĄCZNIE obiekt JSON (bez markdown, bez komentarza) w schemacie:
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
Wszystko po polsku, małymi literami w polu name. Jeśli zdjęcie nie zawiera przepisu — zwróć {"error":"not-a-recipe"}.`;

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

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.value}` },
    body: JSON.stringify({
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
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text().catch(() => "unknown");
    return NextResponse.json(
      { error: `Groq (${groqRes.status}): ${parseGroqError(err).slice(0, 200)}` },
      { status: 502 }
    );
  }

  const data = await groqRes.json();
  const content: string = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    if (parsed.error) {
      return NextResponse.json({ error: "Na zdjęciu nie rozpoznano przepisu" }, { status: 422 });
    }
    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }
}
