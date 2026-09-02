import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/platform/llm/chat";
import { auth } from "@/platform/auth/session";
import { usageField } from "@/platform/ai/costVisibility";

const PROMPTS: Record<string, string | ((instruction: string) => string)> = {
  correct: `Popraw błędy ortograficzne, gramatyczne i interpunkcyjne w tym tekście. Zachowaj oryginalny styl i strukturę. Odpowiedz TYLKO poprawionym tekstem bez żadnych wyjaśnień.`,
  rewrite: `Przeredaguj ten tekst: popraw styl, czytelność i spójność. Zachowaj wszystkie kluczowe informacje. Odpowiedz TYLKO przeredagowanym tekstem bez żadnych wyjaśnień.`,
  to_markdown: `Przekształć ten tekst w poprawny Markdown. Dodaj nagłówki (##, ###), listy (- lub 1.), pogrubienia (**) dla ważnych terminów, bloki kodu (\`\`\`) gdzie stosowne. Odpowiedz TYLKO Markdownem bez żadnych wyjaśnień.`,
  voice_edit: (instruction: string) =>
    `Zmodyfikuj poniższą notatkę zgodnie z instrukcją użytkownika. Odpowiedz TYLKO zmodyfikowanym tekstem, bez żadnych wyjaśnień.\nInstrukcja: ${instruction}`,
};

export async function POST(req: NextRequest) {
  // Sesję wymusza już middleware; auth() jest tu po `userId` — bez niego chatComplete nie
  // wiązał kosztu z użytkownikiem, więc licznik zużycia i miesięczny limit planu pomijały
  // te wywołania (dawały się obejść „tańszą" trasą pomocniczą).
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
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
    userId,
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

  return NextResponse.json({ result: result.content || "", ...(await usageField(result, "przepisanie tekstu")) });
}
