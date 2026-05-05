import { NextRequest, NextResponse } from "next/server";

const PROMPTS: Record<string, string> = {
  correct: `Popraw błędy ortograficzne, gramatyczne i interpunkcyjne w tym tekście. Zachowaj oryginalny styl i strukturę. Odpowiedz TYLKO poprawionym tekstem bez żadnych wyjaśnień.`,
  rewrite: `Przeredaguj ten tekst: popraw styl, czytelność i spójność. Zachowaj wszystkie kluczowe informacje. Odpowiedz TYLKO przeredagowanym tekstem bez żadnych wyjaśnień.`,
  to_markdown: `Przekształć ten tekst w poprawny Markdown. Dodaj nagłówki (##, ###), listy (- lub 1.), pogrubienia (**) dla ważnych terminów, bloki kodu (\`\`\`) gdzie stosowne. Odpowiedz TYLKO Markdownem bez żadnych wyjaśnień.`,
};

export async function POST(req: NextRequest) {
  const { content, mode } = await req.json() as {
    content: string;
    mode: "correct" | "rewrite" | "to_markdown";
  };

  const prompt = PROMPTS[mode];
  if (!prompt) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Groq API key not configured" }, { status: 503 });
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: content.slice(0, 4000) },
      ],
      temperature: 0.4,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const result = data.choices[0]?.message?.content ?? "";

  return NextResponse.json({ result });
}
