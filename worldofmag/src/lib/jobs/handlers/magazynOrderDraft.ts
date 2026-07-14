// Z-131 (T-17) — handler: redaguj treść zamówienia do dostawcy. Z `/api/llm/magazynowanie/order-draft`.
// Degradacja łagodna: przy niedostępnym LLM zwraca {unavailable:true} (NIE rzuca).
import { chatComplete } from "@/lib/llm/chat";
import { JobError, type JobContext } from "@/lib/jobs/types";

const SYSTEM_PROMPT = `Jesteś asystentem zaopatrzenia. Napisz po polsku krótką, uprzejmą i rzeczową
treść e-maila z zamówieniem do dostawcy. Zacznij od zwrotu grzecznościowego, podaj listę pozycji
z ilościami w punktach, poproś o potwierdzenie dostępności i terminu oraz podsumowanie kosztów.
Zakończ podpisem ogólnym. Bez markdown, zwykły tekst.`;

export interface OrderDraftPayload {
  supplier?: string;
  lines?: Array<{ name: string; quantity: number; unit?: string | null }>;
}

export async function magazynOrderDraftHandler(payload: OrderDraftPayload, ctx: JobContext) {
  const items = (payload?.lines ?? []).filter((l) => l?.name);
  if (items.length === 0) throw new JobError("Brak pozycji", 400);

  const userMsg = [
    payload.supplier ? `Dostawca: ${payload.supplier}` : "Dostawca: (nieokreślony)",
    "Pozycje do zamówienia:",
    ...items.map((l) => `- ${l.name}: ${l.quantity}${l.unit ? " " + l.unit : ""}`),
  ].join("\n");

  const result = await chatComplete({
    op: "generation",
    userId: ctx.ownerId ?? undefined,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }],
    temperature: 0.5, maxTokens: 600,
  });
  if (!result.ok) return { unavailable: true };
  return { text: result.content.trim() };
}
