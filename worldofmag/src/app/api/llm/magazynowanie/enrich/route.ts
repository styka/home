import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { chatComplete } from "@/lib/llm/chat";
import { stripJsonFence } from "@/lib/groqVision";

// Wzbogacenie pozycji przy skanie nieznanego kodu: na podstawie kodu kreskowego
// i/lub wpisanej nazwy LLM podpowiada polską nazwę, kategorię i jednostkę.
// Czysto pomocnicze — wynik trafia do formularza, użytkownik może go poprawić.

const SYSTEM_PROMPT = `Jesteś asystentem magazynu. Otrzymujesz kod kreskowy (EAN) i/lub nazwę produktu.
Zwróć WYŁĄCZNIE JSON: {"name": string, "category": string|null, "unit": string|null}.
Zasady: wszystko po polsku; nazwa krótka i rzeczowa; "category" to ogólna polska kategoria
(np. "narzędzia", "elektronika", "chemia", "spożywcze", "papiernicze", "odzież"); "unit" to
typowa jednostka (np. "szt", "opak", "kg", "l"). Jeśli nie potrafisz rozpoznać produktu po samym
kodzie — oprzyj się na nazwie; jeśli nic nie wiadomo, zwróć podaną nazwę i null dla reszty.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { barcode, name } = (await req.json().catch(() => ({}))) as { barcode?: string; name?: string };
  if (!barcode && !name) return NextResponse.json({ error: "Brak danych" }, { status: 400 });

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Kod: ${barcode || "—"}\nNazwa: ${name || "—"}` },
    ],
    temperature: 0.2,
    maxTokens: 200,
    json: true,
  });

  if (!result.ok) return NextResponse.json({ unavailable: true }, { status: 200 });

  try {
    const parsed = JSON.parse(stripJsonFence(result.content)) as { name?: unknown; category?: unknown; unit?: unknown };
    return NextResponse.json({
      name: parsed.name != null ? String(parsed.name).trim() : name || "",
      category: parsed.category != null ? String(parsed.category) : null,
      unit: parsed.unit != null ? String(parsed.unit) : null,
    });
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 200 });
  }
}
