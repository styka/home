// Z-131 (T-17) — handler: porady dobrostanu zwierząt. Z `/api/llm/pets/insights`. Łagodna degradacja.
import { chatComplete } from "@/lib/llm/chat";
import { type JobContext } from "@/lib/jobs/types";

interface InsightsPayload {
  pets?: Array<{ name: string; species: string; presetKey?: string }>;
  agenda?: Array<{ petName: string; title: string; bucket: string; dueAt: string }>;
  ruleSuggestions?: Array<{ title: string; detail?: string }>;
}
const SYSTEM_PROMPT = `Jesteś doświadczonym doradcą ds. dobrostanu zwierząt domowych i egzotycznych.
Na podstawie listy zwierząt, gatunków i zadań opieki formułujesz krótkie, konkretne porady po polsku.
Zasady: zwróć TYLKO JSON {"tips": ["...", ...]}; maks. 4 porady, każda 1 zdanie do 140 znaków,
konkretna i wykonalna; priorytet zaległe/zdrowie; uwzględnij specyfikę gatunku; bez markdown.`;

export async function petsInsightsHandler(payload: InsightsPayload, ctx: JobContext) {
  const pets = payload?.pets ?? [];
  if (pets.length === 0) return { tips: [] };

  const userMsg = [
    `Zwierzęta: ${pets.map((p) => `${p.name} (${p.species})`).join(", ")}`,
    payload.agenda?.length
      ? `Zadania opieki: ${payload.agenda.map((a) => `${a.petName}: ${a.title} [${a.bucket}]`).join("; ")}`
      : "Brak zaplanowanych zadań opieki.",
    payload.ruleSuggestions?.length ? `Sygnały: ${payload.ruleSuggestions.map((s) => s.title).join("; ")}` : null,
  ].filter(Boolean).join("\n");

  const result = await chatComplete({
    op: "reasoning", userId: ctx.ownerId ?? undefined,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userMsg }],
    temperature: 0.4, maxTokens: 512,
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
