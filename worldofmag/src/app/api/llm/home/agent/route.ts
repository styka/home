import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PET_ACTIONS_PROMPT, PET_ACTION_EXAMPLES } from "@/lib/ai/petActions";
import { READ_TOOLS_PROMPT, READ_TOOL_NAMES, runReadTool } from "@/lib/ai/agentTools";
import { webSearch } from "@/lib/news/webSearch";
import { chatComplete } from "@/lib/llm/chat";
import type { AIAction } from "@/lib/ai/aiAction";

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

const ACTION_CATALOG_HEADER = `Dostępne akcje ZAPISU (step "plan"). Każda akcja: { id, module, type, description, params, searchQuery? }.
Po wykonaniu zapytań możesz CELOWAĆ w konkretny rekord przez jego id z wyników (taskId/itemId/noteId/listId) — to precyzyjny, opcjonalny namiar dla backendu.
WAŻNE (czytelność dla użytkownika): id NIE jest pokazywane w panelu potwierdzenia, bo nic mu nie mówi. Dlatego dla KAŻDEJ akcji celującej w istniejący rekord ZAWSZE wypełnij też "searchQuery" czytelną nazwą/tytułem tego rekordu (np. tytuł zadania, nazwa listy, imię zwierzęcia) — to ją zobaczy użytkownik. Dodatkowo "description" musi po ludzku nazywać cel akcji.`;

const ACTION_CATALOG_FOOTER = `PRZEJŚCIE PO UTWORZENIU: do KAŻDEJ akcji tworzącej (create_task, create_note, create_list, create_project, add_item) możesz dodać params.openAfter:true, gdy użytkownik prosi, by od razu przejść/otworzyć utworzony element ("dodaj zadanie X i przejdź do niego"). Po wykonaniu aplikacja zaproponuje przekierowanie.`;

// Katalog akcji ROZBITY na moduły — do system promptu wstrzykujemy tylko sekcje
// modułów istotnych dla bieżącego polecenia (router niżej), co tnie tokeny i
// rozprasza model mniej. Pełny katalog (fallback + guard) = wszystkie sekcje.
const ACTION_CATALOG_BY_MODULE: Record<string, string> = {
  shopping: `ZAKUPY (module "shopping"):
- add_item { rawText, listName?, listId? } — rawText to TYLKO nazwa i ilość ("2 kg jabłek"), bez nazwy listy.
- update_item_status { status:"NEEDED"|"IN_CART"|"DONE", itemId? } (searchQuery jako fallback)
- update_item { name?, quantity?, unit?, itemId? }
- delete_item { itemId? } (searchQuery fallback) — DESTRUKCYJNE
- create_list { name }
- rename_list { name, listId? } (searchQuery = obecna nazwa)
- archive_list { listId? } (searchQuery fallback) — DESTRUKCYJNE
- delete_list { listId? } (searchQuery = nazwa) — DESTRUKCYJNE
- clear_done_items {} (searchQuery/listName = lista) — usuwa kupione pozycje.
- mark_all_in_cart {} (searchQuery/listName = lista) — oznacza wszystkie jako w koszyku.`,

  tasks: `ZADANIA (module "tasks"):
- create_task { title, description?, priority:"NONE"|"LOW"|"MEDIUM"|"HIGH"|"URGENT", dueDate?(ISO), projectName? }
- update_task { taskId?, title?, description?, priority?, status?, dueDate? } (searchQuery fallback)
- update_task_status { status:"TODO"|"IN_PROGRESS"|"DONE"|"CANCELLED"|"DEFERRED", taskId? } (searchQuery fallback)
- shift_task_due_date { days:number, taskId? } (searchQuery fallback; ujemne = wcześniej)
- delete_task { taskId? } (searchQuery fallback) — DESTRUKCYJNE
- create_project { name, emoji? }
- update_project { name?, emoji?, projectId? } (searchQuery = nazwa projektu)
- delete_project { projectId? } (searchQuery = nazwa) — DESTRUKCYJNE`,

  notes: `NOTATKI (module "notes"):
- create_note { title, content? }
- append_to_note { content, noteId? } (searchQuery fallback)
- update_note { title?, content?, noteId? } (searchQuery fallback)
- delete_note { noteId? } (searchQuery fallback) — DESTRUKCYJNE
- toggle_pin { noteId? } (searchQuery = tytuł) — przypnij/odepnij notatkę.`,

  habits: `NAWYKI (module "habits"):
- toggle_habit {} (searchQuery = nazwa nawyku lub jej fragment) — odhacza nawyk na dziś lub cofa odhaczenie.
- create_habit { name, description?, icon? } — tworzy nowy nawyk.
- update_habit { name?, icon?, description? } (searchQuery = nazwa)
- archive_habit { archived } (searchQuery = nazwa)
- delete_habit {} (searchQuery = nazwa) — DESTRUKCYJNE`,

  portfel: `PORTFEL (module "portfel"):
- add_expense { amount:number, category?, note?, elementName? } — wydatek (kwota w PLN). elementName = fragment nazwy konta/elementu portfela.
- add_income { amount:number, category?, note?, elementName? } — przychód (kwota w PLN).
- create_wallet_element { name, kind?, initialBalance? } — tworzy konto/element portfela.
- update_wallet_element { name?, note?, elementName? }
- set_wallet_balance { amount, elementName? }
- archive_wallet_element { archived } (elementName?)
- delete_wallet_element {} (elementName? / searchQuery = nazwa) — DESTRUKCYJNE`,

  kitchen: `KUCHNIA (module "kitchen"):
- plan_meal { customTitle, date?(ISO; pomiń jeśli „dziś"), slot?:"breakfast"|"lunch"|"dinner"|"snack" } — planuje posiłek w jadłospisie.
- add_pantry_item { name, quantity?, unit?, expiresAt?(ISO) } — dodaje produkt do spiżarni.
- create_recipe { title, description?, servings?, body? }
- delete_recipe {} (searchQuery = tytuł) — DESTRUKCYJNE
- mark_meal_cooked {} (searchQuery = tytuł posiłku)
- delete_meal_plan {} (searchQuery = tytuł posiłku)
- update_pantry_item { quantity?, unit?, expiresAt? } (searchQuery = nazwa)
- consume_pantry { quantity } (searchQuery = nazwa)
- delete_pantry_item {} (searchQuery = nazwa) — DESTRUKCYJNE`,

  flota: `FLOTA (module "flota"):
- add_fuel_log { liters:number, totalCost?, odometer?, vehicleName?, note? } — zapis tankowania. vehicleName = fragment nazwy/modelu pojazdu.
- add_service_record { vehicleName?, serviceType?, cost?, odometer?, note? } — wpis serwisowy pojazdu.
- create_vehicle { name, make?, model?, plate?, year? }
- update_vehicle { name?, plate?, odometer? } (searchQuery = nazwa)
- delete_vehicle {} (searchQuery = nazwa) — DESTRUKCYJNE`,

  magazynowanie: `MAGAZYN (module "magazynowanie"):
- add_storage_item { name, quantity?, unit?, warehouse?, location?, category? } — nowa pozycja magazynu (warehouse = magazyn nadrzędny, location = dokładne miejsce).
- adjust_storage { delta:number } (searchQuery = nazwa pozycji) — przyjęcie (+) lub wydanie (−) ze stanu.
- update_storage_item { name?, unit?, warehouse?, location? } (searchQuery = nazwa)
- delete_storage_item {} (searchQuery = nazwa) — DESTRUKCYJNE
- transfer_storage { toWarehouse?, toLocation?, quantity } (searchQuery = nazwa)`,

  health: `ZDROWIE (module "health"):
- create_health_event { title, kind:"VISIT"|"TEST", scheduledAt(ISO), doctorName?, specialty?, facility?, notes? } — wizyta lub badanie.
- update_health_event { eventId?, title?, scheduledAt?, status?, notes? } (searchQuery = tytuł)
- set_health_status { status:"PLANNED"|"DONE"|"CANCELLED", eventId? } (searchQuery fallback)
- delete_health_event { eventId? } (searchQuery fallback) — DESTRUKCYJNE`,

  languages: `JĘZYKI (module "languages"):
- create_deck { name, nativeLang?, targetLang? } — nowa talia fiszek.
- add_word { term, translation, example?, deckName? } — dodaje fiszkę (deckName = fragment nazwy talii; pominięty = ostatnia talia).
- delete_word { wordId } — DESTRUKCYJNE
- update_deck { name?, nativeLang?, targetLang?, deckName? }
- delete_deck {} (searchQuery = nazwa) — DESTRUKCYJNE
- update_word { term?, translation?, example?, wordId? }`,

  news: `WIADOMOŚCI (module "news"):
- create_news_topic { title, semanticFilter? } — nowy monitorowany temat.
- delete_news_topic { topicId? } (searchQuery = tytuł) — DESTRUKCYJNE
- update_news_topic { title?, semanticFilter?, topicId? } (searchQuery = tytuł)
- refresh_news_topic { topicId? } (searchQuery = tytuł)`,

  weather: `POGODA (module "weather"):
- add_weather_location { name } — dodaje lokalizację pogodową po nazwie miejscowości.
- delete_weather_location { locationId? } (searchQuery = nazwa) — DESTRUKCYJNE
- set_default_weather_location { locationId? } (searchQuery = nazwa)
- add_weather_watcher { presetKey }
- delete_weather_watcher { watcherId? } — DESTRUKCYJNE`,

  reports: `RAPORTY (module "reports"):
- save_report { title, content } — zapisuje raport (markdown) do działu Raporty użytkownika. Używaj, gdy użytkownik prosi „zapisz to jako raport". Dla pełnego raportu z sesji preferuj jednak krok "report" (niżej), który pozwala użytkownikowi obejrzeć szkic przed zapisem.`,

  pets: `ZWIERZĘTA (module "pets") — dodatkowe (główne akcje w sekcji ZWIERZĘTA poniżej):
- update_pet { name?, breed? } (searchQuery = imię)
- set_pet_status { status:"ACTIVE"|"SOLD"|"DECEASED"|"ARCHIVED" } (searchQuery = imię)
- delete_pet {} (searchQuery = imię) — DESTRUKCYJNE`,
};

// Składa katalog dla wybranych modułów (header + sekcje + footer).
function buildActionCatalog(modules: string[]): string {
  const sections = modules.map((m) => ACTION_CATALOG_BY_MODULE[m]).filter(Boolean);
  return [ACTION_CATALOG_HEADER, ...sections, ACTION_CATALOG_FOOTER].join("\n\n");
}

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

function buildSystemPrompt(modules: string[]): string {
  // Wstrzykujemy katalog akcji tylko dla wybranych modułów (router). Sekcję
  // „głównych" akcji ZWIERZĄT (PET_ACTIONS_PROMPT) i jej przykłady dodajemy tylko,
  // gdy pets jest w grze — to największe pojedyncze bloki promptu.
  const includePets = modules.includes("pets");
  return `Jesteś asystentem WorldOfMag — pracujesz NA DANYCH użytkownika tymi samymi regułami dostępu co aplikacja.
Twoim zadaniem jest zrozumieć polecenie/pytanie, w razie potrzeby pobrać dane, a następnie ALBO odpowiedzieć, ALBO zaproponować akcje do potwierdzenia przez użytkownika.

PROTOKÓŁ — w KAŻDEJ turze zwróć DOKŁADNIE JEDEN obiekt JSON (bez markdown, bez komentarzy) z polem "thought" (jedno krótkie zdanie po polsku, do logu) i polem "step":

1) Pobranie danych (gdy potrzebujesz informacji):
{ "step":"query", "thought":"...", "tools":[ { "tool":"list_tasks", "args":{ "status":"TODO" } } ] }

2) Pytanie doprecyzowujące (gdy polecenie jest zbyt niejasne — ZANIM zaproponujesz akcje):
{ "step":"clarify", "thought":"...", "question":"Którą listę masz na myśli?", "options":["Apteka","Tygodniowe"] }  // options opcjonalne

3) Odpowiedź tekstowa (gdy użytkownik o coś PYTA — NIE twórz akcji):
{ "step":"answer", "thought":"...", "answer":"Najważniejsze teraz: **Zapłać ZUS** (URGENT, termin dziś).", "followups":["Pokaż wszystkie pilne zadania","Przesuń mniej ważne na jutro"] }  // markdown PL; followups OPCJONALNE: 2-3 KRÓTKIE, trafne propozycje następnego pytania/polecenia (z perspektywy użytkownika, w 1. osobie)

4) Plan akcji (gdy użytkownik chce coś ZMIENIĆ/DODAĆ — akcje NIE wykonają się od razu, użytkownik je potwierdzi):
{ "step":"plan", "thought":"...", "actions":[ { "id":"a1", "module":"tasks", "type":"update_task_status", "description":"Oznacz „Zapłać ZUS" jako zrobione", "params":{ "taskId":"...", "status":"DONE" }, "searchQuery":"Zapłać ZUS" } ] }

5) Przekierowanie (gdy użytkownik chce ZOBACZYĆ/OTWORZYĆ gotowy widok — użytkownik potwierdzi przejście):
{ "step":"navigate", "thought":"...", "url":"/tasks/all?status=IN_PROGRESS", "label":"Zadania w trakcie" }

6) Raport (gdy użytkownik prosi o RAPORT/podsumowanie sesji lub obszerne zestawienie — zwróć pełny markdown; użytkownik obejrzy szkic i zdecyduje, czy zapisać):
{ "step":"report", "thought":"...", "title":"Tytuł raportu", "content":"# Tytuł\\n\\n## Podsumowanie\\n...\\n\\n## Fakty i dane\\n| ... |\\n\\n## Wnioski\\n..." }
Raport „z naszej sesji bez pomijania faktów, z podsumowaniem": uwzględnij WSZYSTKIE konkretne dane omówione w rozmowie (liczby, nazwy, terminy — w tabelach), sekcję ## Podsumowanie oraz linki markdown do elementów ([tytuł](/tasks/<id>)). Nie pomijaj faktów.

${READ_TOOLS_PROMPT}

${buildActionCatalog(modules)}

${NAVIGATION_CATALOG}
${includePets ? `\n${PET_ACTIONS_PROMPT}\n` : ""}
ZASADY:
- Najpierw "query" po dane, dopiero potem "answer" lub "plan" z konkretnymi id.
- Akcje ZBIORCZE (np. "oznacz wszystkie zadania o remoncie jako zrobione"): pobierz zadania przez query, SAM zdecyduj które pasują na podstawie tytułów/treści, a potem zwróć WIELE akcji — każda z własnym id. Nie ma akcji masowej; symulujesz ją pętlą pojedynczych akcji.
- Dla PYTAŃ używaj "answer", nie twórz akcji. Dla POLECEŃ zmiany danych używaj "plan". Dla próśb „pokaż/otwórz/przejdź do …" z gotowym widokiem używaj "navigate".
- Gdy czegoś brakuje lub jest niejednoznaczne — użyj "clarify" zanim zaproponujesz akcje.
- INTERNET: gdy odpowiedź wymaga informacji spoza danych użytkownika (ceny, fakty, definicje, wydarzenia, rzeczy ze świata), użyj "query" z narzędziem web_search, a w odpowiedzi CYTUJ źródła linkami markdown. Najpierw sprawdź dane użytkownika, dopiero potem sięgaj do internetu.
- RAPORT: gdy użytkownik prosi o raport/podsumowanie sesji lub obszerne zestawienie ("zrób raport", "podsumuj naszą rozmowę bez pomijania faktów") — użyj kroku "report" z pełnym markdownem (nie pomijaj konkretnych danych z rozmowy).
- Korzystaj z kontekstu (aktualny widok / aktywna lista / bieżący projekt) podanego w wiadomości użytkownika, gdy polecenie nie wskazuje wprost celu. Wcześniejsze tury rozmowy bywają dołączone jako kontekst — wykorzystuj je dla ciągłości.
- WYBÓR MODUŁU: gdy polecenie nie wskazuje wprost modułu, użyj modułu PODSTAWOWEGO (pierwszego na liście „Aktywne moduły"). Gdy użytkownik użyje słowa-klucza innego aktywnego modułu (np. „wydatek/przychód" → portfel, „zatankowałem" → flota, „nawyk/odhacz" → habits, „magazyn/wydaj ze stanu" → magazynowanie, „zaplanuj posiłek" → kitchen) — użyj tamtego modułu, o ile jest aktywny.
- Twórz akcje tylko dla modułów, których katalog masz wyżej: ${modules.join(", ")}. Jeśli polecenie wyraźnie dotyczy INNEGO modułu (nie ma go w katalogu) — użyj "clarify" lub "answer" i poproś o doprecyzowanie, NIE zgaduj akcji spoza katalogu.
- Zawsze zwracaj wyłącznie poprawny JSON wg schematu, bez żadnego dodatkowego tekstu.
${includePets ? `\n${PET_ACTION_EXAMPLES}` : ""}`;
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

const CATALOG_MODULES = Object.keys(ACTION_CATALOG_BY_MODULE);

// Dwustopniowy routing — KROK 1: tani klasyfikator wybiera moduły istotne dla
// polecenia, żeby do głównej pętli wstrzyknąć tylko ich katalog akcji (mniej
// tokenów, mniej rozproszenia). Zawsze dorzucamy moduł podstawowy. Przy
// jakiejkolwiek niepewności (błąd/pusto) zwracamy PEŁNY zestaw aktywnych modułów
// — wtedy zachowanie = jak przed optymalizacją (zero regresji w najgorszym razie).
async function routeModules(text: string, activeModules: string[], primary: string): Promise<string[]> {
  const allowed = activeModules.filter((m) => CATALOG_MODULES.includes(m));
  if (allowed.length <= 3) return allowed; // i tak mało — nie ma co klasyfikować
  try {
    const result = await chatComplete({
      op: "dispatch",
      messages: [
        {
          role: "system",
          content:
            `Wskaż moduły istotne dla polecenia użytkownika. Wybieraj WYŁĄCZNIE z: ${allowed.join(", ")}.\n` +
            `Zwykle 1 moduł; dodaj 2.–3. tylko gdy polecenie wyraźnie dotyczy kilku obszarów. Gdy niejasne — zwróć "${primary}".\n` +
            `Słowa-klucze: wydatek/przychód/zł→portfel; zatankowałem/serwis/przebieg→flota; nawyk/odhacz→habits; magazyn/stan/wydaj→magazynowanie; posiłek/przepis/spiżarnia→kitchen; wizyta/badanie→health; fiszka/słówko/talia→languages; temat wiadomości→news; pogoda/lokalizacja→weather; lista/kup→shopping; zadanie/projekt→tasks; notatka→notes; zwierzę/pies/kot/waż/karmienie→pets; raport→reports.\n` +
            `Zwróć WYŁĄCZNIE JSON: {"modules":["..."]}`,
        },
        { role: "user", content: text.slice(0, 600) },
      ],
      temperature: 0,
      maxTokens: 120,
      json: true,
    });
    if (!result.ok || !result.content) return allowed;
    const parsed = JSON.parse(result.content.trim().replace(/^```json\n?/i, "").replace(/```$/, "")) as { modules?: unknown };
    const picked = Array.isArray(parsed.modules)
      ? parsed.modules.map(String).filter((m) => allowed.includes(m))
      : [];
    const set = new Set<string>([primary, ...picked].filter((m) => allowed.includes(m)));
    return set.size > 0 ? Array.from(set) : allowed;
  } catch {
    return allowed; // fallback: pełny katalog aktywnych modułów
  }
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

interface LoopResult {
  status?: number;
  body: Record<string, unknown>;
}

// Rdzeń agenta: pętla narzędzi → krok terminalny. `onThought` (opcjonalne) dostaje
// myśl każdej iteracji NA ŻYWO — używane przez tryb streamingu (SSE) do pokazania,
// co asystent właśnie robi. Zwraca obiekt {status?, body} (bez NextResponse), żeby
// współdzielić logikę między trybem zwykłym a strumieniowym.
async function runAgentLoop(
  messages: ChatMessage[],
  userId: string,
  onThought?: (thought: string) => void
): Promise<LoopResult> {
  const log: LogEntry[] = [];

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    let parsed: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 2 && parsed === null; attempt++) {
      let content: string;
      try {
        content = await callAgent(messages);
      } catch (e) {
        const status = (e as { status?: number }).status ?? 502;
        return { status, body: { error: e instanceof Error ? e.message : "Błąd LLM" } };
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
      return { status: 502, body: { error: "LLM zwrócił nieprawidłowy format", log } };
    }

    const step = String(parsed.step ?? "");
    const thought = typeof parsed.thought === "string" ? parsed.thought : "";
    if (thought) onThought?.(thought);

    if (step === "query") {
      const rawTools = Array.isArray(parsed.tools) ? parsed.tools.slice(0, MAX_TOOLS_PER_TURN) : [];
      const toolCalls = rawTools
        .map((t) => t as { tool?: string; args?: Record<string, unknown> })
        .filter((t) => t.tool && ((READ_TOOL_NAMES as readonly string[]).includes(t.tool) || t.tool === "web_search"));

      const results: { tool: string; args: Record<string, unknown>; data: unknown; error?: string }[] = [];
      for (const call of toolCalls) {
        try {
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

      log.push({ iter, step, thought, tools: toolCalls.map((t) => ({ tool: t.tool!, args: t.args ?? {} })), results });
      messages.push({ role: "user", content: `Wyniki narzędzi (JSON):\n${JSON.stringify(results)}` });
      continue;
    }

    if (step === "clarify") {
      const question = typeof parsed.question === "string" ? parsed.question : "Doprecyzuj proszę polecenie.";
      const options = Array.isArray(parsed.options) ? parsed.options.map(String).slice(0, 6) : undefined;
      log.push({ iter, step, thought, question, options });
      const dialog = messages.filter((m) => m.role !== "system");
      return { body: { step: "clarify", question, options, thought, log, messages: dialog } };
    }

    if (step === "answer") {
      const answer = typeof parsed.answer === "string" ? parsed.answer : "Brak odpowiedzi.";
      const followups = Array.isArray(parsed.followups)
        ? parsed.followups.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 3)
        : undefined;
      log.push({ iter, step, thought });
      return { body: { step: "answer", answer, thought, log, ...(followups?.length ? { followups } : {}) } };
    }

    if (step === "report") {
      const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Raport z asystenta";
      const content = typeof parsed.content === "string" ? parsed.content : "";
      if (!content.trim()) {
        messages.push({ role: "user", content: "Pusty raport. Zwróć pełny markdown w polu content." });
        continue;
      }
      log.push({ iter, step, thought });
      return { body: { step: "report", title, content, thought, log } };
    }

    if (step === "navigate") {
      const url = sanitizeNavUrl(parsed.url);
      if (!url) {
        messages.push({ role: "user", content: "Nieprawidłowy lub niedozwolony adres. Podaj wewnętrzną ścieżkę aplikacji zaczynającą się od / (np. /tasks/all?status=IN_PROGRESS), albo użyj answer." });
        continue;
      }
      const label = typeof parsed.label === "string" && parsed.label.trim() ? parsed.label.trim() : "Otwórz widok";
      log.push({ iter, step, thought });
      return { body: { step: "navigate", url, label, thought, log } };
    }

    if (step === "plan") {
      const actions = normalizeActions(parsed.actions);
      if (actions.length === 0) {
        log.push({ iter, step: "answer", thought });
        return { body: { step: "answer", answer: thought || "Nie wykryto żadnych akcji do wykonania.", log } };
      }
      log.push({ iter, step, thought, actionsCount: actions.length });
      const dialog = messages.filter((m) => m.role !== "system");
      return { body: { step: "plan", actions, thought, log, messages: dialog } };
    }

    messages.push({ role: "user", content: "Nieznany step. Użyj jednego z: query, clarify, answer, navigate, plan." });
  }

  return {
    body: { step: "answer", answer: "Nie udało się dokończyć w limicie kroków. Spróbuj sformułować polecenie prościej lub bardziej konkretnie.", log },
  };
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
    stream?: boolean; // true → odpowiedź jako SSE z myślami na żywo
  };

  // Zbuduj konwersację. System prompt zawsze budujemy po stronie serwera (nie ufamy klientowi).
  // Moduły do katalogu akcji ustala router (krok 1) na ścieżce świeżego polecenia;
  // przy wznawianiu (clarify/refine) dajemy pełny zestaw aktywnych modułów.
  const messages: ChatMessage[] = [];
  let selectedModules: string[] = CATALOG_MODULES;

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
    // Wznowienie po doprecyzowaniu/korekcie — pełny katalog aktywnych modułów (bez routera).
    const ctx = body.context?.length ? body.context : CATALOG_MODULES;
    selectedModules = ctx.filter((m) => CATALOG_MODULES.includes(m));
    if (selectedModules.length === 0) selectedModules = CATALOG_MODULES;
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
    const primary = context[0] ?? "shopping";

    // KROK 1 (router): zawęź katalog akcji do modułów istotnych dla polecenia.
    selectedModules = await routeModules(text, context, primary);

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

  // System prompt (z katalogiem tylko wybranych modułów) na początek konwersacji.
  messages.unshift({ role: "system", content: buildSystemPrompt(selectedModules) });

  // Tryb strumieniowy (SSE): emitujemy myśli agenta NA ŻYWO, a na końcu pełny wynik.
  if (body.stream === true) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* zamknięte */ }
        };
        try {
          const result = await runAgentLoop(messages, userId, (t) => send({ type: "thought", text: t }));
          send({ type: "final", status: result.status ?? 200, body: result.body });
        } catch (e) {
          send({ type: "final", status: 502, body: { error: e instanceof Error ? e.message : "Błąd asystenta" } });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
    });
  }

  const result = await runAgentLoop(messages, userId);
  return NextResponse.json(result.body, result.status ? { status: result.status } : undefined);
}
