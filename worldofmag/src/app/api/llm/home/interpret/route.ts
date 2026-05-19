import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface AIAction {
  id: string;
  module: "shopping" | "tasks" | "notes";
  description: string;
  type: string;
  params: Record<string, unknown>;
  searchQuery?: string;
}

const SYSTEM_PROMPT = `Jesteś asystentem zarządzania osobistego. Analizujesz polecenie użytkownika i zwracasz listę akcji do wykonania w aplikacji WorldOfMag.

Dostępne typy akcji:

ZAKUPY (module: "shopping"):
- add_item: params { rawText: string, listName?: string }
  Dodaje produkt do listy zakupów.
  WAŻNE: rawText to WYŁĄCZNIE nazwa i ilość produktu (np. "2 kg jabłek", "3x mleko", "Sachol").
  rawText NIE może zawierać nazwy listy ani frazy "do listy X".
  Jeśli użytkownik wskazuje konkretną listę (np. "do listy Apteka", "na listę Tygodniowe", "do drugiej listy o nazwie X"),
  wyodrębnij jej nazwę i umieść w listName. listName to fragment nazwy listy, np. "Apteka", "Tygodniowe zakupy".
  Jeśli lista nie jest podana wprost, pomiń listName.
- update_item_status: params { status: "NEEDED"|"IN_CART"|"DONE" }, searchQuery: string
  Zmienia status produktu. searchQuery to nazwa produktu do wyszukania.
- delete_item: params {}, searchQuery: string
  Usuwa produkt z listy. searchQuery to nazwa produktu do wyszukania.

ZADANIA (module: "tasks"):
- create_task: params { title: string, description?: string, priority: "NONE"|"LOW"|"MEDIUM"|"HIGH"|"URGENT", dueDate?: string, projectName?: string }
  Tworzy nowe zadanie. dueDate w formacie ISO 8601.
- shift_task_due_date: params { days: number }, searchQuery: string
  Przesuwa termin zadania o N dni (ujemna = wcześniej). searchQuery to tytuł zadania.
- update_task_status: params { status: "TODO"|"IN_PROGRESS"|"DONE" }, searchQuery: string
  Zmienia status zadania. searchQuery to tytuł zadania.

NOTATKI (module: "notes"):
- create_note: params { title: string, content?: string }
  Tworzy nową notatkę.
- append_to_note: params { content: string }, searchQuery: string
  Dopisuje treść do istniejącej notatki. searchQuery to tytuł notatki.

Zasady:
- Jeden tekst może zawierać wiele niezależnych poleceń — zwróć każde jako osobną akcję
- Jeśli akcja wymaga znalezienia istniejącego zasobu (update, delete, shift, append), ustaw searchQuery
- Dla akcji "add_item" w zakupach NIE ustawiaj searchQuery
- Interpretuj polskie skróty i kolokwializmy ("sachol" = lek Sachol, "przesuń o 2 tyg" = days: 14)
- Dzisiejsza data jest podana w kontekście
- Zwróć TYLKO tablicę JSON akcji, bez żadnego dodatkowego tekstu ani markdown

PRIORYTET MODUŁU (ważne!):
- Twórz akcje WYŁĄCZNIE dla modułów wymienionych w "Aktywne moduły" w wiadomości użytkownika
- Gdy użytkownik nie wskazuje wprost modułu (np. mówi "dodaj X" bez kontekstu), zawsze wybierz moduł podstawowy (wymieniony pierwszy na liście "Aktywne moduły")
- Gdy użytkownik wyraźnie wskazuje inny moduł słowem kluczowym ("zadanie", "notatka", "zakupy", "lista zakupów" itp.) — użyj tego modułu, ale TYLKO jeśli jest on na liście aktywnych
- Jeśli wskazany przez użytkownika moduł nie jest aktywny, użyj modułu podstawowego

Przykłady:
Polecenie: "dodaj mleko i chleb do listy Apteka"
→ [{ "id":"a1", "module":"shopping", "type":"add_item", "description":"Dodaj mleko do listy Apteka", "params":{ "rawText":"mleko", "listName":"Apteka" } },
   { "id":"a2", "module":"shopping", "type":"add_item", "description":"Dodaj chleb do listy Apteka", "params":{ "rawText":"chleb", "listName":"Apteka" } }]

Polecenie: "dodaj 2x Sachol"
→ [{ "id":"a1", "module":"shopping", "type":"add_item", "description":"Dodaj Sachol (2 szt) do listy zakupów", "params":{ "rawText":"2x Sachol" } }]

Polecenie: "przesuń mycie uszu psa o 2 tygodnie"
→ [{ "id":"a1", "module":"tasks", "type":"shift_task_due_date", "description":"Przesuń termin 'mycie uszu psa' o 14 dni", "params":{ "days":14 }, "searchQuery":"mycie uszu psa" }]

Zwróć TYLKO tablicę JSON, bez żadnego dodatkowego tekstu ani markdown.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { text?: string; context?: string[]; today?: string; routeHint?: string };
  const { text, context = ["shopping", "tasks", "notes"], today = new Date().toISOString(), routeHint } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  const config = await prisma.config.findUnique({ where: { key: "groq_api_key" } });
  if (!config?.value) {
    return NextResponse.json(
      { error: "LLM nie jest skonfigurowany. Ustaw klucz Groq w Panelu Admina." },
      { status: 503 }
    );
  }

  const primaryModule = context[0] ?? "shopping";
  const additionalModules = context.slice(1);
  const modulesDesc = additionalModules.length > 0
    ? `${primaryModule} (podstawowy), ${additionalModules.join(", ")}`
    : primaryModule;
  const userMsg = [
    `Dzisiejsza data: ${today}`,
    `Aktywne moduły: ${modulesDesc}`,
    routeHint ? `Aktualny widok: ${routeHint}` : null,
    ``,
    `Polecenie użytkownika: ${text.trim()}`,
  ].filter(Boolean).join("\n");

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.value}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!groqRes.ok) {
    const err = await groqRes.text().catch(() => "unknown");
    return NextResponse.json({ error: `Błąd LLM: ${err}` }, { status: 502 });
  }

  const groqData = await groqRes.json() as { choices: Array<{ message: { content: string } }> };
  const content = groqData.choices?.[0]?.message?.content ?? "[]";

  let actions: AIAction[];
  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").replace(/^```\n?/, "");
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("not array");
    actions = parsed.map((a: Partial<AIAction>, i: number) => ({
      id: a.id ?? `a${i + 1}`,
      module: a.module ?? "shopping",
      type: a.type ?? "add_item",
      description: a.description ?? "",
      params: a.params ?? {},
      searchQuery: a.searchQuery,
    }));
  } catch {
    return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format" }, { status: 502 });
  }

  return NextResponse.json({ actions });
}
