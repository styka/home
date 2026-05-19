import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function detailToStyle(detail: number): string {
  if (detail <= 30) return "ultra-simplified, maximum 3-4 geometric primitives per icon, like a simple logo or monochrome pictogram";
  if (detail <= 70) return "flat design, emoji-like, bold simple shapes with 2-4 colors";
  return "detailed flat illustration with multiple elements, subtle gradients, texture, and careful shading";
}

const BASE_SYSTEM_PROMPT = `You are a colorful icon designer for a grocery shopping app.
Generate exactly 6 different COLORFUL SVG icons.

Rules:
- Fit within a 24x24 coordinate space
- Use SVG elements: path, circle, rect, ellipse, polygon, line
- COLORFUL: every visible shape must have an explicit fill="COLOR" attribute (e.g. fill="#4ade80")
- Do NOT use "currentColor" or fill="none" on visible shapes
- Use colors that match each item's real-world appearance
- Optional thin stroke (e.g. stroke="#fff" stroke-width="0.5") for contrast
- Return ONLY a valid JSON array of exactly 6 strings, no explanation
- Each string is the INNER content of <svg viewBox="0 0 24 24"> (no outer wrapper)
- Each icon must depict a DIFFERENT specific item`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category: string = body.category ?? "";
  const detail: number = typeof body.detail === "number" ? Math.max(0, Math.min(100, body.detail)) : 50;
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

  const styleDesc = detailToStyle(detail);

  const userMessage = [
    category ? `Generate 6 colorful SVG icons for the grocery category: "${category}".` : "Generate 6 colorful SVG icons.",
    `Draw 6 different specific items relevant to the theme, one per icon.`,
    `Style: ${styleDesc}.`,
    additionalText ? `Draw these specific items (one per icon): ${additionalText}.` : "",
    "Return only the JSON array.",
  ].filter(Boolean).join(" ");

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n- Style for this request: ${styleDesc}`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.value}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.9,
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
