// 002-ai-architecture — deterministyczny fast-path dla PROSTYCH poleceń.
//
// Zasada „LLM to mózg, nie silnik": trywialne polecenia typu „dodaj/utwórz/zapisz"
// klasyfikujemy JEDNYM tanim wywołaniem (op:"dispatch" → np. Haiku/8B) i budujemy z
// nich gotową AIAction — BEZ uruchamiania dużego modelu rozumującego (op:"reasoning").
// Wszystko, co wymaga namierzenia istniejącego rekordu, jest zbiorcze, analityczne
// albo jest pytaniem → zwracamy `complex` i oddajemy sterowanie pełnej pętli agenta.
//
// Fast-path NIE wykonuje zapisu — produkuje AIAction do panelu potwierdzenia
// (ActionDrawer), tak samo jak krok "plan" agenta (destructive opt-in bez zmian).

import { chatComplete } from "@/lib/llm/chat";
import type { AIAction, AIActionModule } from "@/lib/ai/aiAction";

export type FastPathResult =
  | { kind: "simple"; action: AIAction }
  | { kind: "complex" };

// Biała lista prostych intencji „bezstanowych" (tworzenie/dopisanie), mapowana na
// ISTNIEJĄCE typy AIAction (bez nowych egzekutorów). Klucz = `${module}:${type}`.
const WHITELIST: Record<string, { module: AIActionModule; type: string }> = {
  "shopping:add_item": { module: "shopping", type: "add_item" },
  "tasks:create_task": { module: "tasks", type: "create_task" },
  "notes:create_note": { module: "notes", type: "create_note" },
  "portfel:add_expense": { module: "portfel", type: "add_expense" },
  "portfel:add_income": { module: "portfel", type: "add_income" },
  "habits:toggle_habit": { module: "habits", type: "toggle_habit" },
  "kitchen:add_pantry_item": { module: "kitchen", type: "add_pantry_item" },
  "kitchen:plan_meal": { module: "kitchen", type: "plan_meal" },
  "flota:add_fuel_log": { module: "flota", type: "add_fuel_log" },
};

const SYSTEM_PROMPT = `Jesteś szybkim klasyfikatorem intencji asystenta WorldOfMag. Twoim zadaniem jest rozpoznać, czy polecenie użytkownika to POJEDYNCZA, PROSTA operacja dodania/utworzenia/zapisania, którą można wykonać deterministycznie bez głębszego rozumowania.

Zwróć WYŁĄCZNIE jeden obiekt JSON (bez markdown, bez komentarzy).

Jeśli polecenie pasuje DOKŁADNIE do jednej z poniższych prostych intencji — zwróć:
{ "kind":"simple", "module":"<moduł>", "type":"<typ>", "description":"<krótki opis po polsku>", "params":{...}, "searchQuery":"<opcjonalnie>" }

Dostępne proste intencje (i pola params):
- shopping / add_item — { rawText } — rawText to sama nazwa i ilość produktu ("2 kg jabłek"), bez nazwy listy. (np. "dodaj mleko do zakupów")
- tasks / create_task — { title, description?, priority?("NONE"|"LOW"|"MEDIUM"|"HIGH"|"URGENT"), dueDate?(ISO) } — proste "dodaj zadanie X". Jeśli podajesz description, wstaw oryginalny tekst użytkownika VERBATIM (słowo w słowo) — NIE przeredagowuj, NIE poprawiaj gramatyki; title może być krótką etykietą wygenerowaną z treści.
- notes / create_note — { title, content? } — proste "zanotuj/utwórz notatkę X".
- portfel / add_expense — { amount(number, PLN), category?, note? } — "wydałem 20 zł na ...".
- portfel / add_income — { amount(number, PLN), category?, note? } — "przychód 100 zł ...".
- habits / toggle_habit — {} + searchQuery=nazwa nawyku — "odhacz nawyk X".
- kitchen / add_pantry_item — { name, quantity?, unit?, expiresAt?(ISO) } — "dodaj X do spiżarni".
- kitchen / plan_meal — { customTitle, date?(ISO; pomiń jeśli dziś), slot?("breakfast"|"lunch"|"dinner"|"snack") } — "zaplanuj na obiad X".
- flota / add_fuel_log — { liters(number), totalCost?, odometer?, vehicleName? } — "zatankowałem X litrów".

W KAŻDYM innym przypadku zwróć: { "kind":"complex" }

Zwróć "complex" gdy polecenie: jest pytaniem; jest zwykłą ROZMOWĄ / prośbą o radę / wypowiedzią towarzyską lub emocjonalną (to nie jest polecenie zmiany); jest prośbą o WYSZUKANIE/POKAZANIE/PODANIE/ZAPROPONOWANIE danych ("podaj mi zadanie", "pokaż moje notatki", "ile mam …", "znajdź …", "zaproponuj coś do zrobienia") — to ODCZYT, nie tworzenie; wymaga znalezienia/zmiany/usunięcia ISTNIEJĄCEGO rekordu (oznacz/zmień/przesuń/usuń); jest zbiorcze (wiele rzeczy naraz, wklejona lista); wymaga analizy/planowania/wyszukania; jest niejednoznaczne; albo dotyczy modułu spoza listy wyżej.

WAŻNE — cel niejednoznaczny: dla tasks/create_task zwróć "simple" TYLKO gdy użytkownik jawnie nazwał projekt/listę zadań (np. „dodaj zadanie X do projektu Dom"). Jeśli projekt/lista NIE jest nazwany — zwróć "complex" (oddaj sterowanie agentowi, który dopyta lub użyje kontekstu). Analogicznie, gdy z treści wynika konkretna, lecz nienazwana lista/projekt — zwróć "complex".

W razie WĄTPLIWOŚCI zwróć "complex".`;

interface RawParsed {
  kind?: string;
  module?: string;
  type?: string;
  description?: string;
  params?: Record<string, unknown>;
  searchQuery?: string;
}

function extractJson(content: string): RawParsed | null {
  try {
    const cleaned = content
      .trim()
      .replace(/^```json\n?/i, "")
      .replace(/^```\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    const j = JSON.parse(cleaned);
    return j && typeof j === "object" && !Array.isArray(j) ? (j as RawParsed) : null;
  } catch {
    return null;
  }
}

// Deterministyczny strażnik: polecenia „znajdź/pokaż/podaj/ile/zaproponuj …" to PROŚBY O ODCZYT,
// nie tworzenie. Kotwiczymy na POCZĄTKU wypowiedzi (prośby o wyszukanie zwykle tak się zaczynają),
// żeby nie łapać zdań typu „dodaj X i pokaż Y". Trafienie → oddajemy pełnemu agentowi (query+answer).
// Fałszywe trafienie jest tanie (agent i tak poprawnie obsłuży tworzenie) — nadmiar „complex" jest OK.
const READ_INTENT_RE =
  /^\s*(podaj|pokaż|pokaz|wyświetl|wyswietl|wylistuj|wypisz|listuj|znajdź|znajdz|wyszukaj|poszukaj|ile\b|jak(ie|i|a|ich)\b|któr\w+|co (mam|mogę|moge|powinien|powinienem|jest|robić|zrobić|warto)|masz|czy (mam|jest|są|sa|mogę|moge)|zaproponuj|zasugeruj|doradź|doradz|poradź|poradz|przypomnij|kiedy|gdzie|sprawdź|sprawdz)\b/i;

// Wskazanie nazwanej listy zakupów (np. „do listy Apteka", „na listę Tygodniowe") — fast-path
// add_item gubi nazwę listy (buduje tylko rawText), więc oddajemy takie polecenie agentowi, który
// wypełni listName (executor go respektuje). Sygnałem jest rdzeń słowa „lista".
const SHOPPING_NAMED_LIST_RE = /\blist[aąeęiy]\w*/i;

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || !v.trim();
}

// Odrzuć „pustą" prostą akcję (np. dodanie NICZEGO do listy) — brak kluczowej treści → complex.
function hasEmptyPayload(type: string, params: Record<string, unknown>, searchQuery?: string): boolean {
  switch (type) {
    case "add_item":
      return isBlank(params.rawText);
    case "create_task":
      return isBlank(params.title);
    case "create_note":
      return isBlank(params.title) && isBlank(params.content);
    case "add_pantry_item":
      return isBlank(params.name);
    case "plan_meal":
      return isBlank(params.customTitle);
    case "add_expense":
    case "add_income": {
      const amt = typeof params.amount === "number" ? params.amount : Number(params.amount);
      return !Number.isFinite(amt) || amt <= 0;
    }
    case "toggle_habit":
      return isBlank(searchQuery);
    default:
      return false;
  }
}

/**
 * Klasyfikuje polecenie. `activeModules` = moduły dostępne/aktywne dla użytkownika —
 * akcję zbudujemy tylko dla modułu z tej listy. Każda niepewność (błąd LLM, brak
 * dopasowania do białej listy, moduł nieaktywny) → `complex` (bezpieczny fallback).
 */
export async function classifyIntent(
  text: string,
  activeModules: string[],
  userId: string,
  conversationId?: string | null
): Promise<FastPathResult> {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "complex" };

  // Strażnik intencji odczytu (bez wołania LLM) — „podaj/pokaż/znajdź/ile/zaproponuj …" → pełny agent.
  if (READ_INTENT_RE.test(trimmed)) return { kind: "complex" };

  const result = await chatComplete({
    op: "dispatch",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: trimmed.slice(0, 600) },
    ],
    temperature: 0,
    maxTokens: 300,
    json: true,
    userId,
    source: "fast_path",
    conversationId,
  });
  if (!result.ok || !result.content) return { kind: "complex" };

  const parsed = extractJson(result.content);
  if (!parsed || parsed.kind !== "simple" || !parsed.module || !parsed.type) {
    return { kind: "complex" };
  }

  const key = `${parsed.module}:${parsed.type}`;
  const wl = WHITELIST[key];
  if (!wl) return { kind: "complex" };
  // Moduł musi być aktywny dla użytkownika.
  if (!activeModules.includes(wl.module)) return { kind: "complex" };

  const params = parsed.params && typeof parsed.params === "object" ? parsed.params : {};
  const searchQuery =
    typeof parsed.searchQuery === "string" && parsed.searchQuery.trim() ? parsed.searchQuery.trim() : undefined;

  // Strażnik pustego payloadu — nie dodawaj „niczego" (np. pusta pozycja do listy zakupów).
  if (hasEmptyPayload(wl.type, params, searchQuery)) return { kind: "complex" };

  // Nazwana lista przy add_item → oddaj agentowi (fast-path zgubiłby listName). Realizuje „szanuj
  // wskazaną listę" (spec 008 AC-5) na szybkiej ścieżce.
  if (wl.type === "add_item" && SHOPPING_NAMED_LIST_RE.test(trimmed)) return { kind: "complex" };

  const action: AIAction = {
    id: "a1",
    module: wl.module,
    type: wl.type,
    description: typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description.trim()
      : trimmed.slice(0, 120),
    params,
    ...(searchQuery ? { searchQuery } : {}),
  };
  return { kind: "simple", action };
}
