import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { content } = await req.json() as { content: string };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Groq API key not configured" }, { status: 503 });
  }

  if (!content?.trim()) {
    return NextResponse.json({ error: "No content" }, { status: 400 });
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
        {
          role: "system",
          content: "Na podstawie treści notatki zaproponuj krótki, zwięzły tytuł (max 60 znaków). Odpowiedz TYLKO tytułem, bez cudzysłowów, bez dodatkowych wyjaśnień.",
        },
        { role: "user", content: content.slice(0, 1000) },
      ],
      temperature: 0.4,
      max_tokens: 60,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const title = (data.choices[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");

  return NextResponse.json({ title });
}
