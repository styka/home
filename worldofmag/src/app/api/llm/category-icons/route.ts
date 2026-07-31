import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";
import { usageField } from "@/lib/ai/costVisibility";

const GROQ_ITEMS_SYSTEM = `You are a shopping assistant for a Polish app. The app supports any shopping category (food, pets, cleaning, tools, etc.). Return ONLY a JSON array of exactly 6 English item names (1-3 words each) that are visually distinct and typical for the given category. No markdown, no explanation.`;

async function getEnglishItems(
  category: string,
  additionalText: string
): Promise<{ items: string[]; res: Awaited<ReturnType<typeof chatComplete>> }> {
  const userMsg = additionalText
    ? `Polish shopping category: "${category}". The user also described these items in Polish: "${additionalText}". Translate the described items to English (1-3 words each). If fewer than 6, add similar items from the same category. Return exactly 6 as a JSON array.`
    : `Polish shopping category: "${category}" (interpret this as a Polish word). List 6 specific, visually distinct typical items from this category in English. Return exactly 6 as a JSON array.`;

  const result = await chatComplete({
    op: "dispatch",
    messages: [{ role: "system", content: GROQ_ITEMS_SYSTEM }, { role: "user", content: userMsg }],
    temperature: 0.4,
    maxTokens: 150,
  });
  if (!result.ok) throw new Error(result.message);
  const text: string = result.content || "[]";
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error("bad format");
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("not array");
  // 037: obok nazw zwracamy wynik wywołania — trasa liczy z niego koszt. Świadomie NIE przez
  // zmienną modułową: dwa równoległe żądania nadpisywałyby sobie zużycie nawzajem.
  return { items: parsed.filter((s): s is string => typeof s === "string").slice(0, 6), res: result };
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

  // Step 1: translate to English item names
  let items: string[];
  let itemsCall: Awaited<ReturnType<typeof chatComplete>> | undefined;
  try {
    const r = await getEnglishItems(category, additionalText);
    items = r.items;
    itemsCall = r.res;
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

  return NextResponse.json({ svgs, ...(itemsCall ? await usageField(itemsCall, "lista elementów") : {}) });
}
