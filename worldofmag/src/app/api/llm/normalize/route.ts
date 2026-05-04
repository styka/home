import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.trim() },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text().catch(() => "unknown");
    return NextResponse.json({ error: `Groq error: ${err}` }, { status: 502 });
  }

  const groqData = await groqRes.json();
  const content: string = groqData.choices?.[0]?.message?.content ?? "[]";

  let items: Array<{ name: string; quantity: number | null; unit: string | null }>;
  try {
    items = JSON.parse(content.trim());
    if (!Array.isArray(items)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }

  return NextResponse.json({ items });
}
