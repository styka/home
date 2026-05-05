import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { task, mode } = await req.json() as {
    task: { title: string; description?: string | null };
    mode: "subtasks" | "description" | "estimate";
  };

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) return new Response("Groq API key not configured", { status: 503 });

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

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.value}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 512,
      stream: mode === "description",
    }),
  });

  if (!response.ok || !response.body) return new Response("LLM request failed", { status: 502 });

  if (mode === "description") {
    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    return new Response(cleaned, { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  }
}
