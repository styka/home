async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const llm = {
  notes: {
    suggestTags: (content: string, existingTags: string[], existingGroups?: string[]) =>
      post<{ suggested?: string[]; new?: string[]; suggestedGroup?: string | null }>(
        "/api/llm/notes/tags",
        { content, existingTags, existingGroups }
      ),

    suggestTitle: (content: string) =>
      post<{ title?: string }>("/api/llm/notes/title", { content }),

    rewrite: (text: string, mode: string, instruction?: string) =>
      post<{ result?: string }>("/api/llm/notes/rewrite", { text, mode, instruction }),

    qa: (question: string, notes: { title: string; content: string }[]) =>
      post<{ answer?: string }>("/api/llm/notes/qa", { question, notes }),
  },

  tasks: {
    parse: (text: string) =>
      post<{ tasks?: Array<{ title: string; priority?: string; dueDate?: string }> }>(
        "/api/llm/tasks/parse",
        { text }
      ),

    suggest: (context: unknown) =>
      post<{ suggestions?: string[] }>("/api/llm/tasks/suggest", context),

    suggestTitle: (content: string) =>
      post<{ title?: string }>("/api/llm/tasks/title", { content }),

    search: (query: string, tasks: unknown[]) =>
      post<{ matches?: number[] }>("/api/llm/tasks/search", { query, tasks }),
  },

  shopping: {
    normalize: (text: string) =>
      post<{ items?: Array<{ name: string; quantity?: number; unit?: string }> }>(
        "/api/llm/normalize",
        { text }
      ),
  },

  stores: {
    generate: (storeName: string) =>
      post<{
        nodes: Array<{ id: string; type: string; category: string | null; label: string }>;
        edges: Array<{ fromId: string; toId: string; weight: number }>;
        confidence: "high" | "medium" | "low";
        note: string;
      }>("/api/llm/stores/generate", { storeName }),
  },

  kitchen: {
    parseIngredients: (text: string) =>
      post<{
        ingredients?: Array<{
          name: string;
          quantity: number | null;
          unit: string | null;
          note: string | null;
          isOptional: boolean;
        }>;
        error?: string;
      }>("/api/llm/kitchen/parse-ingredients", { text }),

    importFromUrl: (url: string) =>
      post<{
        recipe?: {
          title: string;
          description: string | null;
          servings: number | null;
          prepMinutes: number | null;
          cookMinutes: number | null;
          cuisine: string | null;
          mealType: string | null;
          coverImageUrl: string | null;
          notes: string | null;
          ingredients: Array<{
            name: string;
            quantity: number | null;
            unit: string | null;
            note: string | null;
            isOptional: boolean;
          }>;
          steps: Array<{ text: string }>;
        };
        sourceUrl?: string;
        error?: string;
      }>("/api/llm/kitchen/import-url", { url }),

    suggestFromPantry: () =>
      post<{
        suggestions?: Array<{
          recipeId: string;
          slug: string;
          title: string;
          reason: string;
          matchedIngredients: string[];
        }>;
      }>("/api/llm/kitchen/suggest-from-pantry", {}),

    categorize: (input: {
      title: string;
      description?: string | null;
      ingredients?: Array<{ name: string }>;
      steps?: Array<{ text: string }>;
    }) =>
      post<{
        cuisine?: string | null;
        mealType?: "breakfast" | "lunch" | "dinner" | "snack" | "dessert" | null;
        difficulty?: "easy" | "medium" | "hard";
        tags?: string[];
        error?: string;
      }>("/api/llm/kitchen/categorize", input),

    ocrImage: (image: string) =>
      post<{
        recipe?: {
          title: string;
          description: string | null;
          servings: number | null;
          prepMinutes: number | null;
          cookMinutes: number | null;
          cuisine: string | null;
          mealType: string | null;
          ingredients: Array<{
            name: string;
            quantity: number | null;
            unit: string | null;
            note: string | null;
            isOptional: boolean;
          }>;
          steps: Array<{ text: string }>;
        };
        error?: string;
      }>("/api/llm/kitchen/ocr-image", { image }),

    ocrText: (image: string) =>
      post<{ hasText?: boolean; markdown?: string; error?: string }>(
        "/api/llm/kitchen/ocr-text",
        { image }
      ),

    generateRecipe: (prompt: string) =>
      post<{
        recipe?: {
          title: string;
          description: string | null;
          servings: number | null;
          prepMinutes: number | null;
          cookMinutes: number | null;
          cuisine: string | null;
          mealType: string | null;
          ingredients: Array<{
            name: string;
            quantity: number | null;
            unit: string | null;
            note: string | null;
            isOptional: boolean;
          }>;
          steps: Array<{ text: string }>;
        };
        error?: string;
      }>("/api/llm/kitchen/generate-recipe", { prompt }),

    planWeek: (input: {
      weekStart: string;
      slots: Array<"breakfast" | "lunch" | "dinner" | "snack">;
      people: number;
      avoid?: string[];
      cuisines?: string[];
      maxMinutes?: number | null;
      mustUsePantry?: boolean;
      noRepeats?: boolean;
    }) =>
      post<{
        suggestions?: Array<{
          date: string;
          slot: "breakfast" | "lunch" | "dinner" | "snack";
          recipeId: string;
          slug: string;
          title: string;
          servings: number;
          reason: string;
        }>;
        error?: string;
      }>("/api/llm/kitchen/plan-week", input),
  },

  languages: {
    extract: (input: { sourceText: string; nativeLang: string; targetLang: string; max?: number }) =>
      post<{
        words?: Array<{
          term: string;
          translation: string;
          example: string | null;
          partOfSpeech: string | null;
        }>;
        error?: string;
      }>("/api/llm/languages/extract", input),
  },

  magazynowanie: {
    scan: (image: string) =>
      post<{
        items?: Array<{
          name: string;
          quantity: number | null;
          unit: string | null;
          category: string | null;
          notes: string | null;
        }>;
        error?: string;
      }>("/api/llm/magazynowanie/scan", { image }),
    enrich: (input: { barcode?: string; name?: string }) =>
      post<{ name?: string; category?: string | null; unit?: string | null; unavailable?: boolean }>(
        "/api/llm/magazynowanie/enrich",
        input
      ),
    document: (image: string) =>
      post<{
        number?: string | null;
        supplier?: string | null;
        lines?: Array<{ name: string; quantity: number; unit: string | null; unitPrice: number | null }>;
        error?: string;
      }>("/api/llm/magazynowanie/document", { image }),
    orderDraft: (input: { supplier?: string; lines: Array<{ name: string; quantity: number; unit?: string | null }> }) =>
      post<{ text?: string; unavailable?: boolean; error?: string }>("/api/llm/magazynowanie/order-draft", input),
    insights: (input: {
      currency?: string;
      totalValue?: number;
      itemCount?: number;
      lowStockCount?: number;
      deadStockCount?: number;
      topValue?: Array<{ name: string; value: number }>;
      deadStock?: Array<{ name: string; value: number }>;
    }) => post<{ tips?: string[]; unavailable?: boolean }>("/api/llm/magazynowanie/insights", input),
    search: (input: { query: string; items: Array<{ id: string; name: string; category?: string | null }> }) =>
      post<{ ids?: string[]; unavailable?: boolean }>("/api/llm/magazynowanie/search", input),
  },

  pets: {
    insights: (input: {
      pets: Array<{ name: string; species: string; presetKey?: string }>;
      agenda?: Array<{ petName: string; title: string; bucket: string; dueAt: string }>;
      ruleSuggestions?: Array<{ title: string; detail?: string }>;
    }) =>
      post<{ tips?: string[]; unavailable?: boolean }>("/api/llm/pets/insights", input),
  },
};
