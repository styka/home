import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";

// Narracyjny wgląd w analitykę magazynu: z policzonych po stronie serwera
// statystyk (wartość, ABC, martwy zapas, braki) LLM formułuje krótkie wnioski
// i rekomendacje. Liczby liczy aplikacja — LLM tylko interpretuje.

interface InsightsBody {
  currency?: string;
  totalValue?: number;
  itemCount?: number;
  lowStockCount?: number;
  deadStockCount?: number;
  topValue?: Array<{ name: string; value: number }>;
  deadStock?: Array<{ name: string; value: number }>;
}

const SYSTEM_PROMPT = `Jesteś analitykiem gospodarki magazynowej. Na podstawie statystyk magazynu
formułujesz krótkie, konkretne wnioski i rekomendacje po polsku.
Zasady: zwróć TYLKO JSON {"tips": ["...", "..."]}; maksymalnie 4 punkty, każdy 1 zdanie do 150 znaków,
konkretny i wykonalny (np. co zamówić, co upłynnić, gdzie zamrożony kapitał). Bez markdown.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as InsightsBody;
  if (!b.itemCount) return NextResponse.json({ tips: [] });

  const cur = b.currency || "PLN";
  const userMsg = [
    `Wartość magazynu: ${Math.round(b.totalValue ?? 0)} ${cur}, pozycji: ${b.itemCount}.`,
    `Poniżej stanu minimalnego: ${b.lowStockCount ?? 0}. Martwy zapas (bez ruchu): ${b.deadStockCount ?? 0} pozycji.`,
    b.topValue?.length ? `Najwyższa wartość: ${b.topValue.map((t) => `${t.name} (${Math.round(t.value)} ${cur})`).join(", ")}.` : null,
    b.deadStock?.length ? `Zamrożony kapitał (martwe): ${b.deadStock.map((t) => `${t.name} (${Math.round(t.value)} ${cur})`).join(", ")}.` : null,
  ].filter(Boolean).join("\n");

  const result = await chatComplete({
    op: "reasoning",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.4,
    maxTokens: 400,
  });

  if (!result.ok) return NextResponse.json({ tips: [], unavailable: true }, { status: 200 });

  try {
    const cleaned = (result.content || "{}").trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").replace(/^```\n?/, "");
    const parsed = JSON.parse(cleaned) as { tips?: string[] };
    const tips = Array.isArray(parsed.tips) ? parsed.tips.filter((t) => typeof t === "string").slice(0, 4) : [];
    return NextResponse.json({ tips });
  } catch {
    return NextResponse.json({ tips: [], unavailable: true }, { status: 200 });
  }
}
