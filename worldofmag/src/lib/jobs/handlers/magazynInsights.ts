// Z-131 (T-17) — handler: wnioski z analityki magazynu. Z `/api/llm/magazynowanie/insights`. Łagodna degradacja.
import { chatComplete } from "@/platform/llm/chat";
import { type JobContext } from "@/lib/jobs/types";
import { usageFromChat } from "@/platform/ai/usage";
import { rememberedContent, hashInputs } from "@/platform/ai/contentMemory";
import { resolveSectionMode } from "@/platform/ai/sectionModeResolver";

interface InsightsPayload {
  currency?: string; totalValue?: number; itemCount?: number;
  lowStockCount?: number; deadStockCount?: number;
  /** 038: użytkownik jawnie poprosił o nowe wnioski. Bez tego wracają zapamiętane. */
  force?: boolean;
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
  // Zadanie w tle nie ma sesji, ale ma właściciela — to wystarczy, żeby pamiętać jego treść.
  if (!ctx.ownerId) return runMagazynInsights(b, ctx);

  // 041: ta sekcja rusza dopiero po kliknięciu, więc tryb rozstrzyga tu tylko jedno — czy klik ma
  // korzystać z pamięci, czy liczyć od nowa. Klient, dostawszy `pending`, ponawia z `force` w tym
  // samym geście: kliknięcie JEST jawną prośbą, a tryb pilnuje wyłącznie generowania samoczynnego.
  const mode = await resolveSectionMode(ctx.ownerId, "storage.insights");

  const remembered = await rememberedContent<{ tips: string[]; unavailable?: boolean }>({
    ownerId: ctx.ownerId,
    kind: "storage.insights",
    scopeKey: "default",
    inputHash: hashInputs(
      b.itemCount,
      b.lowStockCount,
      b.deadStockCount,
      // Wartość magazynu zaokrąglona do setek — drobny ruch stanu nie unieważnia wniosków.
      Math.round((b.totalValue ?? 0) / 100)
    ),
    force: b.force,
    mode,
    generate: async () => {
      const r = await runMagazynInsights(b, ctx);
      return { value: { tips: r.tips, unavailable: r.unavailable }, usage: r.usage };
    },
  });

  if (remembered.pending) return { tips: [], pending: true, mode };

  return {
    ...remembered.value,
    usage: remembered.usage,
    generatedAt: remembered.generatedAt,
    stale: remembered.stale,
    pending: false,
    mode,
  };
}

async function runMagazynInsights(b: InsightsPayload, ctx: JobContext) {
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
    return {
      tips: Array.isArray(parsed.tips) ? parsed.tips.filter((t) => typeof t === "string").slice(0, 4) : [],
      usage: usageFromChat([{ res: result, label: "analityka magazynu" }]),
    };
  } catch {
    return { tips: [], unavailable: true };
  }
}
