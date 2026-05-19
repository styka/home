import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GROQ_ITEMS_SYSTEM = `You are a grocery assistant. Return ONLY a JSON array of exactly 6 English grocery item names (1-3 words each). No markdown, no explanation.`;

async function getEnglishItems(category: string, additionalText: string, groqKey: string): Promise<string[]> {
  const userMsg = additionalText
    ? `Translate these Polish grocery items to English (keep each 1-3 words): ${additionalText}\nIf fewer than 6, add related items from the same theme. Return exactly 6.`
    : `Polish grocery category: "${category}". List 6 specific typical items in English.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "system", content: GROQ_ITEMS_SYSTEM }, { role: "user", content: userMsg }],
      temperature: 0.4,
      max_tokens: 150,
    }),
  });
  if (!res.ok) throw new Error("Groq error");
  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "[]";
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error("bad format");
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("not array");
  return parsed.filter((s): s is string => typeof s === "string").slice(0, 6);
}

async function generateImage(item: string): Promise<string> {
  const prompt = encodeURIComponent(
    `flat emoji style icon of ${item}, white background, centered, bold colorful simple shapes, like Apple emoji, no text, no shadows`
  );
  const seed = Math.floor(Math.random() * 99999);
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=128&height=128&nologo=true&model=flux-schnell&seed=${seed}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const buf = await res.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(buf).toString("base64")}`;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const category: string = body.category ?? "";
  const additionalText: string = typeof body.additionalText === "string" ? body.additionalText.trim() : "";

  if (!category.trim() && !additionalText) {
    return NextResponse.json({ error: "Podaj kategorię lub opis" }, { status: 400 });
  }

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json({ error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w Panelu Admina." }, { status: 503 });
  }

  // Step 1: translate to English item names
  let items: string[];
  try {
    items = await getEnglishItems(category, additionalText, config.value);
    if (items.length === 0) throw new Error("empty");
  } catch {
    return NextResponse.json({ error: "Nie udało się wygenerować listy elementów" }, { status: 500 });
  }

  // Step 2: generate images in parallel
  const results = await Promise.allSettled(items.map((item) => generateImage(item)));
  const svgs = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);

  if (svgs.length === 0) {
    return NextResponse.json({ error: "Generowanie obrazów nie powiodło się. Spróbuj ponownie." }, { status: 500 });
  }

  return NextResponse.json({ svgs });
}
