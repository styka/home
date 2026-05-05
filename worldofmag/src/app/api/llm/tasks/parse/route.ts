import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `Jesteś asystentem zarządzania zadaniami. Użytkownik poda tekst opisujący jedno lub więcej zadań.
Przekształć go w tablicę JSON obiektów zadań.

Każdy obiekt musi mieć pola:
- title: string (tytuł zadania, zwięzły, po polsku)
- description: string | null (opcjonalny opis)
- priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
- dueDate: string | null (ISO 8601 data, np. "2024-05-10T10:00:00.000Z", lub null)
- estimatedMins: number | null (szacowany czas w minutach, lub null)
- tags: string[] (tagi jako słowa kluczowe, małymi literami, max 3)
- recurring: null | { type: "DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY", interval: number, daysOfWeek?: number[] }

Zasady interpretacji:
- "pilne", "asap", "natychmiast" → priority: "URGENT"
- "ważne", "wysoki priorytet" → priority: "HIGH"
- "jutro" → dueDate: jutrzejsza data
- "w piątek", "w weekend" → odpowiedni dzień tygodnia
- "co tydzień", "co środę" → recurring WEEKLY
- "codziennie" → recurring DAILY
- "co miesiąc" → recurring MONTHLY
- Dzisiejsza data jest podana w kontekście użytkownika.

Zwróć TYLKO tablicę JSON, bez dodatkowego tekstu.

Przykład: "Zadzwoń do dentysty w piątek, pilne, ok 30 minut"
Odpowiedź: [{"title":"Zadzwoń do dentysty","description":null,"priority":"URGENT","dueDate":"2024-05-10T09:00:00.000Z","estimatedMins":30,"tags":["zdrowie"],"recurring":null}]`;

export async function POST(req: NextRequest) {
  const { text, today } = await req.json().catch(() => ({ text: "", today: new Date().toISOString() }));
  if (!text?.trim()) return NextResponse.json({ error: "Empty text" }, { status: 400 });

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w Panelu Admina." },
      { status: 503 }
    );
  }

  const userMsg = `Dzisiejsza data: ${today}\n\nZadanie do sparsowania: ${text.trim()}`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.value}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
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

  let tasks: unknown[];
  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    tasks = JSON.parse(cleaned);
    if (!Array.isArray(tasks)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }

  return NextResponse.json({ tasks });
}
