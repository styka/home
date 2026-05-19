import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are a colorful icon designer for a grocery shopping app.
Generate exactly 6 different COLORFUL, flat-design SVG icons.

Rules:
- Fit within a 24x24 coordinate space
- Use SVG elements: path, circle, rect, ellipse, polygon, line
- COLORFUL: every visible shape must have an explicit fill="COLOR" attribute (e.g. fill="#4ade80")
- Do NOT use "currentColor" or fill="none" on visible shapes
- Use 2-4 colors per icon that naturally suit the category's visual theme
- Simple, bold flat shapes — think simplified emoji style
- Optional thin stroke (e.g. stroke="#fff" stroke-width="0.5") for contrast
- Return ONLY a valid JSON array of exactly 6 strings, no explanation
- Each string is the INNER content of <svg viewBox="0 0 24 24"> (no outer wrapper)
- Make each of the 6 icons visually and color-palette distinct from the others`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category: string = body.category ?? "";

  if (!category.trim()) {
    return NextResponse.json({ error: "Brak kategorii" }, { status: 400 });
  }

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w Panelu Admina." },
      { status: 503 }
    );
  }

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
        {
          role: "user",
          content: `Generate 6 colorful SVG icons specifically for the grocery shopping category: "${category}".
Each icon must clearly depict something from the "${category}" category using colors naturally associated with "${category}" products.
Return only the JSON array.`,
        },
      ],
      temperature: 0.95,
      max_tokens: 2000,
    }),
  });

  if (!groqRes.ok) {
    return NextResponse.json({ error: "Błąd API Groq" }, { status: 502 });
  }

  const groqData = await groqRes.json();
  const text: string = groqData.choices?.[0]?.message?.content ?? "";

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    return NextResponse.json({ error: "Nie udało się wygenerować ikon" }, { status: 500 });
  }

  let svgs: string[];
  try {
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
    svgs = parsed.filter((s): s is string => typeof s === "string").slice(0, 6);
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy format ikon" }, { status: 500 });
  }

  return NextResponse.json({ svgs });
}
