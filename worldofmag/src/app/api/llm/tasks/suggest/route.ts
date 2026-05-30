import { NextRequest } from "next/server";
import { chatComplete, chatStream } from "@/lib/llm/chat";

export async function POST(req: NextRequest) {
  const { task, mode } = await req.json() as {
    task: { title: string; description?: string | null };
    mode: "subtasks" | "description" | "estimate";
  };

  let systemPrompt = "";
  let userMessage = "";

  if (mode === "subtasks") {
    systemPrompt = `Jesteś asystentem produktywności. Dla podanego zadania zaproponuj listę podzadań (subtasków).
Odpowiedz w formacie JSON: {"subtasks": ["podzadanie 1", "podzadanie 2", ...]}
Maksymalnie 6 podzadań, każde zwięzłe (do 60 znaków). Zwróć TYLKO JSON.`;
    userMessage = `Zadanie: "${task.title}"${task.description ? `\nOpis: ${task.description}` : ""}`;
  } else if (mode === "description") {
    systemPrompt = `Jesteś asystentem produktywności. Dla podanego tytułu zadania napisz krótki, pomocny opis (2-3 zdania) po polsku. Zwróć TYLKO tekst opisu, bez formatowania.`;
    userMessage = `Tytuł zadania: "${task.title}"`;
  } else if (mode === "estimate") {
    systemPrompt = `Jesteś asystentem produktywności. Oszacuj czas potrzebny do wykonania zadania w minutach.
Odpowiedz w formacie JSON: {"estimatedMins": 30}
Zwróć TYLKO JSON.`;
    userMessage = `Zadanie: "${task.title}"${task.description ? `\nOpis: ${task.description}` : ""}`;
  }

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userMessage },
  ];

  if (mode === "description") {
    return chatStream({
      op: "dispatch",
      messages,
      temperature: 0.3,
      maxTokens: 512,
    });
  }

  const result = await chatComplete({
    op: "dispatch",
    messages,
    temperature: 0.3,
    maxTokens: 512,
  });

  if (!result.ok) return new Response(result.message, { status: result.status });

  const content = result.content || "{}";
  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    return new Response(cleaned, { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }
}
