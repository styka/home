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

  home: {
    interpret: (command: string, context: unknown) =>
      post<{ intent?: string; params?: unknown }>("/api/llm/home/interpret", { command, context }),

    execute: (intent: string, params: unknown) =>
      post<{ result?: string }>("/api/llm/home/execute", { intent, params }),
  },
};
