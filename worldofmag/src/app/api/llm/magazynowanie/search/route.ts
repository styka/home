import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";

// Semantyczne „gdzie to jest?": z zapytania w języku naturalnym i listy pozycji
// (id + nazwa + kategoria) LLM wybiera najbardziej pasujące id. Aplikacja sama
// dokleja lokalizacje. Działa jako uzupełnienie zwykłego wyszukiwania tekstowego.

const SYSTEM_PROMPT = `Jesteś wyszukiwarką magazynu. Otrzymasz pytanie użytkownika i listę pozycji
(format "id | nazwa | kategoria"). Wybierz pozycje pasujące do intencji pytania (także synonimy,
liczba mnoga, ogólniejsze/szczegółowsze nazwy). Zwróć WYŁĄCZNIE JSON {"ids": ["id1","id2", ...]}
posortowane od najlepszego dopasowania. Maksymalnie 12 id. Jeśli nic nie pasuje — pusta lista.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query, items } = (await req.json().catch(() => ({}))) as {
    query?: string;
    items?: Array<{ id: string; name: string; category?: string | null }>;
  };
  if (!query?.trim() || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ids: [] });
  }

  // Ograniczamy liczbę pozycji w prompt, by nie przekroczyć kontekstu.
  const catalog = items.slice(0, 400).map((i) => `${i.id} | ${i.name} | ${i.category ?? ""}`).join("\n");

  const result = await chatComplete({
    op: "dispatch",
    userId: session.user?.id, // Z-130: licz do budżetu zapytań
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Pytanie: ${query.trim()}\n\nPozycje:\n${catalog}` },
    ],
    temperature: 0.1,
    maxTokens: 400,
    json: true,
  });

  if (!result.ok) return NextResponse.json({ ids: [], unavailable: true }, { status: 200 });

  try {
    const parsed = JSON.parse(stripJsonFence(result.content)) as { ids?: unknown[] };
    const valid = new Set(items.map((i) => i.id));
    const ids = Array.isArray(parsed.ids)
      ? parsed.ids.map((x) => String(x)).filter((id) => valid.has(id)).slice(0, 12)
      : [];
    return NextResponse.json({ ids });
  } catch {
    return NextResponse.json({ ids: [], unavailable: true }, { status: 200 });
  }
}
