import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function detailToComplexity(detail: number): string {
  if (detail <= 30) return "Very simple: 3-5 shapes total, bold outlines, minimal detail — like a simple sticker emoji.";
  if (detail <= 70) return "Standard emoji complexity: 6-12 shapes, clear recognizable silhouette, subtle details like highlights or shadows.";
  return "Rich emoji: 12-20 shapes, multiple colors, subtle gradients, detailed textures — like a high-quality Apple emoji.";
}

const BASE_SYSTEM_PROMPT = `You are an emoji-style SVG icon designer for a Polish grocery shopping app.
Your task: generate exactly 6 SVG icons that look like modern phone emoji (Apple / Google / Samsung emoji style).

CRITICAL RULES:
- ViewBox: 0 0 24 24
- Each icon shows ONE clearly recognizable real-world object, centered in the 24x24 space
- Colors must match the real-world appearance of the depicted item (carrot = orange, apple = red, cheese = yellow, shoe = brown, etc.)
- EVERY visible shape MUST have an explicit fill="#XXXXXX" attribute with a hex color
- Do NOT use fill="none" on visible shapes — only on invisible clip/mask elements
- Do NOT use fill="currentColor" anywhere
- Optional: thin light stroke for definition (stroke="#ffffff" stroke-width="0.5" or stroke="#00000033")
- SVG elements to use: path, circle, rect, ellipse, polygon, polyline
- Return ONLY a valid JSON array of exactly 6 strings — no markdown, no explanation
- Each string is the raw INNER content of <svg viewBox="0 0 24 24"> (NO outer svg tag)
- Each of the 6 icons must depict a DIFFERENT specific item
- The icon must be immediately recognizable — like a real emoji on a phone keyboard`;

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

  const complexity = detailToComplexity(detail);

  const itemsLine = additionalText
    ? `IMPORTANT — draw EXACTLY these items (names are in Polish, translate to understand what to draw): ${additionalText}`
    : `Choose 6 iconic, visually distinct items that best represent this category.`;

  const userMessage = [
    category
      ? `Polish grocery category name: "${category}" (this is a Polish name — understand what it means and draw matching items)`
      : "Grocery items for a shopping app.",
    itemsLine,
    `Complexity level: ${complexity}`,
    `Each icon must look like a real emoji you'd see on a phone — colorful, centered, instantly recognizable.`,
    "Return only the JSON array of 6 SVG inner content strings.",
  ].join("\n");

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nComplexity for this request: ${complexity}`;

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
