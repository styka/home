import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CATEGORY_ITEMS: Record<string, string[]> = {
  "Produce":            ["carrot", "apple", "broccoli", "tomato", "onion", "lettuce", "avocado", "lemon"],
  "Dairy & Eggs":       ["milk bottle", "cheese wheel", "butter block", "egg", "yogurt jar", "cream"],
  "Meat & Fish":        ["steak", "chicken leg", "fish", "bacon strips", "sausage", "shrimp"],
  "Bakery":             ["loaf of bread", "croissant", "baguette", "donut", "muffin", "pretzel"],
  "Dry Goods & Pasta":  ["pasta bowl", "rice bag", "flour sack", "beans", "cereal box", "lentils"],
  "Drinks":             ["water bottle", "coffee cup", "juice box", "wine glass", "beer mug", "tea cup"],
  "Frozen":             ["ice cube", "frozen bag", "ice cream", "snowflake", "frozen peas", "popsicle"],
  "Snacks & Sweets":    ["chocolate bar", "candy", "chips bag", "cookie", "popcorn", "gummy bears"],
  "Condiments & Oils":  ["olive oil bottle", "ketchup", "mustard jar", "honey jar", "salt shaker", "vinegar"],
  "Spices & Herbs":     ["basil leaf", "pepper grinder", "cinnamon stick", "garlic", "chili pepper", "herb bundle"],
  "Cleaning & Hygiene": ["soap bar", "shampoo bottle", "toothbrush", "toilet paper roll", "cleaning spray", "sponge"],
  "Canned & Preserved": ["tin can", "glass jar", "preserved tomatoes", "canned beans", "pickle jar"],
  "Other":              ["shopping bag", "box", "label", "price tag", "shopping cart"],
};

const SYSTEM_PROMPT = `You are a colorful icon designer for a grocery shopping app.
Generate exactly 6 different COLORFUL, flat-design SVG icons.

Rules:
- Fit within a 24x24 coordinate space
- Use SVG elements: path, circle, rect, ellipse, polygon, line
- COLORFUL: every visible shape must have an explicit fill="COLOR" attribute (e.g. fill="#4ade80")
- Do NOT use "currentColor" or fill="none" on visible shapes
- Use 2-4 colors per icon that naturally suit the item's real-world appearance
- Simple, bold flat shapes — think simplified emoji style
- Optional thin stroke (e.g. stroke="#fff" stroke-width="0.5") for contrast
- Return ONLY a valid JSON array of exactly 6 strings, no explanation
- Each string is the INNER content of <svg viewBox="0 0 24 24"> (no outer wrapper)
- Each icon must depict a DIFFERENT specific item from the given list`;

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

  const items = CATEGORY_ITEMS[category] ?? [];
  const itemsHint = items.length > 0
    ? `Draw these specific items (one per icon): ${items.slice(0, 6).join(", ")}.`
    : `Draw 6 different items commonly found in the "${category}" category.`;

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
          content: `Generate 6 colorful SVG icons for the grocery category: "${category}". ${itemsHint} Use colors that match each item's natural appearance (e.g. orange for carrot, red for apple, yellow for cheese). Return only the JSON array.`,
        },
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
