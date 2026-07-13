// Z-131 (T-17) — handler: OCR dokumentu magazynowego (faktura/WZ/PZ) 2-etapowo.
// Z `/api/llm/magazynowanie/document`.
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";
import { JobError, type JobContext } from "@/lib/jobs/types";
import { assertValidImage } from "@/lib/jobs/handlers/imageInput";

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

export interface DocumentPayload { image?: string }
export interface DocumentLine { name: string; quantity: number; unit: string | null; unitPrice: number | null }
export interface DocumentResult { number: string | null; supplier: string | null; lines: DocumentLine[] }

export async function magazynDocumentHandler(payload: DocumentPayload, ctx: JobContext): Promise<DocumentResult> {
  const image = assertValidImage(payload?.image);

  const vision = await chatComplete({
    op: "vision",
    userId: ctx.ownerId ?? undefined,
    messages: [{ role: "user", content: [
      { type: "text", text: VISION_PROMPT },
      { type: "image_url", image_url: { url: image } },
    ] }],
    temperature: 0.1,
    maxTokens: 2000,
  });
  if (!vision.ok) throw new JobError(vision.message, vision.status);

  const listing = vision.content.trim();
  if (!listing || /^brak\.?$/i.test(listing) || listing.length < 3) {
    throw new JobError("Nie udało się odczytać pozycji z dokumentu.", 422);
  }

  const structured = await chatComplete({
    op: "generation",
    userId: ctx.ownerId ?? undefined,
    messages: [
      { role: "system", content: STRUCTURE_PROMPT },
      { role: "user", content: listing },
    ],
    temperature: 0.1,
    maxTokens: 2000,
    json: true,
  });
  if (!structured.ok) throw new JobError(structured.message, structured.status);

  try {
    const parsed = JSON.parse(stripJsonFence(structured.content)) as {
      number?: unknown; supplier?: unknown;
      lines?: Array<{ name?: unknown; quantity?: unknown; unit?: unknown; unitPrice?: unknown }>;
    };
    const lines: DocumentLine[] = Array.isArray(parsed.lines)
      ? parsed.lines.map((l) => ({
          name: String(l.name ?? "").trim(),
          quantity: typeof l.quantity === "number" ? l.quantity : Number(l.quantity) || 1,
          unit: l.unit != null ? String(l.unit) : null,
          unitPrice: typeof l.unitPrice === "number" ? l.unitPrice : l.unitPrice != null ? Number(l.unitPrice) || null : null,
        })).filter((l) => l.name)
      : [];
    return {
      number: parsed.number != null ? String(parsed.number) : null,
      supplier: parsed.supplier != null ? String(parsed.supplier) : null,
      lines,
    };
  } catch {
    throw new JobError("LLM zwrócił nieprawidłowy format", 502);
  }
}
