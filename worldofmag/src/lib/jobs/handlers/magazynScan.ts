// Z-131 (T-17) — handler: inwentaryzacja ze zdjęcia (2-etapowo). Z `/api/llm/magazynowanie/scan`.
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";
import { JobError, type JobContext } from "@/lib/jobs/types";
import { assertValidImage } from "@/lib/jobs/handlers/imageInput";

const VISION_PROMPT = `Jesteś asystentem inwentaryzacji magazynu. Na zdjęciu jest półka, regał,
szafa, garaż albo skrzynia z rzeczami. Wypisz po polsku WSZYSTKIE rozróżnialne przedmioty/produkty,
które widzisz, jeden w linii. Jeśli widać ich liczbę lub opakowania — podaj ilość przy nazwie
(np. „wiertarka 1 szt", „puszki farby x3"). Nie zgaduj rzeczy, których nie widać. Jeśli na zdjęciu
nie ma żadnych rozróżnialnych przedmiotów — zwróć dokładnie: BRAK.`;

const STRUCTURE_PROMPT = `Otrzymasz listę przedmiotów odczytanych ze zdjęcia magazynu/półki.
Ułóż ją w obiekt JSON (zwróć WYŁĄCZNIE JSON, bez markdown, bez komentarza) w schemacie:
{
  "items": [
    {"name": string, "quantity": number|null, "unit": string|null, "category": string|null, "notes": string|null}
  ]
}
Wszystko po polsku, nazwa krótka i rzeczowa. "category" to ogólna polska kategoria przedmiotu
(np. "narzędzia", "elektronika", "chemia", "odzież", "spożywcze", "papiernicze"). Jeśli czegoś nie
podano — użyj null. Nie wymyślaj przedmiotów, których nie ma na liście.`;

export interface ScanPayload { image?: string }
export interface ScanItem { name: string; quantity: number | null; unit: string | null; category: string | null; notes: string | null }
export interface ScanResult { items: ScanItem[] }

export async function magazynScanHandler(payload: ScanPayload, ctx: JobContext): Promise<ScanResult> {
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
    throw new JobError("Na zdjęciu nie udało się rozpoznać przedmiotów. Spróbuj wyraźniejszego zdjęcia.", 422);
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
      items?: Array<{ name?: unknown; quantity?: unknown; unit?: unknown; category?: unknown; notes?: unknown }>;
    };
    const items: ScanItem[] = Array.isArray(parsed.items)
      ? parsed.items.map((i) => ({
          name: String(i.name ?? "").trim(),
          quantity: typeof i.quantity === "number" ? i.quantity : null,
          unit: i.unit != null ? String(i.unit) : null,
          category: i.category != null ? String(i.category) : null,
          notes: i.notes != null ? String(i.notes) : null,
        })).filter((i) => i.name)
      : [];
    return { items };
  } catch {
    throw new JobError("LLM zwrócił nieprawidłowy format", 502);
  }
}
