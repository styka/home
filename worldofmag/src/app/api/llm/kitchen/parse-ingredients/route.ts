import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SYSTEM_PROMPT = `Jesteś parserem składników kulinarnych po polsku.
Otrzymasz blok tekstu z listą składników (jeden na linię lub po przecinkach).
Zwróć TYLKO tablicę JSON, bez żadnego komentarza.

Schema:
[{
  "name": string,           // krótka nazwa składnika małymi literami, bez ilości (np. "mąka pszenna")
  "quantity": number|null,  // wartość liczbowa
  "unit": string|null,      // jednostka: kg, dkg, g, l, ml, szt, łyżka, łyżeczka, szczypta, op, paczka, butelka, puszka, torebka, słoik
  "note": string|null,      // np. "drobno posiekane", "schłodzone"
  "isOptional": boolean     // true gdy w tekście jest "opcjonalnie" lub "do smaku"
}]

Przykład wejścia:
400 g spaghetti
200g boczku
4 żółtka
100g parmezanu
szczypta soli (do smaku)
pietruszka — opcjonalnie

Przykład wyjścia:
[
  {"name":"spaghetti","quantity":400,"unit":"g","note":null,"isOptional":false},
  {"name":"boczek","quantity":200,"unit":"g","note":null,"isOptional":false},
  {"name":"żółtko","quantity":4,"unit":"szt","note":null,"isOptional":false},
  {"name":"parmezan","quantity":100,"unit":"g","note":null,"isOptional":false},
  {"name":"sól","quantity":null,"unit":"szczypta","note":"do smaku","isOptional":true},
  {"name":"pietruszka","quantity":null,"unit":null,"note":null,"isOptional":true}
]`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w panelu admina." },
      { status: 503 }
    );
  }

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.value}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: String(text).slice(0, 4000) },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text().catch(() => "unknown");
    return NextResponse.json({ error: `Groq error: ${err}` }, { status: 502 });
  }

  const data = await groqRes.json();
  const content: string = data.choices?.[0]?.message?.content ?? "[]";

  let ingredients: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
    note: string | null;
    isOptional: boolean;
  }>;
  try {
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    ingredients = JSON.parse(cleaned);
    if (!Array.isArray(ingredients)) throw new Error("not array");
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }

  return NextResponse.json({ ingredients });
}
