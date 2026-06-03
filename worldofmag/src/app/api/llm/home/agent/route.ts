import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PET_ACTIONS_PROMPT, PET_ACTION_EXAMPLES } from "@/lib/ai/petActions";
import { READ_TOOLS_PROMPT, READ_TOOL_NAMES, runReadTool } from "@/lib/ai/agentTools";
import { webSearch } from "@/lib/news/webSearch";
import { chatComplete } from "@/lib/llm/chat";
import type { AIAction } from "@/app/api/llm/home/interpret/route";

const MAX_ITERATIONS = 6;
const MAX_TOOLS_PER_TURN = 4;

// Ile wcześniejszych tur rozmowy (poziom wyświetlania) wstrzykujemy do kontekstu.
const MAX_HISTORY_MESSAGES = 12;

const MODULES = [
  "shopping",
  "tasks",
  "notes",
  "pets",
  "habits",
  "portfel",
  "kitchen",
  "flota",
  "magazynowanie",
  "health",
  "languages",
  "news",
  "weather",
  "reports",
] as const;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LogEntry {
  iter: number;
  step: string;
  thought: string;
  tools?: { tool: string; args: Record<string, unknown> }[];
  results?: unknown;
  question?: string;
  options?: string[];
  actionsCount?: number;
}

const ACTION_CATALOG = `Dostępne akcje ZAPISU (step "plan"). Każda akcja: { id, module, type, description, params, searchQuery? }.
Po wykonaniu zapytań CELUJ w konkretne rekordy przez id z wyników (taskId/itemId/noteId/listId). searchQuery to fallback po nazwie, gdy nie masz id.

ZAKUPY (module "shopping"):
- add_item { rawText, listName?, listId? } — rawText to TYLKO nazwa i ilość ("2 kg jabłek"), bez nazwy listy.
- update_item_status { status:"NEEDED"|"IN_CART"|"DONE", itemId? } (searchQuery jako fallback)
- update_item { name?, quantity?, unit?, itemId? }
- delete_item { itemId? } (searchQuery fallback) — DESTRUKCYJNE
- create_list { name }
- rename_list { name, listId? } (searchQuery = obecna nazwa)
- archive_list { listId? } (searchQuery fallback) — DESTRUKCYJNE

ZADANIA (module "tasks"):
- create_task { title, description?, priority:"NONE"|"LOW"|"MEDIUM"|"HIGH"|"URGENT", dueDate?(ISO), projectName? }
- update_task { taskId?, title?, description?, priority?, status?, dueDate? } (searchQuery fallback)
- update_task_status { status:"TODO"|"IN_PROGRESS"|"DONE"|"CANCELLED"|"DEFERRED", taskId? } (searchQuery fallback)
- shift_task_due_date { days:number, taskId? } (searchQuery fallback; ujemne = wcześniej)
- delete_task { taskId? } (searchQuery fallback) — DESTRUKCYJNE
- create_project { name, emoji? }

NOTATKI (module "notes"):
- create_note { title, content? }
- append_to_note { content, noteId? } (searchQuery fallback)
- update_note { title?, content?, noteId? } (searchQuery fallback)
- delete_note { noteId? } (searchQuery fallback) — DESTRUKCYJNE

NAWYKI (module "habits"):
- toggle_habit {} (searchQuery = nazwa nawyku lub jej fragment) — odhacza nawyk na dziś lub cofa odhaczenie.

PORTFEL (module "portfel"):
- add_expense { amount:number, category?, note?, elementName? } — wydatek (kwota w PLN). elementName = fragment nazwy konta/elementu portfela.
- add_income { amount:number, category?, note?, elementName? } — przychód (kwota w PLN).

KUCHNIA (module "kitchen"):
- plan_meal { customTitle, date?(ISO; pomiń jeśli „dziś"), slot?:"breakfast"|"lunch"|"dinner"|"snack" } — planuje posiłek w jadłospisie.

FLOTA (module "flota"):
- add_fuel_log { liters:number, totalCost?, odometer?, vehicleName?, note? } — zapis tankowania. vehicleName = fragment nazwy/modelu pojazdu.

MAGAZYN (module "magazynowanie"):
- add_storage_item { name, quantity?, unit?, warehouse?, location?, category? } — nowa pozycja magazynu (warehouse = magazyn nadrzędny, location = dokładne miejsce).
- adjust_storage { delta:number } (searchQuery = nazwa pozycji) — przyjęcie (+) lub wydanie (−) ze stanu.

NAWYKI (module "habits"):
- create_habit { name, description?, icon? } — tworzy nowy nawyk.

KUCHNIA (module "kitchen"):
- add_pantry_item { name, quantity?, unit?, expiresAt?(ISO) } — dodaje produkt do spiżarni.

PORTFEL (module "portfel"):
- create_wallet_element { name, kind?, initialBalance? } — tworzy konto/element portfela.

FLOTA (module "flota"):
- add_service_record { vehicleName?, serviceType?, cost?, odometer?, note? } — wpis serwisowy pojazdu.

ZDROWIE (module "health"):
- create_health_event { title, kind:"VISIT"|"TEST", scheduledAt(ISO), doctorName?, specialty?, facility?, notes? } — wizyta lub badanie.
- update_health_event { eventId?, title?, scheduledAt?, status?, notes? } (searchQuery = tytuł)
- set_health_status { status:"PLANNED"|"DONE"|"CANCELLED", eventId? } (searchQuery fallback)
- delete_health_event { eventId? } (searchQuery fallback) — DESTRUKCYJNE

JĘZYKI (module "languages"):
- create_deck { name, nativeLang?, targetLang? } — nowa talia fiszek.
- add_word { term, translation, example?, deckName? } — dodaje fiszkę (deckName = fragment nazwy talii; pominięty = ostatnia talia).
- delete_word { wordId } — DESTRUKCYJNE

WIADOMOŚCI (module "news"):
- create_news_topic { title, semanticFilter? } — nowy monitorowany temat.
- delete_news_topic { topicId? } (searchQuery = tytuł) — DESTRUKCYJNE

POGODA (module "weather"):
- add_weather_location { name } — dodaje lokalizację pogodową po nazwie miejscowości.
- delete_weather_location { locationId? } (searchQuery = nazwa) — DESTRUKCYJNE

RAPORTY (module "reports"):
- save_report { title, content } — zapisuje raport (markdown) do działu Raporty użytkownika. Używaj, gdy użytkownik prosi „zapisz to jako raport". Dla pełnego raportu z sesji preferuj jednak krok "report" (niżej), który pozwala użytkownikowi obejrzeć szkic przed zapisem.

PRZEJŚCIE PO UTWORZENIU: do KAŻDEJ akcji tworzącej (create_task, create_note, create_list, create_project, add_item) możesz dodać params.openAfter:true, gdy użytkownik prosi, by od razu przejść/otworzyć utworzony element ("dodaj zadanie X i przejdź do niego"). Po wykonaniu aplikacja zaproponuje przekierowanie.`;

const NAVIGATION_CATALOG = `NAWIGACJA (step "navigate") — przekieruj użytkownika na GOTOWY widok aplikacji, gdy prośba sprowadza się do „pokaż / otwórz / przejdź do …", a istnieje strona z odpowiednimi parametrami. To NIE wykona się od razu — użytkownik potwierdzi przekierowanie.
{ "step":"navigate", "thought":"...", "url":"/tasks/all?status=IN_PROGRESS", "label":"Zadania w trakcie" }

Dozwolone adresy (zawsze zaczynają się od "/"):
- /tasks/today | /tasks/upcoming | /tasks/overdue | /tasks/all — widoki zadań. Opcjonalny ?status=TODO|IN_PROGRESS|DONE|DEFERRED|CANCELLED filtruje po statusie.
- /tasks/<projectId> — konkretny projekt (id z list_projects). Opcjonalnie ?status=… oraz ?task=<taskId> (otwiera szczegóły zadania).
- /tasks — strona główna działu Zadania.
- /shopping — lista list zakupów; /shopping/<listId> — konkretna lista (id z list_shopping_lists).
- /notes — notatki; ?pinned=1 = tylko przypięte; ?focus=<noteId> = podświetl notatkę.
- /pets — zwierzęta.

KIEDY "navigate" vs "answer":
- Prośba „pokaż/otwórz/wyświetl listę X", którą da się odwzorować gotowym widokiem (np. „pokaż zadania w trakcie" → /tasks/all?status=IN_PROGRESS) → użyj "navigate".
- Pytanie analityczne lub filtrowanie, którego strona NIE obsługuje (np. „zadania URGENT bez terminu z projektu X") → pobierz dane przez "query" i odpowiedz przez "answer" (markdown).
- Jeśli potrzebujesz id (projektu/listy/notatki), najpierw "query", potem "navigate".`;

function buildSystemPrompt(): string {
  return `Jesteś asystentem WorldOfMag — pracujesz NA DANYCH użytkownika tymi samymi regułami dostępu co aplikacja.
Twoim zadaniem jest zrozumieć polecenie/pytanie, w razie potrzeby pobrać dane, a następnie ALBO odpowiedzieć, ALBO zaproponować akcje do potwierdzenia przez użytkownika.

PROTOKÓŁ — w KAŻDEJ turze zwróć DOKŁADNIE JEDEN obiekt JSON (bez markdown, bez komentarzy) z polem "thought" (jedno krótkie zdanie po polsku, do logu) i polem "step":

1) Pobranie danych (gdy potrzebujesz informacji):
{ "step":"query", "thought":"...", "tools":[ { "tool":"list_tasks", "args":{ "status":"TODO" } } ] }

2) Pytanie doprecyzowujące (gdy polecenie jest zbyt niejasne — ZANIM zaproponujesz akcje):
{ "step":"clarify", "thought":"...", "question":"Którą listę masz na myśli?", "options":["Apteka","Tygodniowe"] }  // options opcjonalne

3) Odpowiedź tekstowa (gdy użytkownik o coś PYTA — NIE twórz akcji):
{ "step":"answer", "thought":"...", "answer":"Najważniejsze teraz: **Zapłać ZUS** (URGENT, termin dziś)." }  // markdown PL

4) Plan akcji (gdy użytkownik chce coś ZMIENIĆ/DODAĆ — akcje NIE wykonają się od razu, użytkownik je potwierdzi):
{ "step":"plan", "thought":"...", "actions":[ { "id":"a1", "module":"tasks", "type":"update_task_status", "description":"...", "params":{ "taskId":"...", "status":"DONE" } } ] }

5) Przekierowanie (gdy użytkownik chce ZOBACZYĆ/OTWORZYĆ gotowy widok — użytkownik potwierdzi przejście):
{ "step":"navigate", "thought":"...", "url":"/tasks/all?status=IN_PROGRESS", "label":"Zadania w trakcie" }

6) Raport (gdy użytkownik prosi o RAPORT/podsumowanie sesji lub obszerne zestawienie — zwróć pełny markdown; użytkownik obejrzy szkic i zdecyduje, czy zapisać):
{ "step":"report", "thought":"...", "title":"Tytuł raportu", "content":"# Tytuł\\n\\n## Podsumowanie\\n...\\n\\n## Fakty i dane\\n| ... |\\n\\n## Wnioski\\n..." }
Raport „z naszej sesji bez pomijania faktów, z podsumowaniem": uwzględnij WSZYSTKIE konkretne dane omówione w rozmowie (liczby, nazwy, terminy — w tabelach), sekcję ## Podsumowanie oraz linki markdown do elementów ([tytuł](/tasks/<id>)). Nie pomijaj faktów.

${READ_TOOLS_PROMPT}

${ACTION_CATALOG}

${NAVIGATION_CATALOG}

${PET_ACTIONS_PROMPT}

ZASADY:
- Najpierw "query" po dane, dopiero potem "answer" lub "plan" z konkretnymi id.
- Akcje ZBIORCZE (np. "oznacz wszystkie zadania o remoncie jako zrobione"): pobierz zadania przez query, SAM zdecyduj które pasują na podstawie tytułów/treści, a potem zwróć WIELE akcji — każda z własnym id. Nie ma akcji masowej; symulujesz ją pętlą pojedynczych akcji.
- Dla PYTAŃ używaj "answer", nie twórz akcji. Dla POLECEŃ zmiany danych używaj "plan". Dla próśb „pokaż/otwórz/przejdź do …" z gotowym widokiem używaj "navigate".
- Gdy czegoś brakuje lub jest niejednoznaczne — użyj "clarify" zanim zaproponujesz akcje.
- INTERNET: gdy odpowiedź wymaga informacji spoza danych użytkownika (ceny, fakty, definicje, wydarzenia, rzeczy ze świata), użyj "query" z narzędziem web_search, a w odpowiedzi CYTUJ źródła linkami markdown. Najpierw sprawdź dane użytkownika, dopiero potem sięgaj do internetu.
- RAPORT: gdy użytkownik prosi o raport/podsumowanie sesji lub obszerne zestawienie ("zrób raport", "podsumuj naszą rozmowę bez pomijania faktów") — użyj kroku "report" z pełnym markdownem (nie pomijaj konkretnych danych z rozmowy).
- Korzystaj z kontekstu (aktualny widok / aktywna lista / bieżący projekt) podanego w wiadomości użytkownika, gdy polecenie nie wskazuje wprost celu. Wcześniejsze tury rozmowy bywają dołączone jako kontekst — wykorzystuj je dla ciągłości.
- WYBÓR MODUŁU: gdy polecenie nie wskazuje wprost modułu, użyj modułu PODSTAWOWEGO (pierwszego na liście „Aktywne moduły"). Gdy użytkownik użyje słowa-klucza innego aktywnego modułu (np. „wydatek/przychód" → portfel, „zatankowałem" → flota, „nawyk/odhacz" → habits, „magazyn/wydaj ze stanu" → magazynowanie, „zaplanuj posiłek" → kitchen) — użyj tamtego modułu, o ile jest aktywny.
- Twórz akcje tylko dla modułów: ${MODULES.join(", ")}.
- Zawsze zwracaj wyłącznie poprawny JSON wg schematu, bez żadnego dodatkowego tekstu.

${PET_ACTION_EXAMPLES}`;
}

// Adresy nawigacji pochodzą od LLM, więc traktujemy je jak nieufne wejście: tylko
// wewnętrzne ścieżki aplikacji z whitelisty prefiksów (bez protokołu, bez "//").
const NAV_ALLOWED_PREFIXES = [
  "/tasks",
  "/shopping",
  "/notes",
  "/pets",
  "/habits",
  "/portfel",
  "/kitchen",
  "/flota",
  "/magazynowanie",
  "/health",
  "/languages",
  "/wiadomosci",
  "/pogoda",
  "/reports",
];

function sanitizeNavUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  if (!url.startsWith("/") || url.startsWith("//")) return null;
  let pathname: string;
  try {
    pathname = new URL(url, "http://internal").pathname;
  } catch {
    return null;
  }
  const ok = NAV_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return ok ? url : null;
}

function extractJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```json\n?/i, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

async function callAgent(messages: ChatMessage[]): Promise<string> {
  const result = await chatComplete({
    op: "reasoning",
    messages,
    temperature: 0.1,
    maxTokens: 2800, // zapas na pełny raport (step "report") — przy 1500 markdown bywał ucinany w połowie JSON
    json: true,
  });
  if (!result.ok) {
    const err = new Error(result.message) as Error & { status?: number };
    err.status = result.status;
    throw err;
  }
  return result.content || "{}";
}

function normalizeActions(raw: unknown): AIAction[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: Partial<AIAction>, i: number): AIAction | null => {
      const module = a.module && (MODULES as readonly string[]).includes(a.module) ? a.module : "shopping";
      if (!a.type) return null;
      return {
        id: a.id ?? `a${i + 1}`,
        module: module as AIAction["module"],
        type: a.type,
        description: a.description ?? "",
        params: (a.params as Record<string, unknown>) ?? {},
        searchQuery: a.searchQuery,
      };
    })
    .filter((a): a is AIAction => a !== null);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    context?: string[];
    today?: string;
    routeHint?: string;
    currentProjectId?: string;
    activeListId?: string;
    messages?: ChatMessage[]; // transkrypt dialogu (bez system) do wznowienia
    clarifyAnswer?: string;
    refine?: string; // uwagi użytkownika do zaproponowanego planu — przeplanuj
    history?: ChatMessage[]; // wcześniejsze tury rozmowy (poziom wyświetlania) do kontekstu wielo-turowego
  };

  // Zbuduj konwersację. System prompt zawsze budujemy po stronie serwera (nie ufamy klientowi).
  const messages: ChatMessage[] = [{ role: "system", content: buildSystemPrompt() }];

  // Higiena kontekstu: wstrzykujemy tylko ostatnie N wiadomości historii (user/assistant),
  // żeby długie rozmowy nie rozsadziły okna tokenów modelu.
  function pushTrimmedHistory() {
    const hist = (body.history ?? []).filter(
      (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()
    );
    const recent = hist.slice(-MAX_HISTORY_MESSAGES);
    if (recent.length) {
      messages.push({
        role: "user",
        content:
          "Kontekst wcześniejszej rozmowy (dla ciągłości — NIE odpowiadaj na to ponownie):\n" +
          recent.map((m) => `${m.role === "user" ? "Użytkownik" : "Asystent"}: ${m.content}`).join("\n"),
      });
    }
  }

  if (body.messages?.length) {
    // Wznowienie po doprecyzowaniu: dołącz dialog klienta (pomijając ewentualny system) + odpowiedź użytkownika.
    for (const m of body.messages) {
      if (m.role !== "system" && typeof m.content === "string") {
        messages.push({ role: m.role, content: m.content });
      }
    }
    if (body.clarifyAnswer?.trim()) {
      messages.push({ role: "user", content: `Odpowiedź na pytanie doprecyzowujące: ${body.clarifyAnswer.trim()}` });
    }
    if (body.refine?.trim()) {
      messages.push({
        role: "user",
        content:
          `Użytkownik chce SKORYGOWAĆ zaproponowany plan akcji. Uwagi: ${body.refine.trim()}\n` +
          `Zwróć poprawiony PEŁNY plan (step "plan") uwzględniający te uwagi — całą zaktualizowaną listę akcji, nie tylko zmienioną pozycję. ` +
          `Jeśli uwagi są niejednoznaczne lub czegoś brakuje, użyj "clarify" zamiast zgadywać.`,
      });
    }
  } else {
    const text = body.text?.trim();
    if (!text) return NextResponse.json({ error: "Empty text" }, { status: 400 });

    pushTrimmedHistory();

    const today = body.today ?? new Date().toISOString();
    const context = body.context?.length ? body.context : [...MODULES];

    // Nazwa bieżącego projektu (jeśli użytkownik jest na jego widoku)
    let currentProjectName: string | null = null;
    if (body.currentProjectId) {
      const project = await prisma.taskProject.findFirst({
        where: {
          id: body.currentProjectId,
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: { name: true },
      });
      currentProjectName = project?.name ?? null;
    }

    const userMsg = [
      `Dzisiejsza data: ${today}`,
      `Aktywne moduły: ${context.join(", ")}`,
      body.routeHint ? `Aktualny widok: ${body.routeHint}` : null,
      body.activeListId ? `Aktywna lista zakupów (id): ${body.activeListId}` : null,
      currentProjectName ? `Bieżący projekt zadań: "${currentProjectName}" (id: ${body.currentProjectId})` : null,
      ``,
      `Polecenie użytkownika: ${text}`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    messages.push({ role: "user", content: userMsg });
  }

  const log: LogEntry[] = [];

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    // Jedna tura LLM z jednokrotnym ponowieniem przy błędzie parsowania JSON.
    let parsed: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
      let content: string;
      try {
        content = await callAgent(messages);
      } catch (e) {
        const status = (e as { status?: number }).status ?? 502;
        return NextResponse.json({ error: e instanceof Error ? e.message : "Błąd LLM" }, { status });
      }
      messages.push({ role: "assistant", content });
      try {
        const j = extractJson(content);
        if (j && typeof j === "object" && !Array.isArray(j)) parsed = j as Record<string, unknown>;
        else throw new Error("not an object");
      } catch {
        messages.push({ role: "user", content: "Zwróć wyłącznie poprawny JSON wg schematu (jeden obiekt z polem step)." });
      }
    }

    if (!parsed) {
      return NextResponse.json({ error: "LLM zwrócił nieprawidłowy format", log }, { status: 502 });
    }

    const step = String(parsed.step ?? "");
    const thought = typeof parsed.thought === "string" ? parsed.thought : "";

    if (step === "query") {
      const rawTools = Array.isArray(parsed.tools) ? parsed.tools.slice(0, MAX_TOOLS_PER_TURN) : [];
      const toolCalls = rawTools
        .map((t) => t as { tool?: string; args?: Record<string, unknown> })
        .filter((t) => t.tool && ((READ_TOOL_NAMES as readonly string[]).includes(t.tool) || t.tool === "web_search"));

      const results: { tool: string; args: Record<string, unknown>; data: unknown; error?: string }[] = [];
      for (const call of toolCalls) {
        try {
          // web_search działa poza zakresem własności użytkownika (dane publiczne z internetu).
          if (call.tool === "web_search") {
            const query = typeof call.args?.query === "string" ? call.args.query : "";
            const limit = typeof call.args?.limit === "number" ? Math.min(8, Math.max(1, call.args.limit)) : 5;
            const data = query.trim() ? await webSearch(query, limit) : [];
            results.push({ tool: call.tool, args: call.args ?? {}, data });
          } else {
            const data = await runReadTool(call.tool!, call.args ?? {}, userId);
            results.push({ tool: call.tool!, args: call.args ?? {}, data });
          }
        } catch (e) {
          results.push({ tool: call.tool!, args: call.args ?? {}, data: null, error: e instanceof Error ? e.message : "błąd" });
        }
      }

      log.push({
        iter,
        step,
        thought,
        tools: toolCalls.map((t) => ({ tool: t.tool!, args: t.args ?? {} })),
        results,
      });

      // Dołącz wyniki narzędzi do transkryptu i kontynuuj pętlę
      messages.push({
        role: "user",
        content: `Wyniki narzędzi (JSON):\n${JSON.stringify(results)}`,
      });
      continue;
    }

    if (step === "clarify") {
      const question = typeof parsed.question === "string" ? parsed.question : "Doprecyzuj proszę polecenie.";
      const options = Array.isArray(parsed.options) ? parsed.options.map(String).slice(0, 6) : undefined;
      log.push({ iter, step, thought, question, options });
      // Zwróć dialog (bez system) do wznowienia po stronie klienta
      const dialog = messages.filter((m) => m.role !== "system");
      return NextResponse.json({ step: "clarify", question, options, thought, log, messages: dialog });
    }

    if (step === "answer") {
      const answer = typeof parsed.answer === "string" ? parsed.answer : "Brak odpowiedzi.";
      log.push({ iter, step, thought });
      return NextResponse.json({ step: "answer", answer, thought, log });
    }

    if (step === "report") {
      const title =
        typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Raport z asystenta";
      const content = typeof parsed.content === "string" ? parsed.content : "";
      if (!content.trim()) {
        messages.push({ role: "user", content: "Pusty raport. Zwróć pełny markdown w polu content." });
        continue;
      }
      log.push({ iter, step, thought });
      return NextResponse.json({ step: "report", title, content, thought, log });
    }

    if (step === "navigate") {
      const url = sanitizeNavUrl(parsed.url);
      if (!url) {
        messages.push({
          role: "user",
          content:
            "Nieprawidłowy lub niedozwolony adres. Podaj wewnętrzną ścieżkę aplikacji zaczynającą się od / (np. /tasks/all?status=IN_PROGRESS), albo użyj answer.",
        });
        continue;
      }
      const label =
        typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "Otwórz widok";
      log.push({ iter, step, thought });
      return NextResponse.json({ step: "navigate", url, label, thought, log });
    }

    if (step === "plan") {
      const actions = normalizeActions(parsed.actions);
      if (actions.length === 0) {
        log.push({ iter, step: "answer", thought });
        return NextResponse.json({
          step: "answer",
          answer: thought || "Nie wykryto żadnych akcji do wykonania.",
          log,
        });
      }
      log.push({ iter, step, thought, actionsCount: actions.length });
      // Dialog (bez system) wraca do klienta, by mógł poprosić o korektę planu („popraw przez AI").
      const dialog = messages.filter((m) => m.role !== "system");
      return NextResponse.json({ step: "plan", actions, thought, log, messages: dialog });
    }

    // Nieznany step — poproś o poprawny format i próbuj dalej
    messages.push({ role: "user", content: "Nieznany step. Użyj jednego z: query, clarify, answer, navigate, plan." });
  }

  // Wyczerpano limit iteracji bez stanu terminalnego
  return NextResponse.json({
    step: "answer",
    answer: "Nie udało się dokończyć w limicie kroków. Spróbuj sformułować polecenie prościej lub bardziej konkretnie.",
    log,
  });
}
