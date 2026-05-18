import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CATEGORIES = [
  "Produce", "Dairy & Eggs", "Meat & Fish", "Bakery",
  "Dry Goods & Pasta", "Drinks", "Frozen", "Snacks & Sweets",
  "Condiments & Oils", "Spices & Herbs", "Cleaning & Hygiene",
  "Canned & Preserved", "Other",
];

const SYSTEM_PROMPT = `Jesteś ekspertem od layoutów polskich supermarketów.
Generujesz graf reprezentujący układ kategorii produktów w sklepie.

Dozwolone kategorie: ${CATEGORIES.join(", ")}

Węzły grafu:
- START (id: "start", type: "START", label: "Wejście")
- STOP (id: "stop", type: "STOP", label: "Kasy")
- Węzły kategorii (type: "CATEGORY", category: jedna z dozwolonych kategorii)

Krawędzie: { fromId, toId, weight } gdzie weight to odległość (1-10, mniejsza = bliżej).

Przykładowe układy polskich sieci:

Biedronka (typowy mały/średni sklep):
- Wejście → warzywa/owoce (1), kwiaty/sezonowe (1)
- Warzywa → nabiał (2), mięso (2)
- Nabiał → piekarnia (2)
- Mięso → mrożonki (3), deli (2)
- Piekarnia → przekąski (2), suche/makarony (3)
- Suche → chemia/higiena (4), przetwory (3)
- Chemia → kasy (2)

Lidl (typowy układ):
- Wejście → piekarnia (1), warzywa (2)
- Piekarnia → przekąski (2)
- Warzywa → nabiał (2), owoce (1)
- Nabiał → mięso (2), mrożonki (3)
- Mięso → ryby (2)
- Suche/makarony → przetwory (2), sosy/oleje (2)
- Chemia osobno (4-5 od wejścia) → kasy

Żabka (mały sklep convenience):
- Wejście → napoje (1), przekąski (1)
- Napoje → nabiał (2), alkohol (2)
- Przekąski → słodycze (1)
- Nabiał → kanapki/deli (1)
- Kasy blisko wejścia (3-4)

Auchan/Carrefour (hipermarket):
- Wejście → warzywa/owoce (1)
- Warzywa → nabiał (3), piekarnia (2)
- Nabiał → mięso (3), ryby (3)
- Mięso → mrożonki (4)
- Alkohole daleko (6-7)
- Chemia/higiena osobne alejki (5-6)
- Kasy po prawej stronie (8-10)

Zwróć JSON w dokładnie tym formacie:
{
  "nodes": [
    { "id": "start", "type": "START", "category": null, "label": "Wejście" },
    { "id": "cat_produce", "type": "CATEGORY", "category": "Produce", "label": "Warzywa i owoce" },
    ...
    { "id": "stop", "type": "STOP", "category": null, "label": "Kasy" }
  ],
  "edges": [
    { "fromId": "start", "toId": "cat_produce", "weight": 1 },
    ...
  ],
  "confidence": "high",
  "note": "Typowy układ Biedronki"
}

Zasady:
- Zawsze uwzględnij START i STOP
- Dołącz tylko kategorie faktycznie obecne w tym sklepie (nie wszystkie 13)
- Wagi od 1 (sąsiednie) do 10 (druga strona sklepu)
- confidence: "high" jeśli znasz ten sklep, "medium" jeśli podobny, "low" jeśli zgadujesz
- Zwróć TYLKO JSON, bez dodatkowego tekstu`;

export async function POST(req: NextRequest) {
  const { storeName } = await req.json().catch(() => ({ storeName: "" }));
  if (!storeName?.trim()) return NextResponse.json({ error: "Empty store name" }, { status: 400 });

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w Panelu Admina." },
      { status: 503 }
    );
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.value}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Wygeneruj mapę sklepu: "${storeName.trim()}"` },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text().catch(() => "unknown");
    return NextResponse.json({ error: `Groq error: ${err}` }, { status: 502 });
  }

  const groqData = await groqRes.json();
  const content: string = groqData.choices?.[0]?.message?.content ?? "{}";

  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned);
    if (!parsed.nodes || !parsed.edges) throw new Error("missing fields");
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }
}
