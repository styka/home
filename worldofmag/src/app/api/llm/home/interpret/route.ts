import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chatComplete } from "@/lib/llm/chat";
import { auth } from "@/lib/auth";
import { PET_ACTIONS_PROMPT, PET_ACTION_EXAMPLES } from "@/lib/ai/petActions";

export interface AIAction {
  id: string;
  module: "shopping" | "tasks" | "notes" | "pets" | "habits" | "portfel" | "kitchen" | "flota";
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
  projectName ustaw TYLKO gdy użytkownik wyraźnie wskaże projekt ("do projektu X", "w projekcie Y").
  Gdy użytkownik NIE wskazuje projektu, POMIŃ projectName — zadanie trafi do projektu, który użytkownik ma otwarty na widoku (podanego w kontekście jako "Bieżący projekt").
- shift_task_due_date: params { days: number }, searchQuery: string
  Przesuwa termin zadania o N dni (ujemna = wcześniej). searchQuery to tytuł zadania.
- update_task_status: params { status: "TODO"|"IN_PROGRESS"|"DONE" }, searchQuery: string
  Zmienia status zadania. searchQuery to tytuł zadania.

NOTATKI (module: "notes"):
- create_note: params { title: string, content?: string }
  Tworzy nową notatkę.
- append_to_note: params { content: string }, searchQuery: string
  Dopisuje treść do istniejącej notatki. searchQuery to tytuł notatki.

${PET_ACTIONS_PROMPT}

NAWYKI (module: "habits"):
- toggle_habit: params {}, searchQuery: string
  Odhacza nawyk na dzisiaj (lub cofa odhaczenie). searchQuery to nazwa nawyku lub jej fragment.
  Przykład: "odhacz bieganie" → searchQuery: "bieganie"

PORTFEL (module: "portfel"):
- add_expense: params { amount: number, category?: string, note?: string, elementName?: string }
  Dodaje wydatek. amount w PLN (lub innej walucie — wtedy wpisz ją w note). elementName to fragment nazwy konta/elementu portfela (opcjonalne).
  Przykład: "wydałem 45 zł na jedzenie" → params { amount: 45, category: "Jedzenie" }
- add_income: params { amount: number, category?: string, note?: string, elementName?: string }
  Dodaje przychód. Przykład: "dostałem 2000 zł wynagrodzenia" → params { amount: 2000, category: "Wynagrodzenie" }

KUCHNIA (module: "kitchen"):
- plan_meal: params { customTitle: string, date?: string, slot?: "breakfast"|"lunch"|"dinner"|"snack" }
  Planuje posiłek na dany dzień. date w formacie ISO 8601 (pomiń jeśli "dziś"). slot to pora dnia.
  Przykład: "zaplanuj na jutro makaron z kurczakiem na obiad" → params { customTitle: "Makaron z kurczakiem", date: "...", slot: "dinner" }

FLOTA (module: "flota"):
- add_fuel_log: params { liters: number, totalCost?: number, odometer?: number, vehicleName?: string, note?: string }
  Dodaje zatankowanie. liters wymagane; totalCost i odometer opcjonalne. vehicleName to fragment nazwy/modelu pojazdu.
  Przykład: "zatankowałem 40 litrów za 260 zł" → params { liters: 40, totalCost: 260 }

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

${PET_ACTION_EXAMPLES}

Zwróć TYLKO tablicę JSON, bez żadnego dodatkowego tekstu ani markdown.`;

/**
 * Parsuje tablicę akcji zwróconą przez LLM, tolerując urwanie w połowie (gdy
 * odpowiedź dobiła do limitu tokenów). Najpierw normalna próba; jeśli się nie
 * uda, przycinamy do ostatniego kompletnego obiektu `}` i domykamy `]`, dzięki
 * czemu wsadowe polecenie zwraca tyle akcji, ile zdążyło się zmieścić, zamiast
 * całkiem padać błędem 502.
 */
function parseActionArray(cleaned: string): unknown {
  try {
    return JSON.parse(cleaned);
  } catch {
    const lastClose = cleaned.lastIndexOf("}");
    if (!cleaned.trimStart().startsWith("[") || lastClose === -1) throw new Error("unrecoverable");
    return JSON.parse(cleaned.slice(0, lastClose + 1) + "]");
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { text?: string; context?: string[]; today?: string; routeHint?: string; currentProjectId?: string };
  const { text, context = ["shopping", "tasks", "notes", "pets"], today = new Date().toISOString(), routeHint, currentProjectId } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: "Empty text" }, { status: 400 });
  }

  // Nazwa bieżącego projektu zadań (jeśli użytkownik jest na jego widoku) — by LLM
  // wiedział, że to domyślny cel nowych zadań i mógł rozróżnić, gdy użytkownik wskaże inny.
  let currentProjectName: string | null = null;
  if (currentProjectId) {
    const project = await prisma.taskProject.findFirst({
      where: {
        id: currentProjectId,
        OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
      },
      select: { name: true },
    });
    currentProjectName = project?.name ?? null;
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
    currentProjectName ? `Bieżący projekt: "${currentProjectName}" (domyślny cel nowych zadań, jeśli użytkownik nie wskaże innego)` : null,
    ``,
    `Polecenie użytkownika: ${text.trim()}`,
  ].filter(Boolean).join("\n");

  // Budżet tokenów odpowiedzi skalujemy do rozmiaru wejścia. Sztywne 1024 obcinało
  // wsadowe polecenia (np. wklejony JSON z wieloma zadaniami) do ~7 akcji — model
  // domykał tablicę, bo brakło miejsca na resztę. Każda akcja to ~150–250 tokenów,
  // więc dajemy z grubsza tyle tokenów ile znaków wejścia, w widełkach 1024–8192.
  const maxTokens = Math.min(8192, Math.max(1024, Math.ceil(text.trim().length / 2)));

  const result = await chatComplete({
    op: "reasoning",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.1,
    maxTokens,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  const content = result.content || "[]";

  let actions: AIAction[];
  try {
    const cleaned = content.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").replace(/^```\n?/, "");
    const parsed = parseActionArray(cleaned);
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
