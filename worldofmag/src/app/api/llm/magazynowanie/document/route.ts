import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";

// OCR dokumentu magazynowego (faktura / WZ / PZ) ze zdjęcia — dwuetapowo:
//   1) model wizyjny odczytuje tekst pozycji z dokumentu,
//   2) model tekstowy strukturyzuje pozycje w JSON {lines, number, supplier}.

const VISION_PROMPT = `To zdjęcie dokumentu magazynowego lub faktury zakupu. Odczytaj dokładnie
wszystkie POZYCJE z tabeli (nazwa towaru, ilość, jednostka, cena jednostkowa). Wypisz też numer
dokumentu i nazwę dostawcy/sprzedawcy, jeśli widoczne. Wypisz jeden wiersz pozycji w linii, np.
"Śruba M8 x100 szt — 0,30". Jeśli to nie jest dokument z pozycjami — zwróć dokładnie: BRAK.`;

const STRUCTURE_PROMPT = `Otrzymasz odczyt dokumentu zakupu/magazynowego. Zwróć WYŁĄCZNIE JSON:
{
  "number": string|null,
  "supplier": string|null,
  "lines": [{"name": string, "quantity": number, "unit": string|null, "unitPrice": number|null}]
}
Wszystko po polsku. Ceny jako liczby (kropka dziesiętna), bez waluty. Ilość zawsze liczbą (domyślnie 1).
Nie wymyślaj pozycji, których nie ma w odczycie.`;

const MAX_BYTES = 8 * 1024 * 1024;
const isValidDataUrl = (s: string) => /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(s);
function approxBytes(s: string): number {
  const idx = s.indexOf(",");
  return idx < 0 ? 0 : Math.floor(((s.length - idx - 1) * 3) / 4);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image } = (await req.json().catch(() => ({}))) as { image?: string };
  if (!image || typeof image !== "string") return NextResponse.json({ error: "Brak obrazu" }, { status: 400 });
  if (!isValidDataUrl(image)) return NextResponse.json({ error: "Niepoprawny format obrazu" }, { status: 400 });
  if (approxBytes(image) > MAX_BYTES) return NextResponse.json({ error: "Obraz za duży (max 8 MB)" }, { status: 413 });

  const vision = await chatComplete({
    op: "vision",
    userId: session.user?.id, // Z-130: budżet + zliczenie tokenów
    messages: [
      { role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url: image } }] },
    ],
    temperature: 0.1,
    maxTokens: 2000,
  });
  if (!vision.ok) return NextResponse.json({ error: vision.message }, { status: vision.status });

  const listing = vision.content.trim();
  if (!listing || /^brak\.?$/i.test(listing) || listing.length < 3) {
    return NextResponse.json({ error: "Nie udało się odczytać pozycji z dokumentu." }, { status: 422 });
  }

  const structured = await chatComplete({
    op: "generation",
    messages: [
      { role: "system", content: STRUCTURE_PROMPT },
      { role: "user", content: listing },
    ],
    temperature: 0.1,
    maxTokens: 2000,
    json: true,
  });
  if (!structured.ok) return NextResponse.json({ error: structured.message }, { status: structured.status });

  try {
    const parsed = JSON.parse(stripJsonFence(structured.content)) as {
      number?: unknown;
      supplier?: unknown;
      lines?: Array<{ name?: unknown; quantity?: unknown; unit?: unknown; unitPrice?: unknown }>;
    };
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines
          .map((l) => ({
            name: String(l.name ?? "").trim(),
            quantity: typeof l.quantity === "number" ? l.quantity : Number(l.quantity) || 1,
            unit: l.unit != null ? String(l.unit) : null,
            unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : l.unitPrice != null ? Number(l.unitPrice) || null : null,
          }))
          .filter((l) => l.name)
      : [];
    return NextResponse.json({
      number: parsed.number != null ? String(parsed.number) : null,
      supplier: parsed.supplier != null ? String(parsed.supplier) : null,
      lines,
    });
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }
}
