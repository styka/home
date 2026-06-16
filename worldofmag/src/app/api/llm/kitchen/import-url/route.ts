import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";

interface ParsedRecipe {
  title: string;
  description?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  cuisine?: string | null;
  mealType?: string | null;
  coverImageUrl?: string | null;
  notes?: string | null;
  ingredients: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    note: string | null;
    isOptional: boolean;
  }>;
  steps: Array<{ text: string }>;
}

function parseIsoDuration(d: string): number | null {
  if (!d) return null;
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(d);
  if (!m) return null;
  return (Number(m[1] ?? 0)) * 60 + Number(m[2] ?? 0);
}

function parseIngredientString(raw: string): {
  name: string;
  quantity: number | null;
  unit: string | null;
} {
  const trimmed = raw.trim();
  const m = /^([\d,./\s]+)?\s*([a-zA-Ząęóćłńżźś]{1,8})?\s+(.+)$/i.exec(trimmed);
  if (!m) return { name: trimmed, quantity: null, unit: null };
  const qtyStr = m[1]?.replace(",", ".").replace(/\//g, " ").trim();
  let qty: number | null = null;
  if (qtyStr) {
    const parts = qtyStr.split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
    if (parts.length === 1) qty = parts[0];
    else if (parts.length === 2) qty = parts[0] + parts[1] / 10;
  }
  const unit = m[2] && /^(g|kg|dkg|ml|l|szt|op|łyżka|łyżeczka|szklanka|szklanki)$/i.test(m[2]) ? m[2] : null;
  const name = (m[3] ?? trimmed).replace(/^[-,:]\s*/, "").trim();
  return { name, quantity: qty, unit };
}

function pickFirst<T>(...values: T[]): T | undefined {
  for (const v of values) if (v != null) return v;
  return undefined;
}

function extractFromJsonLd(html: string): ParsedRecipe | null {
  const matches = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );
  for (const m of matches) {
    try {
      const json = JSON.parse(m[1]);
      const list: unknown[] = Array.isArray(json) ? json : json["@graph"] ?? [json];
      for (const node of list) {
        if (!node || typeof node !== "object") continue;
        const n = node as Record<string, unknown>;
        const t = n["@type"];
        const isRecipe =
          t === "Recipe" || (Array.isArray(t) && (t as string[]).includes("Recipe"));
        if (!isRecipe) continue;

        const ingredientsRaw = (n.recipeIngredient as unknown) ?? [];
        const ingredients = Array.isArray(ingredientsRaw)
          ? (ingredientsRaw as unknown[]).map((s) => {
              const parsed = parseIngredientString(String(s));
              return { ...parsed, note: null, isOptional: false };
            })
          : [];

        const instructionsRaw = (n.recipeInstructions as unknown) ?? [];
        const steps: Array<{ text: string }> = [];
        if (Array.isArray(instructionsRaw)) {
          for (const s of instructionsRaw as unknown[]) {
            if (typeof s === "string") steps.push({ text: s });
            else if (s && typeof s === "object") {
              const obj = s as Record<string, unknown>;
              if (obj["@type"] === "HowToStep" && typeof obj.text === "string") {
                steps.push({ text: obj.text });
              } else if (obj["@type"] === "HowToSection" && Array.isArray(obj.itemListElement)) {
                for (const inner of obj.itemListElement as unknown[]) {
                  if (inner && typeof inner === "object" && typeof (inner as Record<string, unknown>).text === "string") {
                    steps.push({ text: String((inner as Record<string, unknown>).text) });
                  }
                }
              } else if (typeof obj.text === "string") {
                steps.push({ text: obj.text });
              }
            }
          }
        } else if (typeof instructionsRaw === "string") {
          steps.push({ text: instructionsRaw });
        }

        const imageRaw = n.image as unknown;
        let coverImageUrl: string | null = null;
        if (typeof imageRaw === "string") coverImageUrl = imageRaw;
        else if (Array.isArray(imageRaw) && typeof imageRaw[0] === "string") coverImageUrl = imageRaw[0] as string;
        else if (imageRaw && typeof imageRaw === "object") {
          const url = (imageRaw as Record<string, unknown>).url;
          if (typeof url === "string") coverImageUrl = url;
        }

        const yieldRaw = pickFirst(n.recipeYield, n.yield);
        let servings: number | null = null;
        if (typeof yieldRaw === "string") {
          const m = /(\d+)/.exec(yieldRaw);
          if (m) servings = Number(m[1]);
        } else if (typeof yieldRaw === "number") {
          servings = yieldRaw;
        }

        return {
          title: String(n.name ?? "Bez nazwy"),
          description: typeof n.description === "string" ? n.description : null,
          servings,
          prepMinutes: typeof n.prepTime === "string" ? parseIsoDuration(n.prepTime) : null,
          cookMinutes: typeof n.cookTime === "string" ? parseIsoDuration(n.cookTime) : null,
          cuisine: typeof n.recipeCuisine === "string" ? n.recipeCuisine : null,
          mealType: typeof n.recipeCategory === "string" ? n.recipeCategory.toLowerCase() : null,
          coverImageUrl,
          notes: null,
          ingredients,
          steps,
        };
      }
    } catch {
      // continue scanning
    }
  }
  return null;
}

async function extractWithLLM(html: string, sourceUrl: string): Promise<ParsedRecipe | null> {
  // Strip tags to keep token budget lean
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);

  const SYSTEM = `Jesteś parserem przepisów kulinarnych. Otrzymasz tekst strony WWW. Wyciągnij przepis i zwróć WYŁĄCZNIE JSON w schemacie:
{
  "title": string,
  "description": string|null,
  "servings": number|null,
  "prepMinutes": number|null,
  "cookMinutes": number|null,
  "cuisine": string|null,
  "mealType": "breakfast"|"lunch"|"dinner"|"snack"|"dessert"|null,
  "ingredients": [{"name":string,"quantity":number|null,"unit":string|null,"note":string|null,"isOptional":boolean}],
  "steps": [{"text":string}]
}
Nazwy składników i kroki po polsku. Jeśli tekst nie wygląda jak przepis, zwróć {"error":"not-a-recipe"}.`;

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `URL: ${sourceUrl}\n\nText:\n${text}` },
    ],
    temperature: 0.1,
    cache: true, // Z-511: import tego samego URL daje ten sam wynik — cache oszczędza powtórny parsing
    maxTokens: 3000,
  });

  if (!result.ok) return null;
  const content: string = result.content || "{}";
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    if (parsed.error) return null;
    return {
      title: String(parsed.title ?? "Bez nazwy"),
      description: parsed.description ?? null,
      servings: parsed.servings ?? null,
      prepMinutes: parsed.prepMinutes ?? null,
      cookMinutes: parsed.cookMinutes ?? null,
      cuisine: parsed.cuisine ?? null,
      mealType: parsed.mealType ?? null,
      coverImageUrl: null,
      notes: null,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json().catch(() => ({ url: "" }));
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL wymagany" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad-proto");
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy URL" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (WorldOfMag Recipe Importer)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: `Nie udało się pobrać strony: ${e instanceof Error ? e.message : "błąd"}` },
      { status: 502 }
    );
  }

  let recipe = extractFromJsonLd(html);
  if (!recipe || recipe.ingredients.length === 0) {
    recipe = await extractWithLLM(html, parsed.toString());
  }
  if (!recipe) {
    return NextResponse.json(
      { error: "Nie udało się rozpoznać przepisu. Spróbuj inny URL lub wpisz ręcznie." },
      { status: 422 }
    );
  }

  return NextResponse.json({ recipe, sourceUrl: parsed.toString() });
}
