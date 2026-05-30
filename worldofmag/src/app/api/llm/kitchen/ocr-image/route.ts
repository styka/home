import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GROQ_VISION_MODEL, GROQ_TEXT_MODEL, groqChat, stripJsonFence } from "@/lib/groqVision";

// Import przepisu ze zdjęcia — DWUETAPOWO (rozdzielone „czytanie" od „układania"):
//   1) model wizyjny wiernie przepisuje cały tekst ze zdjęcia (transkrypcja),
//   2) model tekstowy układa transkrypcję w ustrukturyzowany przepis (JSON).
// Wcześniej robiliśmy to jednym strzałem (zdjęcie → sztywny JSON), przez co model
// wizyjny często „poddawał się" i zwracał {"error":"not-a-recipe"} → błąd 422,
// nawet dla czytelnych kartek z przepisem. Dwa kroki są znacznie pewniejsze.

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
  const apiKey = config.value;

  // --- Krok 1: transkrypcja obrazu (model wizyjny) ---
  const vision = await groqChat(apiKey, {
    model: GROQ_VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: TRANSCRIBE_PROMPT },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 3000,
  });
  if (!vision.ok) {
    return NextResponse.json({ error: `Groq (${vision.status}): ${vision.message}` }, { status: 502 });
  }

  const transcript = vision.content.trim();
  if (!transcript || /^brak\.?$/i.test(transcript) || transcript.length < 12) {
    return NextResponse.json(
      { error: "Na zdjęciu nie udało się odczytać tekstu przepisu. Spróbuj wyraźniejszego/jaśniejszego zdjęcia." },
      { status: 422 }
    );
  }

  // --- Krok 2: strukturyzacja transkrypcji w przepis (model tekstowy, tryb JSON) ---
  const structured = await groqChat(apiKey, {
    model: GROQ_TEXT_MODEL,
    messages: [
      { role: "system", content: STRUCTURE_PROMPT },
      { role: "user", content: transcript },
    ],
    temperature: 0.1,
    max_tokens: 3000,
    response_format: { type: "json_object" },
  });
  if (!structured.ok) {
    return NextResponse.json({ error: `Groq (${structured.status}): ${structured.message}` }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(stripJsonFence(structured.content));
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
