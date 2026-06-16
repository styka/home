import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";

// Inwentaryzacja ze zdjęcia — DWUETAPOWO (jak import przepisu ze zdjęcia):
//   1) model wizyjny wylicza wszystkie widoczne na zdjęciu przedmioty,
//   2) model tekstowy układa to w listę pozycji magazynowych (JSON).
// Jeden strzał „zdjęcie → sztywny JSON" jest mniej pewny niż rozdzielenie
// „patrzenia" od „strukturyzowania".

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

const MAX_BYTES = 8 * 1024 * 1024;

function isValidDataUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/.test(s);
}

function approxBase64Bytes(s: string): number {
  const idx = s.indexOf(",");
  if (idx < 0) return 0;
  return Math.floor(((s.length - idx - 1) * 3) / 4);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image } = (await req.json().catch(() => ({}))) as { image?: string };
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "Brak obrazu" }, { status: 400 });
  }
  if (!isValidDataUrl(image)) {
    return NextResponse.json({ error: "Niepoprawny format obrazu (oczekiwany data:image/...;base64,...)" }, { status: 400 });
  }
  if (approxBase64Bytes(image) > MAX_BYTES) {
    return NextResponse.json({ error: "Obraz za duży (max 8 MB)" }, { status: 413 });
  }

  // --- Krok 1: rozpoznanie przedmiotów (model wizyjny) ---
  const vision = await chatComplete({
    op: "vision",
    userId: session.user?.id, // Z-130: budżet + zliczenie tokenów
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    temperature: 0.1,
    maxTokens: 2000,
  });
  if (!vision.ok) {
    return NextResponse.json({ error: vision.message }, { status: vision.status });
  }

  const listing = vision.content.trim();
  if (!listing || /^brak\.?$/i.test(listing) || listing.length < 3) {
    return NextResponse.json(
      { error: "Na zdjęciu nie udało się rozpoznać przedmiotów. Spróbuj wyraźniejszego zdjęcia." },
      { status: 422 }
    );
  }

  // --- Krok 2: strukturyzacja w listę pozycji (model tekstowy, tryb JSON) ---
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
  if (!structured.ok) {
    return NextResponse.json({ error: structured.message }, { status: structured.status });
  }

  try {
    const parsed = JSON.parse(stripJsonFence(structured.content)) as {
      items?: Array<{ name?: unknown; quantity?: unknown; unit?: unknown; category?: unknown; notes?: unknown }>;
    };
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .map((i) => ({
            name: String(i.name ?? "").trim(),
            quantity: typeof i.quantity === "number" ? i.quantity : null,
            unit: i.unit != null ? String(i.unit) : null,
            category: i.category != null ? String(i.category) : null,
            notes: i.notes != null ? String(i.notes) : null,
          }))
          .filter((i) => i.name)
      : [];
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }
}
