// Z-131 (T-17) — handler: porady dobrostanu zwierząt. Z `/api/llm/pets/insights`. Łagodna degradacja.
import { chatComplete } from "@/lib/llm/chat";
import { type JobContext } from "@/lib/jobs/types";
import { usageFromChat } from "@/lib/ai/usage";
import { rememberedContent, hashInputs } from "@/lib/ai/contentMemory";
import { resolveSectionMode } from "@/lib/ai/sectionModeResolver";

interface InsightsPayload {
  pets?: Array<{ name: string; species: string; presetKey?: string }>;
  agenda?: Array<{ petName: string; title: string; bucket: string; dueAt: string }>;
  ruleSuggestions?: Array<{ title: string; detail?: string }>;
  /** 038: użytkownik jawnie poprosił o nowe porady. Bez tego wracają zapamiętane. */
  force?: boolean;
}
const SYSTEM_PROMPT = `Jesteś doświadczonym doradcą ds. dobrostanu zwierząt domowych i egzotycznych.
Na podstawie listy zwierząt, gatunków i zadań opieki formułujesz krótkie, konkretne porady po polsku.
Zasady: zwróć TYLKO JSON {"tips": ["...", ...]}; maks. 4 porady, każda 1 zdanie do 140 znaków,
konkretna i wykonalna; priorytet zaległe/zdrowie; uwzględnij specyfikę gatunku; bez markdown.`;

export async function petsInsightsHandler(payload: InsightsPayload, ctx: JobContext) {
  const pets = payload?.pets ?? [];
  if (pets.length === 0) return { tips: [] };
  if (!ctx.ownerId) return runPetsInsights(payload, ctx);

  // 041: sekcja startuje przy wejściu na stronę, więc to tryb decyduje, czy wolno zawołać model.
  const mode = await resolveSectionMode(ctx.ownerId, "pets.insights");

  const remembered = await rememberedContent<{ tips: string[]; unavailable?: boolean }>({
    ownerId: ctx.ownerId,
    kind: "pets.insights",
    scopeKey: "default",
    inputHash: hashInputs(
      pets.map((p) => `${p.name}|${p.species}`).sort().join(","),
      (payload.agenda ?? []).map((a) => `${a.petName}|${a.title}|${a.bucket}`).sort().join(",")
    ),
    force: payload.force,
    mode,
    generate: async () => {
      const r = await runPetsInsights(payload, ctx);
      return { value: { tips: r.tips, unavailable: r.unavailable }, usage: r.usage };
    },
  });

  // Brak porad + `pending` to co innego niż „model nic nie wymyślił" — klient ma dla tego własny stan.
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

async function runPetsInsights(payload: InsightsPayload, ctx: JobContext) {
  const pets = payload?.pets ?? [];

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
    return {
      tips: Array.isArray(parsed.tips) ? parsed.tips.filter((t) => typeof t === "string").slice(0, 4) : [],
      usage: usageFromChat([{ res: result, label: "wnioski o zwierzętach" }]),
    };
  } catch {
    return { tips: [], unavailable: true };
  }
}
