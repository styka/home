// Z-131 (T-17) — handler: plan posiłków na tydzień. Z `/api/llm/kitchen/plan-week`.
// Czyta bibliotekę przepisów + spiżarnię po `ownerId` (nie po sesji — worker) i prosi
// LLM o dobór przepisów do par (dzień, slot). Rzuca JobError przy błędach.
import { prisma } from "@/lib/prisma";
import { chatComplete } from "@/lib/llm/chat";
import { getUserTeamIds } from "@/lib/server-utils";
import { addDays, format } from "date-fns";
import { JobError, type JobContext } from "@/lib/jobs/types";

const VALID_SLOTS = new Set(["breakfast", "lunch", "dinner", "snack"]);
type Slot = "breakfast" | "lunch" | "dinner" | "snack";

interface PlanWeekPayload {
  weekStart?: string;
  slots?: string[];
  people?: number;
  avoid?: string[];
  cuisines?: string[];
  maxMinutes?: number | null;
  mustUsePantry?: boolean;
  noRepeats?: boolean;
}
interface Suggestion {
  date: string; slot: Slot; recipeId: string; slug: string; title: string; servings: number; reason: string;
}

const SYSTEM_PROMPT = `Jesteś planistą posiłków. Otrzymasz listę przepisów użytkownika i jego preferencje.
Twoim zadaniem jest wybranie po jednym przepisie dla każdej pary (dzień, slot) z listy "targets".
Zwróć WYŁĄCZNIE JSON: {"picks":[{"date":"YYYY-MM-DD","slot":"breakfast"|"lunch"|"dinner"|"snack","recipeId":"<id>","reason":"<max 70 znaków po polsku>"}]}
Zasady: wybieraj TYLKO recipeId z "recipes"; honoruj preferencje (avoid, cuisines, maxMinutes, mustUsePantry, noRepeats);
noRepeats=true → bez powtórek w tygodniu; mustUsePantry=true → priorytet przepisów z większym "matchedPantry";
slot pasujący do mealType ma pierwszeństwo; jeśli nic nie pasuje — pomiń parę (nie wymyślaj id).`;

export async function kitchenPlanWeekHandler(payload: PlanWeekPayload, ctx: JobContext): Promise<{ suggestions: Suggestion[] }> {
  const ownerId = ctx.ownerId;
  if (!ownerId) throw new JobError("Brak użytkownika", 401);
  if (!payload.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(payload.weekStart)) throw new JobError("weekStart YYYY-MM-DD wymagany", 400);
  const slots = (payload.slots ?? ["lunch", "dinner"]).filter((s) => VALID_SLOTS.has(s)) as Slot[];
  if (slots.length === 0) throw new JobError("Wybierz co najmniej jeden slot", 400);
  const people = Math.max(1, Math.min(12, Math.floor(payload.people ?? 2)));

  const teamIds = await getUserTeamIds(ownerId);
  const ownerOr = [{ ownerId }, ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : [])];

  const recipes = await prisma.recipe.findMany({
    where: { isArchived: false, OR: ownerOr },
    select: {
      id: true, slug: true, title: true, servings: true, prepMinutes: true, cookMinutes: true,
      cuisine: true, mealType: true,
      ingredients: { select: { name: true, product: { select: { name: true } } } },
    },
    take: 100,
    orderBy: { lastCookedAt: { sort: "desc", nulls: "last" } },
  });
  if (recipes.length === 0) throw new JobError("Brak przepisów w bibliotece — dodaj kilka i spróbuj ponownie", 422);

  const pantry = payload.mustUsePantry
    ? await prisma.pantryItem.findMany({
        where: { OR: ownerOr, quantity: { gt: 0 } },
        select: { name: true, productId: true, product: { select: { name: true } } },
      })
    : [];
  const pantryNames = pantry.map((p) => (p.product?.name ?? p.name).toLowerCase());

  const weekStart = new Date(`${payload.weekStart}T12:00:00`);
  const targets: Array<{ date: string; slot: Slot }> = [];
  for (let i = 0; i < 7; i += 1) {
    const d = format(addDays(weekStart, i), "yyyy-MM-dd");
    for (const slot of slots) targets.push({ date: d, slot });
  }

  const compactRecipes = recipes.map((r) => {
    const ingNames = r.ingredients.map((i) => (i.product?.name ?? i.name).toLowerCase());
    const matchedPantry = pantryNames.filter((p) => ingNames.some((n) => n.includes(p) || p.includes(n)));
    return {
      id: r.id, title: r.title, cuisine: r.cuisine, mealType: r.mealType,
      minutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0),
      ingredientCount: r.ingredients.length, matchedPantry: matchedPantry.length,
    };
  });

  const userPrompt = JSON.stringify({
    targets, recipes: compactRecipes,
    preferences: {
      people,
      avoid: (payload.avoid ?? []).filter(Boolean).slice(0, 10),
      cuisines: (payload.cuisines ?? []).filter(Boolean).slice(0, 6),
      maxMinutes: payload.maxMinutes ?? null,
      mustUsePantry: Boolean(payload.mustUsePantry),
      noRepeats: payload.noRepeats !== false,
    },
  });

  const result = await chatComplete({
    op: "reasoning",
    userId: ownerId,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt.slice(0, 12000) }],
    temperature: 0.3, maxTokens: 2000, json: true,
  });
  if (!result.ok) throw new JobError(result.message, result.status);

  let picks: Array<{ date: string; slot: string; recipeId: string; reason?: string }> = [];
  try {
    const cleaned = (result.content || "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    picks = Array.isArray(parsed.picks) ? parsed.picks : [];
  } catch {
    throw new JobError("LLM zwrócił nieprawidłowy format", 502);
  }

  const recipeMap = new Map(recipes.map((r) => [r.id, r] as const));
  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const p of picks) {
    if (!p || typeof p.date !== "string" || typeof p.slot !== "string" || typeof p.recipeId !== "string") continue;
    if (!VALID_SLOTS.has(p.slot)) continue;
    const r = recipeMap.get(p.recipeId);
    if (!r) continue;
    const key = `${p.date}::${p.slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      date: p.date, slot: p.slot as Slot, recipeId: r.id, slug: r.slug, title: r.title,
      servings: people, reason: (p.reason ?? "").slice(0, 100),
    });
  }
  return { suggestions };
}
