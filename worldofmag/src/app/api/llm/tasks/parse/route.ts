import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";

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

  const userMsg = `Dzisiejsza data: ${today}\n\nZadanie do sparsowania: ${text.trim()}`;

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.1,
    maxTokens: 1024,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const content: string = result.content || "[]";

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
