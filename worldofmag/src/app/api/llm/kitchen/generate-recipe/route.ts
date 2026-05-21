import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `Jesteś szefem kuchni. Otrzymasz krótki opis dania po polsku (np. "spaghetti carbonara dla 2 osób", "szybki obiad z kurczakiem w 30 minut", "wegański deser bez piekarnika").
Wygeneruj kompletny, realistyczny przepis. Zwróć WYŁĄCZNIE JSON (bez markdown, bez komentarza) w schemacie:
{
  "title": string,
  "description": string|null,
  "servings": number,
  "prepMinutes": number|null,
  "cookMinutes": number|null,
  "cuisine": string|null,
  "mealType": "breakfast"|"lunch"|"dinner"|"snack"|"dessert"|null,
  "ingredients": [{"name":string,"quantity":number|null,"unit":string|null,"note":string|null,"isOptional":boolean}],
  "steps": [{"text":string}]
}

Zasady:
- Tytuł krótki, opisowy, po polsku.
- Składniki realistyczne, ilości w typowych jednostkach (g, kg, ml, l, łyżka, łyżeczka, szt). Małe litery w "name".
- Kroki krótkie i konkretne, max 10 kroków, po polsku.
- "cuisine"/"mealType"/"servings" dopasuj do treści promptu; jeśli user podał liczbę osób — użyj jej, inaczej 2.
- Jeśli prompt nie wygląda jak opis dania (np. spam, pytania bez sensu) — zwróć {"error":"not-a-recipe"}.`;

interface GenerateInput {
  prompt?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = (await req.json().catch(() => ({}))) as GenerateInput;
  const trimmed = prompt?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Podaj opis dania" }, { status: 400 });
  }
  if (trimmed.length > 500) {
    return NextResponse.json({ error: "Opis za długi (max 500 znaków)" }, { status: 400 });
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
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: trimmed },
      ],
      temperature: 0.4,
      max_tokens: 2500,
      response_format: { type: "json_object" },
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text().catch(() => "unknown");
    return NextResponse.json({ error: `Groq error: ${err.slice(0, 200)}` }, { status: 502 });
  }

  const data = await groqRes.json();
  const content: string = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    if (parsed.error) {
      return NextResponse.json({ error: "Z opisu nie wynika przepis — doprecyzuj prompt" }, { status: 422 });
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
