import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";

// Generowanie listy słówek do nauki na podstawie dowolnego tekstu (np. kodu,
// artykułu, opisu projektu). Zwraca słówka w języku docelowym wraz z
// tłumaczeniem, przykładem użycia i częścią mowy.

const MAX_SOURCE = 6000;
const MAX_WORDS = 40;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceText, nativeLang, targetLang, max } = (await req.json().catch(() => ({}))) as {
    sourceText?: string;
    nativeLang?: string;
    targetLang?: string;
    max?: number;
  };

  const text = (sourceText ?? "").trim();
  if (!text) return NextResponse.json({ error: "Brak tekstu źródłowego" }, { status: 400 });

  const native = (nativeLang ?? "polski").trim();
  const target = (targetLang ?? "angielski").trim();
  const limit = Math.min(Math.max(typeof max === "number" ? max : 20, 1), MAX_WORDS);

  const systemPrompt = `Jesteś nauczycielem języka. Na podstawie tekstu źródłowego wybierz najważniejsze, przydatne słownictwo w języku docelowym (${target}), którego warto się nauczyć. Pomijaj słowa banalne (typu „the", „and"). Dla każdego słówka podaj tłumaczenie w języku ${native}, krótki przykład użycia w języku ${target} oraz część mowy.
Odpowiedz WYŁĄCZNIE obiektem JSON (bez markdown, bez komentarza) w formacie:
{"words":[{"term":"...","translation":"...","example":"...","partOfSpeech":"rzeczownik|czasownik|przymiotnik|..."}]}
Maksymalnie ${limit} słówek. „term" w języku ${target}, „translation" w języku ${native}.`;

  const userMessage = `Tekst źródłowy:\n${text.slice(0, MAX_SOURCE)}`;

  const result = await chatComplete({
    op: "generation",
    userId: session.user?.id, // Z-130: budżet + tokeny
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    maxTokens: 2000,
    json: true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  try {
    const parsed = JSON.parse(result.content || "{}") as {
      words?: Array<{ term?: string; translation?: string; example?: string; partOfSpeech?: string }>;
    };
    const words = (parsed.words ?? [])
      .filter((w) => w.term && w.translation)
      .slice(0, limit)
      .map((w) => ({
        term: String(w.term).trim(),
        translation: String(w.translation).trim(),
        example: w.example ? String(w.example).trim() : null,
        partOfSpeech: w.partOfSpeech ? String(w.partOfSpeech).trim() : null,
      }));
    return NextResponse.json({ words });
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }
}
