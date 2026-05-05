import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { content, existingTags } = await req.json() as {
    content: string;
    existingTags: string[];
  };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Groq API key not configured" }, { status: 503 });
  }

  const systemPrompt = `Jesteś asystentem pomagającym tagować notatki.
Proponuj tagi które najlepiej opisują treść notatki.
Odpowiedz TYLKO JSON bez żadnego innego tekstu w formacie:
{"suggested": ["tag1", "tag2"], "new": ["nowy_tag"]}
- "suggested": tagi spośród dostarczonych istniejących tagów (max 5)
- "new": nowe tagi których nie ma na liście (max 3, krótkie, po polsku lub angielsku)
Tagi powinny być krótkie (1-2 słowa), pisane małymi literami.`;

  const userMessage = `Istniejące tagi: ${existingTags.length > 0 ? existingTags.join(", ") : "(brak)"}

Treść notatki:
${content.slice(0, 2000)}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "LLM request failed" }, { status: 502 });
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const text = data.choices[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(text) as { suggested?: string[]; new?: string[] };
    return NextResponse.json({
      suggested: (parsed.suggested ?? []).filter((t: string) => existingTags.includes(t)),
      new: parsed.new ?? [],
    });
  } catch {
    return NextResponse.json({ suggested: [], new: [] });
  }
}
