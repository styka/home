import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";

const SYSTEM_PROMPT = `Jesteś asystentem zarządzania zadaniami. Użytkownik poda dane opisujące jedno
lub więcej zadań — w DOWOLNEJ formie: luźny tekst, lista (myślniki/numery/nowe linie), CSV
(z nagłówkami lub bez), JSON (tablica lub obiekty), albo „rozjechany" tekst sklejony z różnych źródeł.
Twoim zadaniem jest ZROZUMIEĆ te dane i zmapować je samodzielnie na pola zadań — nawet jeśli układ
jest nietypowy, kolumny są w innej kolejności, nagłówki są po angielsku, a dane niespójne.

Zwróć tablicę JSON obiektów zadań. Każdy obiekt MUSI mieć pola:
- title: string (zwięzły tytuł, po polsku; jeśli brak wyraźnego tytułu — wygeneruj z treści)
- description: string | null (dodatkowe szczegóły, jeśli są; inaczej null)
- priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
- dueDate: string | null (ISO 8601, np. "2024-05-10T10:00:00.000Z", lub null)
- estimatedMins: number | null (szacowany czas w minutach, lub null)
- tags: string[] (słowa kluczowe, małymi literami, max 3)
- recurring: null | { type: "DAILY"|"WEEKLY"|"MONTHLY"|"YEARLY", interval: number, daysOfWeek?: number[], dayOfMonth?: number }

Mapowanie pól (rozpoznawaj synonimy, PL i EN):
- tytuł: "title","tytuł","nazwa","task","zadanie","name","co" → title
- opis: "description","opis","szczegóły","notes","uwagi" → description
- priorytet: "priority","priorytet","ważność","P1/P2/P3","high/med/low","pilne" → priority
- termin: "due","deadline","termin","data","kiedy","when","do dnia" → dueDate
- czas: "time","czas","estymacja","mins","minuty","h","godziny" → estimatedMins (przelicz h→min)
- tagi: "tags","tagi","etykiety","kategoria","label","#hashtagi" → tags

Reguły interpretacji:
- "pilne","asap","natychmiast","P1","!!!" → "URGENT"; "ważne","wysoki","P2","high" → "HIGH";
  "średni","P3","med" → "MEDIUM"; "niski","low" → "LOW"; brak → "NONE".
- Daty względne: "jutro","za 3 dni","w piątek","w weekend","koniec miesiąca" → konkretna data ISO.
- "co tydzień","co środę" → recurring WEEKLY; "codziennie" → DAILY; "co miesiąc"/"15. każdego
  miesiąca" → MONTHLY (z dayOfMonth, jeśli podano dzień); "co rok" → YEARLY.
- CSV: pierwszy wiersz to nagłówki TYLKO jeśli wygląda jak nagłówki; inaczej każdy wiersz = zadanie,
  a pierwsza sensowna kolumna = tytuł.
- JSON: zmapuj klucze wejściowe na pola wyjściowe wg synonimów; nieznane klucze dołącz do description.
- Pomijaj puste/śmieciowe wiersze. Nie wymyślaj zadań, których nie ma w danych.
- Dzisiejsza data jest podana w kontekście użytkownika.

Zwróć WYŁĄCZNIE tablicę JSON (bez markdown, bez komentarzy).

Przykład wejścia (CSV): "co;kiedy;waga\nzadzwoń do dentysty;piątek;pilne\nkupić mleko;;niski"
Przykład wyjścia: [{"title":"Zadzwoń do dentysty","description":null,"priority":"URGENT","dueDate":"2024-05-10T09:00:00.000Z","estimatedMins":null,"tags":["zdrowie"],"recurring":null},{"title":"Kupić mleko","description":null,"priority":"LOW","dueDate":null,"estimatedMins":null,"tags":["zakupy"],"recurring":null}]`;

const TRANSCRIBE_PROMPT = `Jesteś precyzyjnym OCR-em. Przepisz CAŁY czytelny tekst ze zdjęcia
(kartka, notatka, lista zadań, zrzut ekranu, tablica). Zachowaj strukturę listy/wierszy tak jak jest.
Nie tłumacz, nie streszczaj, nie dodawaj niczego od siebie. Zwróć wyłącznie przepisany tekst
(może być w Markdown). Jeśli na zdjęciu nie ma żadnego czytelnego tekstu — zwróć dokładnie: BRAK.`;

const MAX_BYTES = 8 * 1024 * 1024;

function isValidDataUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(s);
}
function approxBase64Bytes(s: string): number {
  const idx = s.indexOf(",");
  if (idx < 0) return 0;
  return Math.floor(((s.length - idx - 1) * 3) / 4);
}

async function structureTasks(text: string, today: string) {
  const userMsg = `Dzisiejsza data: ${today}\n\nDane do sparsowania na zadania:\n${text.trim()}`;
  return chatComplete({
    op: "dispatch",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.1,
    maxTokens: 2048,
  });
}

export async function POST(req: NextRequest) {
  const { text, image, today } = (await req.json().catch(() => ({}))) as {
    text?: string;
    image?: string;
    today?: string;
  };
  const todayStr = today ?? new Date().toISOString();

  let source = text ?? "";

  // Image path: transcribe first (vision), then structure the transcript as text.
  if (image) {
    if (!isValidDataUrl(image)) {
      return NextResponse.json({ error: "Niepoprawny format obrazu" }, { status: 400 });
    }
    if (approxBase64Bytes(image) > MAX_BYTES) {
      return NextResponse.json({ error: "Obraz za duży (max 8 MB)" }, { status: 413 });
    }
    const vision = await chatComplete({
      op: "vision",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: TRANSCRIBE_PROMPT },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });
    if (!vision.ok) return NextResponse.json({ error: vision.message }, { status: vision.status });
    const transcript = vision.content.trim();
    if (!transcript || /^brak\.?$/i.test(transcript) || transcript.length < 4) {
      return NextResponse.json(
        { error: "Na zdjęciu nie udało się odczytać tekstu. Spróbuj wyraźniejszego zdjęcia." },
        { status: 422 },
      );
    }
    source = transcript;
  }

  if (!source.trim()) return NextResponse.json({ error: "Empty input" }, { status: 400 });

  const result = await structureTasks(source, todayStr);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  let tasks: unknown[];
  try {
    tasks = JSON.parse(stripJsonFence(result.content || "[]"));
    if (!Array.isArray(tasks)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }

  return NextResponse.json({ tasks });
}
