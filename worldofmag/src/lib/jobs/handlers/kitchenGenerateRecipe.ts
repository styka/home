// Z-131 (T-17) — handler: wygeneruj przepis z opisu. Z `/api/llm/kitchen/generate-recipe`.
import { chatComplete } from "@/lib/llm/chat";
import { JobError, type JobContext } from "@/lib/jobs/types";

const SYSTEM_PROMPT = `Jesteś szefem kuchni. Otrzymasz krótki opis dania po polsku (np. "spaghetti carbonara dla 2 osób", "szybki obiad z kurczakiem w 30 minut", "wegański deser bez piekarnika").
Wygeneruj kompletny, realistyczny przepis. Zwróć WYŁĄCZNIE JSON (bez markdown, bez komentarza) w schemacie:
{
  "title": string, "description": string|null, "servings": number,
  "prepMinutes": number|null, "cookMinutes": number|null, "cuisine": string|null,
  "mealType": "breakfast"|"lunch"|"dinner"|"snack"|"dessert"|null,
  "ingredients": [{"name":string,"quantity":number|null,"unit":string|null,"note":string|null,"isOptional":boolean}],
  "steps": [{"text":string}]
}
Zasady:
- Tytuł krótki, opisowy, po polsku. Składniki realistyczne, małe litery w "name". Kroki krótkie, max 10, po polsku.
- "cuisine"/"mealType"/"servings" dopasuj do promptu; jeśli podano liczbę osób — użyj jej, inaczej 2.
- Jeśli prompt nie wygląda jak opis dania — zwróć {"error":"not-a-recipe"}.`;

export interface GenerateRecipePayload { prompt?: string }

export async function kitchenGenerateRecipeHandler(payload: GenerateRecipePayload, ctx: JobContext) {
  const trimmed = payload?.prompt?.trim();
  if (!trimmed) throw new JobError("Podaj opis dania", 400);
  if (trimmed.length > 500) throw new JobError("Opis za długi (max 500 znaków)", 400);

  const result = await chatComplete({
    op: "generation",
    userId: ctx.ownerId ?? undefined,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: trimmed }],
    temperature: 0.4, maxTokens: 2500, json: true,
  });
  if (!result.ok) throw new JobError(result.message, result.status);

  try {
    const cleaned = (result.content || "{}").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const parsed = JSON.parse(cleaned);
    if (parsed.error) throw new JobError("Z opisu nie wynika przepis — doprecyzuj prompt", 422);
    return { recipe: {
      title: String(parsed.title ?? "Bez nazwy"), description: parsed.description ?? null,
      servings: parsed.servings ?? null, prepMinutes: parsed.prepMinutes ?? null, cookMinutes: parsed.cookMinutes ?? null,
      cuisine: parsed.cuisine ?? null, mealType: parsed.mealType ?? null,
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    } };
  } catch (e) {
    if (e instanceof JobError) throw e;
    throw new JobError("LLM zwrócił nieprawidłowy format", 502);
  }
}
