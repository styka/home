# Plan techniczny: Architektura AI dla Asystenta Osobistego

- **Spec:** ./spec.md (002-ai-architecture)
- **Status:** draft
- **Data:** 2026-07-15

> **Zasada planu:** to jest **JAK**, pod istniejący kod. Duża część fundamentów już istnieje
> (provider Anthropic w `resolver.ts`/`chat.ts`, DB-driven routing per typ operacji, budżet tokenowy
> `AiUsage`, cache odpowiedzi, cap historii). Feature dokłada 4 rzeczy inkrementalnie.

## 1. Podejście (2–4 zdania)

Rozbudowujemy **istniejącą** warstwę LLM i pętlę agenta domowego — bez nowego modułu, bez nowych
zależności (C-53). Wzorce do naśladowania: `src/lib/llm/*` (routing/chat), `src/app/api/llm/home/agent/route.ts`
(pętla + istniejący tani pre-routing `routeModules`/`keywordRoute` na `op:"dispatch"`), `src/lib/ai/usage.ts`
+ `src/actions/metrics.ts` (agregaty), `src/actions/llmConfig.ts` + `src/components/admin/LlmConfigPanel.tsx`
(konfiguracja providerów). Cztery kawałki: **(A)** fast-path intencji na `dispatch` przed pełną pętlą
`reasoning`; **(B)** prompt caching Anthropic; **(C)** log per-wywołanie + widok kosztów + alert;
**(D)** gotowy profil Anthropic Sonnet/Haiku w `/admin/llm`.

## 2. Model danych (Prisma)

- **Nowy model `AiCall`** — log pojedynczego wywołania LLM (obserwowalność jednostkowa, AC-5/AC-6).
  Wzorowany na lekkości `AuditLog` (bez FK do `User`, snapshot `userId` jako zwykły `String?` — log
  systemowy, przeżywa usunięcie usera). Statusy/typy jako `String` (C-12, zero enumów).
  - Pola: `id String @id @default(cuid())`, `userId String?` (aktor, bez relacji/FK),
    `operationType String` (`dispatch|reasoning|vision|generation`), `providerKind String`
    (`openai_compat|anthropic`), `model String`, `promptTokens Int @default(0)`,
    `completionTokens Int @default(0)`, `cacheReadTokens Int @default(0)`,
    `cacheWriteTokens Int @default(0)`, `totalTokens Int @default(0)`,
    `costUsd Float @default(0)` (szacowany), `latencyMs Int @default(0)`, `ok Boolean @default(true)`,
    `source String?` (np. `home_agent|fast_path|dispatch_route|notes_qa|kitchen_ocr…` — do rozbicia),
    `createdAt DateTime @default(now())`.
  - Indeksy: `@@index([createdAt])`, `@@index([model])`, `@@index([operationType])`.
- **Próg alertu kosztowego** — bez nowego modelu: klucz w istniejącym `Config`
  (`ai_cost_daily_alert_usd`, wartość liczbowa jako string; `"0"`/brak = alert wyłączony). Zapis przez
  istniejący mechanizm config (nie wymaga szyfrowania — to nie sekret).
- **Migracja (C-10, C-11):**
  - Numer z `npm run next:migration`: **`0205`** (ostatni istniejący to `0204_…`).
  - Katalog: `prisma/migrations/0205_ai_call_log/migration.sql`.
  - DDL: `CREATE TABLE "AiCall" (…)` + trzy `CREATE INDEX`. Bez seedu, bez zmian w `User`
    (brak FK → lekka migracja). Idempotencji nie wymaga (czysty CREATE), ale trzymamy nazwy w cudzysłowach.
- Reszta feature'a **nie rusza schematu** (fast-path, caching, profil Anthropic korzystają z
  istniejących `LlmProvider`/`LlmAssignment`/`Config`).

## 3. Warstwa serwera (Server Actions — C-20) i rdzeń LLM

### 3a. Fast-path intencji (A) — `src/lib/ai/fastPath.ts` (nowy) + wpięcie w agent route

- `classifyIntent(text, activeModules, userId)` — **jedno** wywołanie `chatComplete({ op:"dispatch", … })`
  (tani model; Haiku gdy aktywny profil Anthropic, `llama-3.1-8b-instant` na Groq). Zwraca albo
  `{ kind:"simple", action: AIAction }` dla zdefiniowanej białej listy prostych intencji, albo
  `{ kind:"complex" }`. Przy jakiejkolwiek niepewności/błędzie/niskiej pewności → `complex`
  (bezpieczny fallback, zero regresji — ryzyko ze spec §9).
- **Biała lista intencji v1.0** = proste, „bezstanowe" tworzenie/dopisanie, mapowane na **istniejące**
  typy `AIAction` (żadnej nowej `AIAction` → `check:actions` przechodzi bez nowych egzekutorów, C-23):
  `add_item` (zakupy), `create_task`, `create_note`, `add_expense`/`add_income`, `toggle_habit`,
  `add_pantry_item`, `plan_meal`, `add_fuel_log`. Operacje wymagające namierzenia istniejącego rekordu
  (status/usuń/przesuń), zbiorcze, analityczne i pytania → **zawsze** `complex` → pełna pętla `reasoning`
  (AC-3).
- Wpięcie w `POST` w `agent/route.ts` na ścieżce **świeżego** polecenia (nie przy wznowieniu
  clarify/refine), **przed** `routeModules`/`runAgentLoop`: gdy `simple` → zwróć `{ step:"plan",
  actions:[action], thought, log:[…], messages }` w **identycznym** kształcie jak zwraca `runAgentLoop`
  (klient/ActionDrawer bez zmian — AC-2). `meta` oznacza `source:"fast_path"`. Gdy `complex` → dotychczasowa
  ścieżka bez zmian.
- Skutek dla AC-1: trywialne polecenie → co najwyżej **jeden** wpis `dispatch` w logu wywołań, **zero**
  `reasoning`; ActionDrawer pokazuje akcję do potwierdzenia (destructive opt-in bez zmian).

### 3b. Prompt caching Anthropic (B) — `src/lib/llm/chat.ts`

- W `toAnthropic(...)`: gdy jest `system`, zwróć go jako **tablicę bloków** z `cache_control` na ostatnim
  bloku: `system:[{ type:"text", text:<stały prefiks>, cache_control:{ type:"ephemeral" } }]`. To GA —
  **bez** beta-headera; nagłówek pozostaje `anthropic-version: 2023-06-01` (już jest). Dla providerów
  `openai_compat` (Groq) — **bez zmian** (AC-4, część „dostawca bez wsparcia").
- Warunek skuteczności (z prompt-caching): prefiks musi być stały i długi (Sonnet ≥ 2048, Haiku ≥ 4096
  tokenów) — system prompt agenta (instrukcja + katalog narzędzi) to spełnia; **nie** wstrzykiwać do
  system-promptu zmiennych (data/kontekst) — te już idą w wiadomości `user` (agent route tak robi), więc
  prefiks jest stabilny. Uwaga dla implementera: `routeModules` zmienia katalog akcji per-polecenie, co
  zmienia prefiks — to akceptowalne (cache i tak działa w obrębie wielo-turowej rozmowy z tym samym
  zestawem modułów); nie „naprawiać" tego rozbijaniem promptu (C-53).
- W `anthropicComplete`/`anthropicStream`: odczytaj z `usage` pola `cache_read_input_tokens` i
  `cache_creation_input_tokens`; rozszerz typ `TokenUsage` o `cacheRead?`/`cacheWrite?` i przekaż dalej
  (do logu — 3c). `openAiComplete` zostawia je puste.
- Implementer: **przed edycją potwierdź szczegóły skillem `claude-api`** (placement `cache_control`, pola
  usage) — potwierdzone w tym planie, ale zweryfikuj przy pisaniu.

### 3c. Log per-wywołanie + koszt + alert (C) — `src/lib/ai/usage.ts` (+ nowy `src/lib/llm/pricing.ts`)

- **Centralny punkt** logowania = `chatComplete` w `chat.ts` (choke point: agent domowy woła
  `chatComplete` także w trybie SSE przez `callAgent`; `routeModules`/fast-path/moduły też). Mierzymy
  `latencyMs` wokół realnego `fetch`, po sukcesie liczymy koszt i zapisujemy `AiCall`.
  - `chatStream` (używany tylko przez NotesQA) — parsowanie usage ze strumienia jest droższe; w v1.0
    **poza zakresem** per-call logu (odnotowane w spec „poza zakresem: hard-block"); zostaje w agregatach.
- **Cennik** — `src/lib/llm/pricing.ts`: statyczna mapa `model → { inputPer1M, outputPer1M, cacheReadPer1M? }`
  z fallbackiem `0` dla nieznanych modeli. Wpisy (USD/1M, źródło: skill `claude-api`):
  `claude-sonnet-5` = 3.00/15.00, `claude-haiku-4-5` = 1.00/5.00, plus domyślne Groq/Llama (≈0 lub wg
  cennika Groq). Cache-read ≈ 0.1× input. Koszt liczony jako
  `(prompt·in + completion·out + cacheRead·0.1·in + cacheWrite·1.25·in)/1e6`; jasno oznaczony „szacowany".
- `recordAiCall(entry)` — nowa funkcja w `usage.ts` (obok istniejącego `recordAiUsage`): zapis `AiCall`
  (fire-and-forget, `.catch(()=>{})` — nie blokuje odpowiedzi). Nie zastępuje `recordAiUsage` (budżet
  dzienny zostaje).
- **Alert (AC-6):** po zapisie, jeśli `ai_cost_daily_alert_usd > 0`, policz dzienną sumę `costUsd`
  z `AiCall` (UTC dzień); przy przekroczeniu wyślij powiadomienie do adminów istniejącym `notifyUser`
  (`module:"admin"`, `dedupeKey:"ai-cost-alert-<YYYY-MM-DD>"` → idempotentne, jeden alert/dzień). Alert
  **nie blokuje** asystenta (poza istniejącym budżetem per user).
- **Widok admina (AC-5)** — Server Actions w `src/actions/llmConfig.ts` (spójnie z resztą konfiguracji LLM):
  - `getAiCostBreakdown(days=30)` → agregacja `AiCall` grupowana po `model` i `operationType`
    (liczba wywołań, tokeny in/out, cacheRead/Write, sumaryczny `costUsd`, średni `latencyMs`).
  - `getCostAlertThreshold()` / `setCostAlertThreshold(usd)` → odczyt/zapis `Config.ai_cost_daily_alert_usd`;
    `setCostAlertThreshold` kończy `revalidatePath("/admin/llm")` (C-20) i loguje zmianę do `AuditLog`
    (kategoria `config`, C-25) jak inne zmiany configu.

### 3d. Profil Anthropic (D) — `src/actions/llmConfig.ts` + panel

- `applyAnthropicProfile({ apiKey })` (nowa Server Action): upsert `LlmProvider` (kind `anthropic`,
  `baseUrl:"https://api.anthropic.com/v1"`, `apiKey` **zaszyfrowany** `encryptSecret`, C-41) + `setAssignment`
  dla: `reasoning`→`claude-sonnet-5`, `generation`→`claude-sonnet-5`, `dispatch`→`claude-haiku-4-5`,
  `vision`→`claude-sonnet-5` (Sonnet ma vision). **Nie** usuwa/nie podmienia providera Groq — zostaje jako
  fallback w łańcuchu resolvera; domyślny provider dla środowiska bez klucza Anthropic pozostaje Groq
  (AC-7, decyzja właściciela). `revalidatePath("/admin/llm")` + log do `AuditLog`. Modele w
  przypisaniach są **edytowalne** w istniejącym UI przypisań (profil to skrót, nie hardcode w kodzie
  funkcji — C-40).

## 4. RBAC / rejestr modułu (C-22)

- **Bez nowego sluga.** Widok kosztów, próg i profil żyją pod `module.admin` w `/admin/llm`
  (istniejący `hasPermission(session, PERMISSIONS.ADMIN)`). Asystent i fast-path pod `module.home`.
  Read-toole i egzekutory `AIAction` bez zmian → `permissions.ts`/`modules.tsx`/`ModuleSidebar` **nietknięte**.

## 5. UI (C-30, C-31, C-32)

- `src/app/admin/llm/page.tsx` — dołóż sekcję **„Zużycie i koszty"** (server-fetch `getAiCostBreakdown`)
  i **„Profil Anthropic (Sonnet + Haiku)"**; przekaż dane do panelu.
- `src/components/admin/LlmConfigPanel.tsx` — dwa bloki:
  - Tabela kosztów per model/typ operacji (wywołania, tokeny in/out + cache, koszt „szacowany", śr. czas)
    + pole progu alertu (`setCostAlertThreshold`).
  - Przycisk „Zastosuj profil Anthropic (Sonnet + Haiku)" z polem na klucz → `applyAnthropicProfile`;
    krótka instrukcja PL, że Groq pozostaje domyślny.
- Motyw: wyłącznie zmienne CSS (`var(--bg-*)`, `var(--text-*)`, `var(--accent-*)`, `var(--on-accent)` na
  kolorowych przyciskach — C-30). Teksty **po polsku** (C-32). Responsywność: tabela w kontenerze
  `overflow-x:auto`; strona `/admin/*` korzysta z istniejącego chrome (C-31). ActionDrawer/klient AI bez
  zmian (fast-path zwraca ten sam kształt).

## 6. AI / integracje (C-23, C-40)

- **Zero nowych `AIAction`** — fast-path reużywa istniejące typy → `check:actions` (w `build`) przechodzi
  bez nowych egzekutorów. Gdyby implementacja jednak dodała wariant → **musi** dopisać egzekutor w
  `/api/llm/home/execute` (C-23).
- Routing pozostaje DB-driven per typ operacji (`resolver.ts`) — fast-path używa `op:"dispatch"`, pełna
  pętla `op:"reasoning"` (C-40). Klucze szyfrowane/maskowane (C-41).
- **Powiadomienia:** alert kosztowy przez istniejący `notifyUser` (bell). Kalendarz/trash — nie dotyczy.
- **Guardy rozmiaru (AC-8):** historia już przycięta (`MAX_HISTORY_MESSAGES=12`); implementer **audytuje**
  limity w read-toolach `src/lib/ai/agentTools.ts` i dokłada `take`/`LIMIT` tam, gdzie brak (minimalnie).

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `prisma/schema.prisma` | edycja | model `AiCall` |
| `prisma/migrations/0205_ai_call_log/migration.sql` | nowy | CREATE TABLE + indeksy (C-10/11) |
| `src/lib/ai/fastPath.ts` | nowy | klasyfikacja intencji + budowa `AIAction` (A) |
| `src/app/api/llm/home/agent/route.ts` | edycja | wpięcie fast-path przed pętlą; `source` w meta |
| `src/lib/llm/chat.ts` | edycja | prompt caching Anthropic; usage cache tokens; log `recordAiCall`; `latencyMs` |
| `src/lib/llm/pricing.ts` | nowy | cennik model→koszt (szacowany) |
| `src/lib/ai/usage.ts` | edycja | `recordAiCall`, dzienna suma kosztu, wyzwolenie alertu |
| `src/actions/llmConfig.ts` | edycja | `getAiCostBreakdown`, `get/setCostAlertThreshold`, `applyAnthropicProfile` (+`revalidatePath`, `AuditLog`) |
| `src/app/admin/llm/page.tsx` | edycja | fetch + sekcje kosztów/profilu |
| `src/components/admin/LlmConfigPanel.tsx` | edycja | UI kosztów, progu, przycisku profilu |
| `src/lib/ai/agentTools.ts` | edycja (audyt) | dołożyć brakujące limity zapytań (AC-8) |
| `doświadczenia.md` | edycja | wpis lekcji przy pierwszym napotkanym problemie (C-51) |

## 8. Bramki i weryfikacja (C-50)

- **Lokalnie (C-13):** lokalny Postgres (`pg_ctlcluster 16 main start`, `omnia/omnia_dev`), `.env.local`
  na `127.0.0.1:5432` + eksport do shella, `npx prisma migrate deploy`. **Nigdy** prod DB.
- Bramki: `npm run check:migrations` (unikalny prefix 0205), `npm run check:actions` (brak nowych
  `AIAction` → zielone), `next lint`, `next build`. **Nie** uruchamiać `migrate.js`/pełnego `build` z prod
  `DATABASE_URL`.
- **Mapowanie AC → weryfikacja:**
  - AC-1/AC-3: log `AiCall` po „dodaj mleko" ma `dispatch` bez `reasoning`; po „zaplanuj weekend" ma
    `reasoning` (ręczny smoke na dev / inspekcja tabeli).
  - AC-2: fast-path zwraca `step:"plan"` → ActionDrawer renderuje akcję (klient bez zmian).
  - AC-4: dla providera Anthropic `usage.cache_read_input_tokens` > 0 przy powtórnym wywołaniu z tym samym
    prefiksem; dla Groq zachowanie niezmienione.
  - AC-5: `/admin/llm` pokazuje rozbicie per model/typ (koszt/tokeny/czas).
  - AC-6: przy progu > 0 i przekroczeniu — powiadomienie admina (dedupe/dzień).
  - AC-7: „Zastosuj profil Anthropic" ustawia Sonnet/Haiku w przypisaniach; Groq nadal fallback.
  - AC-8: read-toole mają `take`/limit; historia ≤ 12.
  - AC-9: `npm run build` zielony.

## 9. Ryzyka techniczne i plan wycofania

- **Błędna klasyfikacja fast-path** → domyślny fallback do pełnej pętli; wąska biała lista; próg pewności.
- **Cache Anthropic nieaktywny** (za krótki/zmienny prefiks) → brak błędu, tylko brak oszczędności;
  weryfikacja przez `cache_read_input_tokens`. Dla Groq brak zmiany.
- **Koszt szacowany ≠ realny** → cennik konfigurowalny w kodzie, oznaczone „szacowany", brak twardego blocku.
- **Rollback:** kod — revert commita (fast-path/caching/log to dodatki, stara ścieżka nietknięta);
  migracja — `AiCall` to nowa, niezależna tabela (drop bez wpływu na resztę), zgodnie z runbookiem devops.

## 10. Zgodność z konstytucją — checklista

- [x] C-10..C-14 — ręczna migracja `0205_ai_call_log`, `String`+union (zero enumów), próg w `Config` (bez sekretu), brak buildu na prod DB.
- [x] C-20..C-25 — Server Actions z `revalidatePath`; `module.admin`/`module.home` (brak nowego sluga); zero nowych `AIAction` (C-23); `AuditLog` na zmianach config/profilu (C-25); trash n/d.
- [x] C-30..C-32 — zmienne CSS, `var(--on-accent)`, PL, responsywna tabela.
- [x] C-40/C-41 — routing DB-driven (dispatch/reasoning), klucz Anthropic szyfrowany/maskowany.
- [x] C-53 — brak nowych zależności i modułu; rozbudowa istniejących plików; fast-path reużywa akcje.
