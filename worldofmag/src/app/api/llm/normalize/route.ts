import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";

const SYSTEM_PROMPT = `Jesteś asystentem listy zakupów. Użytkownik poda Ci tekst (mówiony lub pisany) opisujący produkty do kupienia.
Przekształć go w tablicę JSON obiektów produktów.

Zasady:
- Każdy obiekt musi mieć pola: name (string, nazwa produktu po polsku, małymi literami), quantity (number lub null), unit (string lub null)
- Jednostki: kg, dkg, g, l, ml, szt, op, paczka, butelka, puszka, torebka, słoik
- Normalizuj nazwy produktów (np. "jabłuszka" → "jabłka", "dwa litry mleka" → name:"mleko", quantity:2, unit:"l")
- Zwróć TYLKO tablicę JSON, bez żadnego innego tekstu.

Przykład wejścia: "pół kilo jabłek, dwa litry mleka i chleb i 20 deko sera"
Przykład wyjścia: [{"name":"jabłka","quantity":0.5,"unit":"kg"},{"name":"mleko","quantity":2,"unit":"l"},{"name":"chleb","quantity":null,"unit":null},{"name":"ser żółty","quantity":20,"unit":"dkg"}]`;

export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text.trim() },
    ],
    temperature: 0.1,
    maxTokens: 1024,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const content: string = result.content || "[]";

  let items: Array<{ name: string; quantity: number | null; unit: string | null }>;
  try {
    items = JSON.parse(content.trim());
    if (!Array.isArray(items)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }

  return NextResponse.json({ items });
}
