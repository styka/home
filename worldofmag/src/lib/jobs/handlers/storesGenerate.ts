// Z-131 (T-17) — handler: wygeneruj mapę (graf) sklepu. Z `/api/llm/stores/generate`.
import { chatComplete } from "@/lib/llm/chat";
import { JobError, type JobContext } from "@/lib/jobs/types";

const CATEGORIES = [
  "Warzywa i owoce", "Nabiał i jaja", "Mięso i ryby", "Piekarnia",
  "Suche produkty", "Napoje", "Mrożone", "Przekąski i słodycze",
  "Przyprawy i oleje", "Zioła i przyprawy", "Chemia i higiena",
  "Konserwy i przetwory", "Inne",
];
const SYSTEM_PROMPT = `Jesteś ekspertem od layoutów polskich supermarketów.
Generujesz graf reprezentujący układ kategorii produktów w sklepie.
Dozwolone kategorie: ${CATEGORIES.join(", ")}
Węzły: START (id "start", type START, label "Wejście"), STOP (id "stop", type STOP, label "Kasy"),
oraz węzły kategorii (type CATEGORY, category z dozwolonych). Krawędzie: { fromId, toId, weight }
gdzie weight = odległość (1-10, mniejsza = bliżej).
Zwróć TYLKO JSON:
{ "nodes": [ { "id": "start", "type": "START", "category": null, "label": "Wejście" }, ... ,
  { "id": "stop", "type": "STOP", "category": null, "label": "Kasy" } ],
  "edges": [ { "fromId": "start", "toId": "cat_x", "weight": 1 }, ... ],
  "confidence": "high"|"medium"|"low", "note": "..." }
Zasady: zawsze START i STOP; tylko kategorie obecne w tym sklepie; wagi 1-10; bez dodatkowego tekstu.`;

export interface StoreGeneratePayload { storeName?: string }

export async function storesGenerateHandler(payload: StoreGeneratePayload, ctx: JobContext) {
  const storeName = payload?.storeName?.trim();
  if (!storeName) throw new JobError("Empty store name", 400);

  const result = await chatComplete({
    op: "reasoning",
    userId: ctx.ownerId ?? undefined,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Wygeneruj mapę sklepu: "${storeName}"` },
    ],
    temperature: 0.2, maxTokens: 2048,
  });
  if (!result.ok) throw new JobError(result.message, result.status);

  try {
    const cleaned = (result.content || "{}").trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    if (!parsed.nodes || !parsed.edges) throw new Error("missing fields");
    return parsed;
  } catch {
    throw new JobError("LLM zwrócił nieprawidłowy format", 502);
  }
}
