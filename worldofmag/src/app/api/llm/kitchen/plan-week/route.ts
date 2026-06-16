import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chatComplete } from "@/lib/llm/chat";
import { getUserTeamIds } from "@/lib/server-utils";
import { addDays, format } from "date-fns";

const VALID_SLOTS = new Set(["breakfast", "lunch", "dinner", "snack"]);

interface PlanInput {
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
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId: string;
  slug: string;
  title: string;
  servings: number;
  reason: string;
}

const SYSTEM_PROMPT = `Jesteś planistą posiłków. Otrzymasz listę przepisów użytkownika i jego preferencje.
Twoim zadaniem jest wybranie po jednym przepisie dla każdej pary (dzień, slot) z listy "targets".
Zwróć WYŁĄCZNIE JSON w schemacie:
{"picks":[{"date":"YYYY-MM-DD","slot":"breakfast"|"lunch"|"dinner"|"snack","recipeId":"<id>","reason":"<krótkie wyjaśnienie po polsku, max 70 znaków>"}]}

Zasady:
- Wybieraj WYŁĄCZNIE recipeId z listy "recipes".
- Honoruj preferencje (avoid, cuisines, maxMinutes, mustUsePantry, noRepeats).
- Gdy noRepeats=true — żaden przepis nie może się powtórzyć w tygodniu.
- Gdy mustUsePantry=true — priorytetyzuj przepisy z większą liczbą składników w "matchedPantry".
- Slot pasujący do mealType ma pierwszeństwo (śniadanie do breakfast itp.).
- Jeśli żaden przepis nie pasuje — pomiń tę parę (nie wymyślaj nowego id).
`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PlanInput;
  if (!body.weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekStart)) {
    return NextResponse.json({ error: "weekStart YYYY-MM-DD wymagany" }, { status: 400 });
  }
  const slots = (body.slots ?? ["lunch", "dinner"]).filter((s) => VALID_SLOTS.has(s)) as Array<
    "breakfast" | "lunch" | "dinner" | "snack"
  >;
  if (slots.length === 0) {
    return NextResponse.json({ error: "Wybierz co najmniej jeden slot" }, { status: 400 });
  }
  const people = Math.max(1, Math.min(12, Math.floor(body.people ?? 2)));

  const teamIds = await getUserTeamIds(session.user.id);
  const recipes = await prisma.recipe.findMany({
    where: {
      isArchived: false,
      OR: [
        { ownerId: session.user.id },
        ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      cuisine: true,
      mealType: true,
      ingredients: { select: { name: true, product: { select: { name: true } } } },
    },
    take: 100,
    orderBy: { lastCookedAt: { sort: "desc", nulls: "last" } },
  });

  if (recipes.length === 0) {
    return NextResponse.json({ error: "Brak przepisów w bibliotece — dodaj kilka i spróbuj ponownie" }, { status: 422 });
  }

  const pantry = body.mustUsePantry
    ? await prisma.pantryItem.findMany({
        where: {
          OR: [
            { ownerId: session.user.id },
            ...(teamIds.length > 0 ? [{ ownerTeamId: { in: teamIds } }] : []),
          ],
          quantity: { gt: 0 },
        },
        select: { name: true, productId: true, product: { select: { name: true } } },
      })
    : [];
  const pantryNames = pantry.map((p) => (p.product?.name ?? p.name).toLowerCase());

  const weekStart = new Date(`${body.weekStart}T12:00:00`);
  const targets: Array<{ date: string; slot: typeof slots[number] }> = [];
  for (let i = 0; i < 7; i += 1) {
    const d = format(addDays(weekStart, i), "yyyy-MM-dd");
    for (const slot of slots) targets.push({ date: d, slot });
  }

  const compactRecipes = recipes.map((r) => {
    const ingNames = r.ingredients.map((i) => (i.product?.name ?? i.name).toLowerCase());
    const matchedPantry = pantryNames.filter((p) => ingNames.some((n) => n.includes(p) || p.includes(n)));
    return {
      id: r.id,
      title: r.title,
      cuisine: r.cuisine,
      mealType: r.mealType,
      minutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0),
      ingredientCount: r.ingredients.length,
      matchedPantry: matchedPantry.length,
    };
  });

  const userPrompt = JSON.stringify({
    targets,
    recipes: compactRecipes,
    preferences: {
      people,
      avoid: (body.avoid ?? []).filter(Boolean).slice(0, 10),
      cuisines: (body.cuisines ?? []).filter(Boolean).slice(0, 6),
      maxMinutes: body.maxMinutes ?? null,
      mustUsePantry: Boolean(body.mustUsePantry),
      noRepeats: body.noRepeats !== false,
    },
  });

  const result = await chatComplete({
    op: "reasoning",
    userId: session.user?.id, // Z-130: budżet + zliczenie tokenów
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt.slice(0, 12000) },
    ],
    temperature: 0.3,
    maxTokens: 2000,
    json: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const content: string = result.content || "{}";

  let picks: Array<{ date: string; slot: string; recipeId: string; reason?: string }> = [];
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    picks = Array.isArray(parsed.picks) ? parsed.picks : [];
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
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
      date: p.date,
      slot: p.slot as Suggestion["slot"],
      recipeId: r.id,
      slug: r.slug,
      title: r.title,
      servings: people,
      reason: (p.reason ?? "").slice(0, 100),
    });
  }

  return NextResponse.json({ suggestions });
}
