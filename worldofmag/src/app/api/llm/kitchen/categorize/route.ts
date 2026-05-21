import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `Jesteś asystentem kulinarnym. Otrzymasz tytuł, opis, składniki i kroki przepisu.
Zwróć WYŁĄCZNIE obiekt JSON (bez markdown, bez komentarza) w schemacie:
{
  "cuisine": string|null,
  "mealType": "breakfast"|"lunch"|"dinner"|"snack"|"dessert"|null,
  "difficulty": "easy"|"medium"|"hard",
  "tags": string[]
}

Zasady:
- "cuisine" — po polsku, mała litera ("polska", "włoska", "azjatycka", "meksykańska", "francuska", "śródziemnomorska", "indyjska", "tajska", "japońska", "amerykańska"); jeśli nie da się określić → null
- "mealType" — wybierz JEDEN slot najlepiej pasujący do typowego serwowania
- "difficulty":
  - "easy": ≤5 składników i ≤4 kroki LUB bardzo prosta technika (kanapki, sałatki, owsianka)
  - "medium": typowe domowe gotowanie (większość obiadów)
  - "hard": >12 składników LUB >10 kroków LUB zaawansowane techniki (sos holenderski, ciasto francuskie, sushi)
- "tags" — 2-5 krótkich tagów po polsku, małymi literami (np. "wegetariańskie", "szybkie", "fit", "comfort food", "na patelni", "z piekarnika", "jednogarnkowe"); BEZ powielania pól "cuisine"/"mealType"
`;

interface CategorizeInput {
  title?: string;
  description?: string | null;
  ingredients?: Array<{ name: string }>;
  steps?: Array<{ text: string }>;
}

const VALID_MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack", "dessert"]);
const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CategorizeInput;
  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "Tytuł jest wymagany" }, { status: 400 });

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w panelu admina." },
      { status: 503 }
    );
  }

  const ingredients = (body.ingredients ?? []).map((i) => i.name).filter(Boolean).slice(0, 30);
  const steps = (body.steps ?? []).map((s) => s.text?.slice(0, 200)).filter(Boolean).slice(0, 15);

  const userContent = [
    `Tytuł: ${title}`,
    body.description ? `Opis: ${body.description.slice(0, 300)}` : null,
    ingredients.length > 0 ? `Składniki (${ingredients.length}):\n- ${ingredients.join("\n- ")}` : null,
    steps.length > 0 ? `Kroki (${steps.length}):\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : null,
  ].filter(Boolean).join("\n\n");

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.value}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent.slice(0, 4000) },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text().catch(() => "unknown");
    return NextResponse.json({ error: `Groq error: ${err}` }, { status: 502 });
  }

  const data = await groqRes.json();
  const content: string = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    const cuisine = typeof parsed.cuisine === "string" ? parsed.cuisine.toLowerCase().trim() : null;
    const mealTypeRaw = typeof parsed.mealType === "string" ? parsed.mealType.toLowerCase().trim() : null;
    const mealType = mealTypeRaw && VALID_MEAL_TYPES.has(mealTypeRaw) ? mealTypeRaw : null;
    const difficultyRaw = typeof parsed.difficulty === "string" ? parsed.difficulty.toLowerCase().trim() : "medium";
    const difficulty = VALID_DIFFICULTIES.has(difficultyRaw) ? difficultyRaw : "medium";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t: unknown): t is string => typeof t === "string")
          .map((t: string) => t.toLowerCase().trim())
          .filter((t: string) => t.length > 0 && t.length <= 30)
          .slice(0, 5)
      : [];

    return NextResponse.json({ cuisine, mealType, difficulty, tags });
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }
}
