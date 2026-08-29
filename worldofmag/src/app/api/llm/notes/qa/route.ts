import { NextRequest } from "next/server";
import { chatStream } from "@/platform/llm/chat";
import { auth } from "@/platform/auth/session";

export async function POST(req: NextRequest) {
  // Sesję wymusza już middleware; auth() jest tu po `userId` — bez niego koszt wywołania
  // nie wiązał się z użytkownikiem (licznik zużycia i miesięczny limit planu go pomijały).
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const { question, notes } = await req.json() as {
    question: string;
    notes: Array<{ title: string; content: string }>;
  };

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

  return chatStream({
    op: "reasoning",
    userId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.5,
    maxTokens: 800,
  });
}
