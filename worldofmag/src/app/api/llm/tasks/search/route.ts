import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/platform/llm/chat";
import { auth } from "@/platform/auth/session";
import { usageField } from "@/platform/ai/costVisibility";

export async function POST(req: NextRequest) {
  // Sesję wymusza już middleware; auth() jest tu po `userId` — bez niego chatComplete nie
  // wiązał kosztu z użytkownikiem, więc licznik zużycia i miesięczny limit planu pomijały
  // te wywołania (dawały się obejść „tańszą" trasą pomocniczą).
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { query, tasks } = await req.json() as {
    query: string;
    tasks: Array<{ id: string; title: string; description?: string | null; tags?: string[]; status?: string; priority?: string }>;
  };

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

  const result = await chatComplete({
    op: "reasoning",
    userId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.1,
    maxTokens: 256,
  });

  if (!result.ok) return new Response('{"matches":[]}', { headers: { "Content-Type": "application/json" } });

  const content = result.content || '{"matches":[]}';
  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    // 037: doklejamy koszt do odpowiedzi, więc treść modelu musi przejść przez parsowanie —
    // wcześniej szła do klienta w postaci surowej.
    return NextResponse.json({ ...JSON.parse(cleaned), ...(await usageField(result, "wyszukiwanie zadań")) });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
