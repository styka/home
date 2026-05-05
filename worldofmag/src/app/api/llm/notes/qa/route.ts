import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { question, notes } = await req.json() as {
    question: string;
    notes: Array<{ title: string; content: string }>;
  };

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response("Groq API key not configured", { status: 503 });
  }

  const notesContext = notes
    .map((n, i) => `[${i + 1}] ${n.title}\n${n.content}`)
    .join("\n\n---\n\n")
    .slice(0, 8000);

  const systemPrompt = `Jesteś asystentem odpowiadającym na pytania na podstawie notatek użytkownika.
Odpowiadaj po polsku, zwięźle i konkretnie.
Jeśli odpowiedź jest w notatkach — odpowiedz i wskaż skąd pochodzi informacja.
Jeśli nie wiesz — powiedz to wprost, nie wymyślaj.
Na końcu odpowiedzi ZAWSZE dodaj blok: <!-- sources: [1,3] --> z numerami notatek (indeksy od 1) które stanowiły podstawę odpowiedzi. Jeśli żadna nie była podstawą, wpisz: <!-- sources: [] -->.`;

  const userMessage = `Moje notatki:\n\n${notesContext}\n\n---\n\nPytanie: ${question}`;

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
      temperature: 0.5,
      max_tokens: 800,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    return new Response("LLM request failed", { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
