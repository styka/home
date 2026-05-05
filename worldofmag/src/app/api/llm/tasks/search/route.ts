import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { query, tasks } = await req.json() as {
    query: string;
    tasks: Array<{ id: string; title: string; description?: string | null; tags?: string[]; status?: string; priority?: string }>;
  };

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) return new Response("Groq API key not configured", { status: 503 });

  const tasksContext = tasks
    .slice(0, 100)
    .map((t, i) => `[${i}] ${t.title}${t.description ? ` — ${t.description.slice(0, 80)}` : ""}${t.tags?.length ? ` #${t.tags.join(" #")}` : ""} (${t.status ?? "TODO"}, ${t.priority ?? "NONE"})`)
    .join("\n");

  const systemPrompt = `Jesteś asystentem wyszukiwania zadań. Masz listę zadań użytkownika i zapytanie.
Zwróć indeksy (od 0) zadań które najlepiej pasują do zapytania, posortowane od najlepszego.
Format odpowiedzi: {"matches": [0, 5, 2, 8]}
Maksymalnie 20 wyników. Jeśli brak pasujących: {"matches": []}
Zwróć TYLKO JSON.`;

  const userMessage = `Zadania:\n${tasksContext}\n\nZapytanie: "${query}"`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.value}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: 256,
    }),
  });

  if (!response.ok) return new Response('{"matches":[]}', { headers: { "Content-Type": "application/json" } });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '{"matches":[]}';
  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    return new Response(cleaned, { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response('{"matches":[]}', { headers: { "Content-Type": "application/json" } });
  }
}
