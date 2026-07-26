# Plan techniczny: Effort i temperature modeli LLM + tryb „maksymalny" asystenta

- **Spec:** ./spec.md (032-llm-effort-temperature)
- **Status:** draft
- **Data:** 2026-07-26

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście

Wzorcem jest istniejąca ścieżka konfiguracji modeli: `LlmAssignment` → `resolveLlmChain()` →
`ResolvedLlm` → `openAiBody()`/`anthropicBody()` w `src/lib/llm/chat.ts`. Wysiłek dokładamy **tą samą
drogą**: nowa kolumna w `LlmAssignment`, przeniesiona przez resolver do `ResolvedLlm`, a na końcu
**przetłumaczona na parametr dostawcy w jednym miejscu** — nowym module `src/lib/llm/effort.ts`,
z którego korzystają obie funkcje budujące ciało żądania. `temperature` i `maxTokens` są już
przenoszone przez resolver i respektowane przez `openAiBody` — brakuje wyłącznie ich wystawienia w
panelu i walidacji, więc tam nie piszemy nowej logiki.

Poziom pracy asystenta rozszerzamy o trzecią wartość w istniejącym `AssistantPref.level`
(`standard|economy` → `+ max`), wpiętą w istniejący helper `effectiveOperation()` oraz w miejsce,
gdzie agent decyduje o `primaryOp` — dokładnie tam, gdzie 031 wpiął tryb oszczędny.

Kluczowa zasada bezpieczeństwa: **parametru, którego dostawca/model może nie znać, nie wysyłamy**
(tabela możliwości po stronie Omnii) plus jednorazowa degradacja przy błędzie 400 wskazującym na ten
parametr — bo 400 jest nieprzejściowy i bez tego wywalałby całego agenta (patrz ryzyka §9).

## 2. Model danych (Prisma)

### 2.1 Zmienione modele

- **`LlmAssignment`** — nowa kolumna `effort String?`
  (`LlmEffort = "none" | "low" | "medium" | "high"`, `null`/`"none"` = nie wysyłaj nic).
  Kolumny `temperature Float?` i `maxTokens Int?` **już istnieją** — nie ruszamy schematu, tylko je
  wystawiamy.
- **`AiCall`** — nowa kolumna `effort String?` (diagnostyka: z jakim wysiłkiem wykonano wywołanie —
  AC-8). Spójna z pozostałymi kolumnami diagnostycznymi tego modelu (`status`, `attempts`, `source`).

Typy TS w `src/lib/llm/effort.ts` (**nie** enum Prisma — C-12):
`export type LlmEffort = "none" | "low" | "medium" | "high"`.

> **Świadoma decyzja (C-53):** `AssistantPref.level` NIE dostaje nowej kolumny — to już `String`,
> więc trzecia wartość `"max"` mieści się bez migracji. Rozszerzamy tylko unię TS i walidację.

### 2.2 Migracja (C-10, C-11)

- Numer z `npm run next:migration`: **0210**
- Katalog: `prisma/migrations/0210_llm_effort/migration.sql`
- Szkic DDL (idempotentnie):

```sql
ALTER TABLE "LlmAssignment" ADD COLUMN IF NOT EXISTS "effort" TEXT;
ALTER TABLE "AiCall"        ADD COLUMN IF NOT EXISTS "effort" TEXT;
```

Migracja jest **addytywna i nullable** — istniejące wiersze dostają `NULL`, czyli „brak wysiłku",
czyli zachowanie identyczne jak dziś (AC-5). Zero backfillu.

## 3. Warstwa serwera (Server Actions — C-20)

### 3.1 `src/actions/llmConfig.ts` (edycja)

| Funkcja | Zmiana |
|---|---|
| `getAssignments()` | `AssignmentDTO` dostaje `effort: LlmEffort` (z `null` → `"none"`) oraz — nowość w UI — już zwracane `temperature`/`maxTokens`. Dokładamy `providerKind` (z relacji `provider`), bo panel musi wiedzieć, co dany dostawca obsługuje (AC-3). |
| `setAssignment()` | Przyjmuje `effort?: string`; **walidacja** (AC-6): `effort ∈ LLM_EFFORT_LEVELS`, `temperature ∈ [0, 2]`, `maxTokens ∈ [1, 32000]`. Naruszenie → `throw new Error("…")` z polskim komunikatem, **bez** zapisu. Komunikat audytu rozszerzony o ustawione parametry (`logAudit` już jest — C-25). Kończy `revalidatePath("/admin/llm")`. |

Guard bez zmian: `requireAdmin()` (istniejący helper w pliku). Wpisy w manifeście pokrycia AI
(`action-coverage.json`) już istnieją dla obu funkcji — nowa bramka dostępu jest spełniona,
bo `access: "admin"` i guard w ciele są na miejscu (nic nie dopisujemy).

### 3.2 `src/actions/assistantPrefs.ts` (edycja)

Bez nowych funkcji — `updateAssistantPrefs` waliduje `level` przez `ASSISTANT_LEVELS`, więc
wystarczy rozszerzyć tę stałą w `src/types/index.ts` o `"max"` wraz z etykietą i opisem
(`ASSISTANT_LEVEL_LABELS` / `ASSISTANT_LEVEL_DESCRIPTIONS`).

## 4. RBAC / rejestr modułu (C-22)

- **Bez zmian.** Konfiguracja LLM pozostaje pod `PERMISSIONS.ADMIN` (istniejące `requireAdmin`);
  wybór poziomu pracy asystenta jest dostępny każdemu zalogowanemu (AC-13) tak jak dziś.
- Brak nowych slugów, brak wpięć w `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)

### 5.1 `src/components/admin/LlmConfigPanel.tsx` — `AssignmentRow` (edycja)

Dziś wiersz ma siatkę `1fr 1fr auto` (dostawca / model / zapis). Rozbudowa:

- **Drugi wiersz siatki** (`repeat(3, 1fr)`): **Wysiłek** (`<select>`: Brak / Niski / Średni / Wysoki),
  **Temperatura** (`<input type="number" step="0.1" min="0" max="2">`, puste = domyślna dostawcy),
  **Limit odpowiedzi (tokeny)** (`<input type="number" min="1" max="32000">`, puste = domyślny).
- **Informacja o możliwościach (AC-3):** pod kontrolką, `var(--text-muted)`, 11 px — wyliczana z
  `effortSupport(providerKind, model)` i `supportsTemperature(providerKind)`:
  - wysiłek nieobsługiwany → „Ten dostawca/model nie obsługuje wysiłku — ustawienie zostanie
    pominięte.",
  - temperatura przy Anthropic → „Dostawca Anthropic ignoruje temperaturę (nowsze modele Claude
    odrzucają ten parametr) — nie zostanie wysłana."
  - Tekst przelicza się **na bieżąco** przy zmianie modelu/dostawcy w tym wierszu (stan lokalny
    komponentu), więc admin widzi to przed zapisem.
- Kontrolka nieobsługiwana pozostaje **edytowalna, ale wyszarzona** (`opacity: 0.55`) — wartość da
  się zapisać „na przyszłość" (po zmianie modelu zadziała), a komunikat mówi wprost, że teraz jest
  pomijana. Zero hardcodowanych kolorów (C-30), wszystkie teksty PL (C-32).
- Mobile: panel administratora jest widokiem desktopowym, ale siatka dostaje
  `gridTemplateColumns: "1fr"` poniżej `md` przez `className` (Tailwind: `grid-cols-1 md:grid-cols-3`),
  żeby na telefonie kontrolki nie zlewały się w nieczytelny pasek (C-31).

### 5.2 `src/components/home/AICommandSheet.tsx` (edycja)

- Menu poziomu pracy renderuje `ASSISTANT_LEVELS` w pętli — **dodanie trzeciej wartości nie wymaga
  zmian w JSX**, wystarczy ikona: `Zap` (oszczędny) / `Gauge` (standardowy) / `Rocket` (maksymalny),
  a kolor aktywnego trybu: `var(--accent-amber)` dla oszczędnego, `var(--accent-purple)` dla
  maksymalnego.
- Opis w menu mówi wprost o koszcie („wyższa jakość, wyższy koszt") — AC-9.

## 6. AI / integracje (C-23, C-40)

### 6.1 `src/lib/llm/effort.ts` (nowy) — jedno miejsce tłumaczenia

```ts
export type LlmEffort = "none" | "low" | "medium" | "high";
export const LLM_EFFORT_LEVELS: LlmEffort[];              // kolejność = skala
export const LLM_EFFORT_LABELS: Record<LlmEffort, string>; // PL: Brak / Niski / Średni / Wysoki
export function bumpEffort(e: LlmEffort): LlmEffort;       // o jeden stopień, high → high (AC-10)
export function effortSupported(kind: ProviderKind, model: string): boolean;
export function supportsTemperature(kind: ProviderKind): boolean;   // anthropic → false
export function applyEffort(body, kind, model, effort): void;       // mutuje ciało żądania
export function isEffortRejection(status: number, text: string): boolean; // 400 o ten parametr
```

Tłumaczenie (tabela możliwości **po stronie Omnii**, bez odpytywania API):

| Dostawca (`kind`) | Warunek na model | Parametr wysyłany |
|---|---|---|
| `anthropic` | model z rodziny obsługującej rozszerzone myślenie (`claude-*-4*`, `claude-*-5`, `claude-opus-*`, `claude-sonnet-*` z wyłączeniem `-3-`) | `thinking: { type: "enabled", budget_tokens: N }`, gdzie N = 2048 / 6144 / 12288 dla niski/średni/wysoki; dodatkowo `max_tokens` podnoszone do `budget + 1024`, bo Anthropic wymaga `max_tokens > budget_tokens` |
| `openai_compat` | model z rodziny rozumującej (`o1`, `o3`, `o4`, `gpt-5`, `gpt-oss`, `qwen3`, `deepseek-r1`) | `reasoning_effort: "low" \| "medium" \| "high"` |
| pozostałe (np. `llama-*` na Groqu) | — | **nic** (i panel mówi o tym wprost) |

`effort: "none"` → nigdy nic nie wysyłamy (AC-5).

### 6.2 `src/lib/llm/resolver.ts` (edycja)

`ResolvedLlm` dostaje `effort?: LlmEffort | null`; gałąź „przypisanie admina" przenosi wartość z
`LlmAssignment`. Fallbackowe ogniwa (legacy Groq, awaryjny lżejszy model) dostają `effort: null` —
awaryjny model ma po prostu odpowiedzieć.

### 6.3 `src/lib/llm/chat.ts` (edycja)

- `ChatOptions` dostaje `effort?: LlmEffort` — **nadpisanie** wartości z konfiguracji (używa go tryb
  maksymalny asystenta). Rozstrzyganie: `opts.effort ?? cfg.effort ?? "none"`.
- `openAiBody()` / `anthropicBody()` wołają `applyEffort(...)` — jedno miejsce, obie ścieżki
  (jednorazowa i strumieniowa) korzystają z tych samych funkcji, tak jak dziś dla `temperature`.
- **Degradacja przy 400 (§9):** jeśli żądanie z wysiłkiem dostanie 400, którego treść wskazuje na ten
  parametr (`isEffortRejection`), robimy **jedną** ponowną próbę bez wysiłku, na tym samym modelu.
  Bez tego 400 (nieprzejściowy → `isRetryableLlmStatus` = false) przerywa łańcuch fallbacku i wywala
  asystenta.
- `recordAiCall({ …, effort })` — diagnostyka (AC-8).

### 6.4 `src/lib/ai/usage.ts` (edycja)

`AiCallEntry` dostaje `effort?: string | null`, zapisywane do nowej kolumny `AiCall.effort`.

### 6.5 `src/lib/llm/operationTypes.ts` (edycja)

`effectiveOperation(op, level)` — sygnatura przyjmuje już `level`; rozszerzamy o `"max"`:
`economy` → `dispatch` (bez zmian), `max` → **zwraca `op` bez zmian** (tryb maksymalny nie zmienia
typu operacji, zmienia wysiłek). Zwracamy też pomocnik `effortForLevel(base, level)`:
`max` → `bumpEffort(base)`, w pozostałych → `base`.

### 6.6 `src/app/api/llm/home/agent/route.ts` (edycja)

- `assistantLevel` już jest czytany z `AssistantPref` (031). Rozszerzamy o `"max"`.
- `primaryOp`: `economy || isSimpleRead ? "dispatch" : "reasoning"` → w trybie `max`
  **zawsze `reasoning`** (AC-11: znika zejście na tańszy model przy prostych pytaniach).
- Przekazanie wysiłku: `runAgentLoop(..., op, effortOverride)` → `chatComplete({ …, effort })`.
  Wartość liczona jako `bumpEffort(effort z konfiguracji dla danego op)`; ponieważ konfiguracja żyje
  w resolverze, najprościej przekazać **flagę** `boostEffort: true` i podnieść wysiłek w
  `chat.ts` przy rozstrzyganiu (`cfg.effort` → `bumpEffort(cfg.effort)`), co zachowuje regułę C-40
  (nadal wychodzimy od tego, co ustawił admin).
- **Brak nowych `AIAction`** i brak read-toolów → bramka `check:actions` nietknięta (C-23).

### 6.7 Pozostałe wywołania asystenta

`fastPath.ts` i `briefing` działają na `op: "dispatch"` i **nie** dostają boostu — tryb maksymalny
dotyczy pętli agenta (tam, gdzie jakość rozumowania ma znaczenie). Odnotowane, żeby `/verify` nie
uznał tego za brak.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/migrations/0210_llm_effort/migration.sql` | nowy | `effort` w `LlmAssignment` i `AiCall` (C-10) |
| `prisma/schema.prisma` | edycja | dwie kolumny zgodne z DDL |
| `src/lib/llm/effort.ts` | nowy | skala, etykiety PL, `bumpEffort`, tabela możliwości, tłumaczenie na parametr dostawcy, rozpoznanie odrzucenia 400 |
| `src/lib/llm/resolver.ts` | edycja | przeniesienie `effort` do `ResolvedLlm` |
| `src/lib/llm/chat.ts` | edycja | `applyEffort` w obu ciałach żądania, `boostEffort`, degradacja przy 400, `effort` do logu |
| `src/lib/llm/operationTypes.ts` | edycja | `effectiveOperation` + `effortForLevel` dla `max` |
| `src/lib/ai/usage.ts` | edycja | `effort` w `AiCallEntry` → `AiCall` |
| `src/app/api/llm/home/agent/route.ts` | edycja | tryb `max`: zawsze `reasoning` + boost wysiłku |
| `src/actions/llmConfig.ts` | edycja | `effort`/`temperature`/`maxTokens` w DTO i zapisie + walidacja + `providerKind` w DTO |
| `src/types/index.ts` | edycja | `AssistantLevel` + `"max"`, etykieta i opis |
| `src/components/admin/LlmConfigPanel.tsx` | edycja | trzy nowe kontrolki + informacja o możliwościach dostawcy |
| `src/components/home/AICommandSheet.tsx` | edycja | ikona i kolor trzeciego poziomu |
| `src/lib/llm/__tests__/effort.test.ts` | nowy | testy skali, `bumpEffort`, tabeli możliwości, tłumaczenia na parametry, rozpoznania 400 |
| `CLAUDE.md` | edycja | `effort` w opisie konfiguracji LLM + trzeci poziom asystenta |
| `doświadczenia.md` | edycja | lekcja, jeśli po drodze wyjdzie nieoczywisty problem (C-51) |

## 8. Bramki i weryfikacja (C-50)

**Lokalnie (C-13 — nigdy prod DB):** lokalny Postgres, `npx prisma migrate deploy`, potem
`npm run check:actions`, `npm run check:access`, `npm run check:migrations`, `next lint --dir src`,
`npm run test:unit`, `npx next build` (**bez** `scripts/migrate.js`).

| AC | Sposób weryfikacji |
|---|---|
| AC-1, AC-2 | przegląd `AssignmentRow`: trzy kontrolki, wysiłek jako lista opisowa PL |
| AC-3 | zmiana modelu w wierszu na `llama-3.3-70b` → komunikat o pominięciu wysiłku; dostawca Anthropic → komunikat o temperaturze |
| AC-4 | test jednostkowy `applyEffort`: Anthropic → `thinking.budget_tokens` + podniesiony `max_tokens`; OpenAI-reasoning → `reasoning_effort`; Groq/llama → ciało bez zmian |
| AC-5 | test: `effort:"none"`/`null` → ciało żądania **identyczne** jak przed zmianą (porównanie z oczekiwanym obiektem) |
| AC-6 | wywołanie `setAssignment` z `temperature: 5` / `maxTokens: -1` / `effort: "turbo"` → wyjątek z polskim komunikatem, brak zapisu (test na lokalnej bazie) |
| AC-7 | po zapisie wpis w `AuditLog` (kategoria `config`) z parametrami |
| AC-8 | po wywołaniu z wysiłkiem wiersz `AiCall` ma wypełnioną kolumnę `effort` |
| AC-9 | przegląd menu: trzy opcje z opisami |
| AC-10 | test `bumpEffort`: none→low→medium→high→high; test rozstrzygania w `chat.ts` przy `boostEffort` |
| AC-11 | przegląd `agent/route.ts`: w trybie `max` `primaryOp === "reasoning"` niezależnie od `isSimpleRead` |
| AC-12 | zapis `level:"max"` przez `updateAssistantPrefs` → odczyt `getAssistantPrefs` zwraca `max` |
| AC-13 | brak jakiegokolwiek gate'u na rolę w menu poziomu (przegląd kodu) |
| AC-14 | test: `boostEffort` przy modelu bez wsparcia → ciało bez parametru wysiłku (brak błędu) |
| AC-15 | uruchomienie pełnego zestawu bramek |

## 9. Ryzyka techniczne i plan wycofania

- **Nieobsługiwany parametr → 400 → wywalony agent** (główne ryzyko). Trzy warstwy obrony:
  (1) konserwatywna tabela możliwości — wysyłamy tylko gdy jesteśmy pewni rodziny modelu,
  (2) jednorazowa degradacja bez wysiłku przy 400 rozpoznanym jako odrzucenie tego parametru,
  (3) domyślne `none` — dopóki admin świadomie nie ustawi, nic się nie zmienia.
- **Anthropic: `max_tokens` musi być większy od `budget_tokens`** — inaczej 400. Mitygacja:
  `applyEffort` podnosi `max_tokens` do `budget + 1024`, gdy skonfigurowana wartość jest za mała.
  Objęte testem.
- **Rozszerzone myślenie zmienia kształt odpowiedzi Anthropic** (bloki `thinking` przed `text`).
  Ryzyko: parser mógłby wziąć blok myślenia za treść. Mitygacja: sprawdzić, jak
  `anthropicComplete`/`anthropicStream` wyciąga tekst — jeśli bierze pierwszy blok, wybieramy bloki
  typu `text`. **Do potwierdzenia w implementacji** (jeśli parser już filtruje po typie — nic nie
  robimy). To jedyne miejsce, gdzie plan zostawia rozstrzygnięcie na kod, bo zależy od istniejącej
  implementacji parsera.
- **Wzrost kosztów w trybie maksymalnym** → domyślnie wyłączony, koszt w stopce odpowiedzi,
  istniejące limity (`checkRateLimit`, `checkAiBudget`) bez zmian.
- **Rollback:** kod przez `git revert`; migracja jest **addytywna i nullable**, więc cofnięcie kodu
  nie wymaga cofania migracji (osierocone kolumny są nieszkodliwe) — zgodnie z
  `docs/devops/runbook-deploy-rollback.md`.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10, C-11, C-12** — ręczna migracja `0210_llm_effort` (numer z `next:migration`),
  idempotentna, addytywna; `effort` jako `TEXT` + unia TS, **zero enumów Prisma**;
  `AssistantPref.level` bez migracji (już `String`).
- [x] **C-13** — weryfikacja na lokalnym Postgresie, `migrate.js` nie uruchamiany.
- [x] **C-20** — zapis przez istniejące Server Actions z `revalidatePath`.
- [x] **C-21, C-22** — bez zmian w modelu współwłasności i RBAC; `requireAdmin` na konfiguracji.
- [x] **C-23** — brak nowych `AIAction`; bramki spójności i kontraktu akcji nietknięte.
- [x] **C-25** — zapis konfiguracji dalej loguje się w `AuditLog`, z rozszerzonym opisem.
- [x] **C-30, C-31, C-32** — wyłącznie zmienne CSS, siatka jednokolumnowa poniżej `md`, wszystkie
  teksty po polsku.
- [x] **C-40** — **kluczowe:** wysiłek to konfiguracja **admina** per typ operacji; tryb maksymalny
  użytkownika tylko **podnosi** to, co admin ustawił (i nie zmienia modelu). Zero hardkodowanego
  dostawcy/modelu — tabela możliwości opisuje *rodziny* modeli, nie wskazuje żadnego konkretnego do
  użycia.
- [x] **C-41** — bez zmian w obsłudze kluczy; treść błędu dostawcy nie wychodzi do klienta.
- [x] **C-53** — wykorzystujemy dwie **istniejące, martwe** kolumny zamiast dokładać nowe; trzecia
  wartość poziomu asystenta bez migracji; jedno miejsce tłumaczenia zamiast rozsypanych warunków;
  **zero nowych zależności npm**.
