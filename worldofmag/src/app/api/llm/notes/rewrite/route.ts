import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";

const PROMPTS: Record<string, string | ((instruction: string) => string)> = {
  correct: `Popraw błędy ortograficzne, gramatyczne i interpunkcyjne w tym tekście. Zachowaj oryginalny styl i strukturę. Odpowiedz TYLKO poprawionym tekstem bez żadnych wyjaśnień.`,
  rewrite: `Przeredaguj ten tekst: popraw styl, czytelność i spójność. Zachowaj wszystkie kluczowe informacje. Odpowiedz TYLKO przeredagowanym tekstem bez żadnych wyjaśnień.`,
  to_markdown: `Przekształć ten tekst w poprawny Markdown. Dodaj nagłówki (##, ###), listy (- lub 1.), pogrubienia (**) dla ważnych terminów, bloki kodu (\`\`\`) gdzie stosowne. Odpowiedz TYLKO Markdownem bez żadnych wyjaśnień.`,
  voice_edit: (instruction: string) =>
    `Zmodyfikuj poniższą notatkę zgodnie z instrukcją użytkownika. Odpowiedz TYLKO zmodyfikowanym tekstem, bez żadnych wyjaśnień.\nInstrukcja: ${instruction}`,
};

export async function POST(req: NextRequest) {
  const { content, mode, instruction } = await req.json() as {
    content: string;
    mode: "correct" | "rewrite" | "to_markdown" | "voice_edit";
    instruction?: string;
  };

  const promptDef = PROMPTS[mode];
  if (!promptDef) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const prompt = typeof promptDef === "function" ? promptDef(instruction ?? "") : promptDef;

  const result = await chatComplete({
    op: "generation",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: content.slice(0, 4000) },
    ],
    temperature: 0.4,
    maxTokens: 2000,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ result: result.content || "" });
}
