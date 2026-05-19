import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `You are an SVG icon designer for a grocery shopping app. Generate exactly 6 different minimalist SVG icons.

Rules:
- Each icon must fit within a 24x24 coordinate space
- Use SVG elements: path, circle, rect, line, polyline, polygon, ellipse
- All elements must use stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
- Designs must be simple, clean, recognizable (similar to Lucide icons style)
- Return ONLY a valid JSON array with exactly 6 strings, no explanation text
- Each string is the INNER content of <svg viewBox="0 0 24 24"> — do NOT include the outer <svg> wrapper
- Make each of the 6 icons visually distinct from one another

Example output format (for category "Bakery"):
["<path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'/>","<rect x='3' y='8' width='18' height='12' rx='3'/><path d='M8 8V6a4 4 0 0 1 8 0v2'/>"]`;

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
          content: `Generate 6 different SVG icons for the grocery shopping category: "${category}". Return only the JSON array.`,
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
