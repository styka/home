// Z-131 (T-17) — handler: wnioski z analityki magazynu. Z `/api/llm/magazynowanie/insights`. Łagodna degradacja.
import { chatComplete } from "@/lib/llm/chat";
import { type JobContext } from "@/lib/jobs/types";

interface InsightsPayload {
  currency?: string; totalValue?: number; itemCount?: number;
  lowStockCount?: number; deadStockCount?: number;
  topValue?: Array<{ name: string; value: number }>;
  deadStock?: Array<{ name: string; value: number }>;
}
const SYSTEM_PROMPT = `Jesteś analitykiem gospodarki magazynowej. Na podstawie statystyk magazynu
formułujesz krótkie, konkretne wnioski i rekomendacje po polsku.
Zasady: zwróć TYLKO JSON {"tips": ["...", "..."]}; maks. 4 punkty, każdy 1 zdanie do 150 znaków,
konkretny i wykonalny; bez markdown.`;

export async function magazynInsightsHandler(payload: InsightsPayload, ctx: JobContext) {
  const b = payload ?? {};
  if (!b.itemCount) return { tips: [] };
  const cur = b.currency || "PLN";
  const userMsg = [
    `Wartość magazynu: ${Math.round(b.totalValue ?? 0)} ${cur}, pozycji: ${b.itemCount}.`,
    `Poniżej stanu minimalnego: ${b.lowStockCount ?? 0}. Martwy zapas: ${b.deadStockCount ?? 0} pozycji.`,
    b.topValue?.length ? `Najwyższa wartość: ${b.topValue.map((t) => `${t.name} (${Math.round(t.value)} ${cur})`).join(", ")}.` : null,
    b.deadStock?.length ? `Zamrożony kapitał: ${b.deadStock.map((t) => `${t.name} (${Math.round(t.value)} ${cur})`).join(", ")}.` : null,
  ].filter(Boolean).join("\n");

  const result = await chatComplete({
    op: "reasoning", userId: ctx.ownerId ?? undefined,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }],
    temperature: 0.4, maxTokens: 400,
  });
  if (!result.ok) return { tips: [], unavailable: true };
  try {
    const cleaned = (result.content || "{}").trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").replace(/^```\n?/, "");
    const parsed = JSON.parse(cleaned) as { tips?: string[] };
    return { tips: Array.isArray(parsed.tips) ? parsed.tips.filter((t) => typeof t === "string").slice(0, 4) : [] };
  } catch {
    return { tips: [], unavailable: true };
  }
}
