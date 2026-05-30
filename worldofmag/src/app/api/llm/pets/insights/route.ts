import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";
import { auth } from "@/lib/auth";

interface InsightsBody {
  pets?: Array<{ name: string; species: string; presetKey?: string }>;
  agenda?: Array<{ petName: string; title: string; bucket: string; dueAt: string }>;
  ruleSuggestions?: Array<{ title: string; detail?: string }>;
}

const SYSTEM_PROMPT = `Jesteś doświadczonym doradcą ds. dobrostanu zwierząt domowych i egzotycznych.
Na podstawie listy zwierząt użytkownika, ich gatunków oraz nadchodzących/zaległych zadań opieki
formułujesz krótkie, konkretne i praktyczne porady po polsku — dopasowane do gatunku.
Zasady:
- Zwróć TYLKO JSON: {"tips": ["porada 1", "porada 2", ...]}
- Maksymalnie 4 porady, każda 1 zdanie (do 140 znaków), konkretna i wykonalna.
- Priorytetyzuj zaległe pozycje i zdrowie. Uwzględnij specyfikę gatunku (np. UVB dla gadów, parametry wody dla ryb).
- Nie wymyślaj danych, których nie ma. Jeśli brak sygnałów, zaproponuj dobre praktyki profilaktyczne dla gatunku.
- Bez markdown, bez dodatkowego tekstu poza JSON.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as InsightsBody;
  const pets = body.pets ?? [];
  if (pets.length === 0) return NextResponse.json({ tips: [] });

  const userMsg = [
    `Zwierzęta: ${pets.map((p) => `${p.name} (${p.species})`).join(", ")}`,
    body.agenda?.length
      ? `Zadania opieki: ${body.agenda.map((a) => `${a.petName}: ${a.title} [${a.bucket}]`).join("; ")}`
      : "Brak zaplanowanych zadań opieki.",
    body.ruleSuggestions?.length
      ? `Sygnały: ${body.ruleSuggestions.map((s) => s.title).join("; ")}`
      : null,
  ].filter(Boolean).join("\n");

  const result = await chatComplete({
    op: "reasoning",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.4,
    maxTokens: 512,
  });

  if (!result.ok) {
    return NextResponse.json({ tips: [], unavailable: true }, { status: 200 });
  }

  try {
    const content = result.content || "{}";
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").replace(/^```\n?/, "");
    const parsed = JSON.parse(cleaned) as { tips?: string[] };
    const tips = Array.isArray(parsed.tips) ? parsed.tips.filter((t) => typeof t === "string").slice(0, 4) : [];
    return NextResponse.json({ tips });
  } catch {
    return NextResponse.json({ tips: [], unavailable: true }, { status: 200 });
  }
}
