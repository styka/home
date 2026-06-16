import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";

// Redaguje uprzejmą, rzeczową treść zamówienia do dostawcy na podstawie listy
// pozycji. Zwraca czysty tekst (do skopiowania / wysłania mailem).

const SYSTEM_PROMPT = `Jesteś asystentem zaopatrzenia. Napisz po polsku krótką, uprzejmą i rzeczową
treść e-maila z zamówieniem do dostawcy. Zacznij od zwrotu grzecznościowego, podaj listę pozycji
z ilościami w czytelnych punktach, poproś o potwierdzenie dostępności i terminu realizacji oraz
podsumowanie kosztów. Zakończ podpisem ogólnym. Bez markdown, zwykły tekst.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supplier, lines } = (await req.json().catch(() => ({}))) as {
    supplier?: string;
    lines?: Array<{ name: string; quantity: number; unit?: string | null }>;
  };
  const items = (lines ?? []).filter((l) => l?.name);
  if (items.length === 0) return NextResponse.json({ error: "Brak pozycji" }, { status: 400 });

  const userMsg = [
    supplier ? `Dostawca: ${supplier}` : "Dostawca: (nieokreślony)",
    "Pozycje do zamówienia:",
    ...items.map((l) => `- ${l.name}: ${l.quantity}${l.unit ? " " + l.unit : ""}`),
  ].join("\n");

  const result = await chatComplete({
    op: "generation",
    userId: session.user?.id, // Z-130: budżet + zliczenie tokenów
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.5,
    maxTokens: 600,
  });

  if (!result.ok) return NextResponse.json({ unavailable: true }, { status: 200 });
  return NextResponse.json({ text: result.content.trim() });
}
