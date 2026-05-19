import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are an emoji picker for a Polish grocery shopping app.
Given a grocery category or a list of specific items (names may be in Polish), return exactly 6 emoji characters — one per item.

Rules:
- Each emoji must represent a different, specific real-world item
- Translate Polish names to understand what to pick (e.g. "but" = shoe → 👟, "marchew" = carrot → 🥕)
- Use only emoji that exist on standard phone keyboards (iOS and Android)
- The emoji must visually match the item described
- Return ONLY a JSON array of exactly 6 single-emoji strings
- No text, no explanations, no markdown — just the array

Example output: ["🥕","🍎","🥦","🍅","🧅","🫙"]`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category: string = body.category ?? "";
  const additionalText: string = typeof body.additionalText === "string" ? body.additionalText.trim() : "";

  if (!category.trim() && !additionalText) {
    return NextResponse.json({ error: "Podaj kategorię lub opis" }, { status: 400 });
  }

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w Panelu Admina." },
      { status: 503 }
    );
  }

  const userMessage = additionalText
    ? `Items (names are in Polish — translate each to pick the right emoji): ${additionalText}\nReturn 6 emoji. If fewer than 6 items are listed, add closely related items from the same theme.`
    : `Polish grocery category: "${category}"\nReturn 6 emoji representing 6 different specific items typically found in this category.`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.value}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: 200,
    }),
  });

  if (!groqRes.ok) {
    return NextResponse.json({ error: "Błąd API Groq" }, { status: 502 });
  }

  const groqData = await groqRes.json();
  const text: string = groqData.choices?.[0]?.message?.content ?? "";

  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) {
    return NextResponse.json({ error: "Nie udało się wygenerować ikon" }, { status: 500 });
  }

  let svgs: string[];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
    svgs = parsed
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 6);
    if (svgs.length === 0) throw new Error("no valid emoji");
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy format ikon" }, { status: 500 });
  }

  return NextResponse.json({ svgs });
}
