import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/platform/auth/session";
import { chatComplete } from "@/platform/llm/chat";
import { visibleUsage } from "@/platform/ai/costVisibility";
import { usageFromChat } from "@/platform/ai/usage";
import {
  podzielNaFragmenty,
  odzyskajSlowka,
  scalSlowka,
  type SlowkoZTekstu,
} from "@/modules/languages/lib/ekstrakcjaSlowek";

// Generowanie listy słówek do nauki na podstawie dowolnego tekstu (np. kodu,
// artykułu, opisu projektu). Zwraca słówka w języku docelowym wraz z
// tłumaczeniem, przykładem użycia i częścią mowy.
//
// 121 (zgł. 1): BEZ limitu liczby słówek. Zgłoszenie właściciela: „jest ograniczenie
// przygotowania do 25 słówek z podanego tekstu, a powinny być wszystkie". Limit siedział
// w trzech miejscach (`max` z UI, „Maksymalnie N słówek" w prompcie, `slice(0, limit)` na
// wyniku) — wszystkie trzy zniknęły. Żeby lista naprawdę pokrywała CAŁY tekst, źródło jest
// dzielone na fragmenty (osobne, mniejsze wywołania zamiast jednego, które budżet wyjścia
// uciąłby w połowie), a odpowiedź czytana tolerancyjnie z odzyskiem kompletnych pozycji.

/** Fragment źródła na jedno wywołanie — mały na tyle, że lista słówek mieści się w budżecie wyjścia. */
const FRAGMENT_ZRODLA = 4000;
/** Sufit całego źródła (6 fragmentów). Powyżej: przetwarzamy początek i mówimy o tym wprost
 *  (`sourceTruncated`) — nigdy ciche ucięcie, jak dawne `slice(0, 6000)`. */
const MAKS_ZRODLO = 24_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sourceText, nativeLang, targetLang } = (await req.json().catch(() => ({}))) as {
    sourceText?: string;
    nativeLang?: string;
    targetLang?: string;
  };

  const text = (sourceText ?? "").trim();
  if (!text) return NextResponse.json({ error: "Brak tekstu źródłowego" }, { status: 400 });

  const native = (nativeLang ?? "polski").trim();
  const target = (targetLang ?? "angielski").trim();

  const sourceTruncated = text.length > MAKS_ZRODLO;
  const fragmenty = podzielNaFragmenty(text.slice(0, MAKS_ZRODLO), FRAGMENT_ZRODLA);

  const systemPrompt = `Jesteś nauczycielem języka. Na podstawie tekstu źródłowego wypisz WSZYSTKIE przydatne słówka w języku docelowym (${target}), których warto się nauczyć — bez limitu liczby, z całego tekstu. Pomijaj wyłącznie słowa banalne (typu „the", „and"). Dla każdego słówka podaj tłumaczenie w języku ${native}, krótki przykład użycia w języku ${target} oraz część mowy.
Odpowiedz WYŁĄCZNIE obiektem JSON (bez markdown, bez komentarza) w formacie:
{"words":[{"term":"...","translation":"...","example":"...","partOfSpeech":"rzeczownik|czasownik|przymiotnik|..."}]}
„term" w języku ${target}, „translation" w języku ${native}.`;

  // Sekwencyjnie (bez równoległego młócenia limitu TPM); porażka jednego fragmentu nie zbija
  // operacji, jeśli inne coś dały — dopiero komplet porażek jest błędem dla użytkownika.
  const wywolania: Array<{ res: Awaited<ReturnType<typeof chatComplete>>; label?: string; op?: string }> = [];
  const listy: SlowkoZTekstu[][] = [];
  let pierwszyBlad: { status: number; message: string } | null = null;
  let byloUciecie = false;

  for (const fragment of fragmenty) {
    const result = await chatComplete({
      op: "generation",
      userId: session.user?.id, // Z-130: budżet + tokeny
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Tekst źródłowy:\n${fragment}` },
      ],
      temperature: 0.3,
      // Dawne 2000 przy zniesionym limicie byłoby pierwszym miejscem ucięcia listy.
      maxTokens: 6000,
      json: true,
    });
    wywolania.push({ res: result, label: "ekstrakcja słownictwa" });

    if (!result.ok) {
      pierwszyBlad ??= { status: result.status, message: result.message };
      continue;
    }
    if (result.truncated) byloUciecie = true;
    listy.push(odzyskajSlowka(result.content ?? ""));
  }

  const words = scalSlowka(listy);

  if (words.length === 0) {
    if (pierwszyBlad) {
      return NextResponse.json({ error: pierwszyBlad.message }, { status: pierwszyBlad.status });
    }
    // 119 (lekcja): „nieprawidłowy format" bez przyczyny było bezużyteczne — nazwij, co zawiodło.
    const error = byloUciecie
      ? "Odpowiedź modelu została ucięta i nie dało się z niej odzyskać słówek — spróbuj ponownie albo podaj krótszy tekst"
      : "Model nie zwrócił żadnych słówek — spróbuj ponownie";
    return NextResponse.json({ error }, { status: 502 });
  }

  // Recenzja 121 (ust. 1): częściowy wynik nie może „udawać poprawnego" (lekcja 119/120) —
  // ucięta odpowiedź fragmentu albo fragment, który zawiódł w połowie pętli, oddaje to, co jest,
  // ale z jawną flagą, którą UI zamienia na notę dla użytkownika.
  const outputTruncated = byloUciecie || pierwszyBlad !== null;
  const usage = await visibleUsage(usageFromChat(wywolania));
  return NextResponse.json({
    words,
    ...(sourceTruncated ? { sourceTruncated: true } : {}),
    ...(outputTruncated ? { outputTruncated: true } : {}),
    ...(usage ? { usage } : {}),
  });
}
