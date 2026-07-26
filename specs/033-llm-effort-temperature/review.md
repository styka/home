# Recenzja: Effort i temperature modeli LLM + tryb „maksymalny" asystenta

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-07-26
- **Diff:** `origin/develop..HEAD` — 19 plików, +1343 / −42 (z czego ~770 linii to artefakty pipeline'u)

Recenzja celowała w to, czego `verify.md` nie mógł pokazać: ścieżki **poza** główną pętlą agenta
(strumień, cache) i kompletność obietnicy z AC-8. Trzy ustalenia naprawione w trakcie recenzji.

---

## Ustalenia

### 1. Ścieżka STRUMIENIOWA nie miała degradacji przy 400 — NAPRAWIONE ✅
- **Plik:** `src/lib/llm/chat.ts` (`chatStream`)
- **Kategoria:** correctness
- **Opis:** Degradację „400 za parametr wysiłku → jedna próba bez niego" wpiąłem tylko w
  `chatComplete`. `chatStream` buduje ciała tymi samymi funkcjami (`openAiBody`/`anthropicBody`), więc
  **też** wysyła wysiłek — ale bez siatki bezpieczeństwa.
- **Scenariusz awarii:** admin ustawia wysiłek „średni" dla typu operacji `generation`; model
  przypisany do tego typu okazuje się go nie przyjmować. Wywołanie strumieniowe
  (`/api/llm/notes/qa`, `/api/llm/tasks/suggest`) dostaje 400, który jako **nieprzejściowy** przerywa
  łańcuch (`if (!isRetryableLlmStatus) break`) → użytkownik widzi błąd w Q&A notatek i w
  podpowiedziach zadań, mimo że sama funkcja jest sprawna. Dokładnie ten scenariusz spec wymieniał
  jako główne ryzyko — tylko ja zabezpieczyłem połowę wejść.
- **Poprawka (naniesiona):** ta sama degradacja w pętli `chatStream`, z tym samym warunkiem
  (`resolveEffort(cfg, opts) !== "none" && isEffortRejection(...)`) i tym samym logiem ostrzegawczym.

### 2. Klucz cache pomijał wysiłek — NAPRAWIONE ✅
- **Plik:** `src/lib/llm/chat.ts` (`cacheKeyFor`)
- **Kategoria:** correctness
- **Opis:** Klucz składał się z `op/messages/temperature/maxTokens/json` — bez wysiłku.
- **Scenariusz awarii:** admin podnosi wysiłek dla `dispatch` z „brak" na „wysoki", żeby poprawić
  jakość np. parsowania zadań (`/api/llm/tasks/parse` woła z `cache: true`). Dla tego samego tekstu
  w tym samym dniu klucz cache się **nie zmienia**, więc wraca stara odpowiedź policzona **bez**
  wysiłku — admin ma prawo myśleć, że ustawienie nie działa, i nie ma jak tego odróżnić od awarii.
- **Poprawka (naniesiona):** `effort: chain[0] ? resolveEffort(chain[0], opts) : "none"` w kluczu.
  Zmiana ustawienia unieważnia wpisy z poprzedniego poziomu.

### 3. AC-8 był spełniony tylko w połowie — NAPRAWIONE ✅
- **Pliki:** `src/actions/llmConfig.ts` (`AiCallLogRow`, `getRecentAiCalls`),
  `src/lib/ai/aiCallLog.ts`, `src/components/admin/AiCallsPage.tsx`
- **Kategoria:** correctness (niedomknięte kryterium akceptacji)
- **Opis:** Kolumnę `AiCall.effort` zapisywałem (i `verify.md` to potwierdził **na poziomie bazy**),
  ale nic jej nie **pokazywało**: `getRecentAiCalls` jej nie selektowało, `aiCallsToText` nie miało
  kolumny, tabela w `/admin/ai-calls` też nie. AC-8 mówi wprost „administrator **może potwierdzić**
  w diagnostyce, z jakim poziomem wysiłku operacja została wykonana" — dane w bazie, których nikt nie
  widzi, tego nie spełniają.
- **Scenariusz skutku:** admin ustawia wysiłek, chce sprawdzić, czy zadziałał, otwiera diagnostykę —
  i nie ma tam tej informacji; jedyną drogą byłoby zapytanie SQL do bazy produkcyjnej.
- **Poprawka (naniesiona):** `effort` w DTO + `select`, nowa kolumna „wysiłek" w tabeli
  (`LLM_EFFORT_LABELS`, `var(--accent-purple)`, „—" gdy parametr nie był wysłany) i w formatterze
  tekstowym — czyli **także w zgłoszeniu błędu z czatu**, które ten sam formatter wykorzystuje.

### 4. Martwe pole `AssignmentDTO.providerKind` — NAPRAWIONE ✅ (ustalenie z `verify.md`)
- **Plik:** `src/actions/llmConfig.ts`
- **Kategoria:** simplification (C-53)
- **Opis:** Dodałem `providerKind` do DTO (wraz z `include: { provider: … }` w zapytaniu), ale panel
  liczy rodzaj dostawcy z **aktualnie wybranego** dostawcy w wierszu — tylko to daje reaktywność
  przed zapisem. Pole nie było używane nigdzie.
- **Poprawka (naniesiona):** pole i `include` usunięte; panel bez zmian (już korzystał z właściwego
  źródła).

### 5. Rezerwacja TPM nie uwzględnia budżetu myślenia — świadomie bez zmian
- **Plik:** `src/lib/llm/chat.ts` (`reserveTpm`, `requestExceedsModelLimit`)
- **Kategoria:** correctness (nieaktywne w praktyce)
- **Opis:** Pacing pod limit TPM liczy `promptTokens + (opts.maxTokens ?? cfg.maxTokens ?? 1024)`,
  a `applyEffort` może podnieść realny `max_tokens` (do 13312 przy wysokim wysiłku) — rezerwacja
  byłaby wtedy zaniżona.
- **Dlaczego nie ruszam:** `max_tokens` podnosi **wyłącznie** gałąź Anthropic, a pacing TPM włącza się
  tylko dla `groq.com` (`isTpmLimitedProvider`). Te dwa warunki wykluczają się, więc dziś nie ma
  ścieżki, na której to zaszkodzi. Gdyby ktoś w przyszłości dołożył podnoszenie `max_tokens` dla
  dostawcy zgodnego z OpenAI, trzeba będzie przekazać efektywny limit do `reserveTpm` — odnotowane
  tutaj, żeby nie było niespodzianką.

### Sprawdzone i **bez** zastrzeżeń

- **`resolveEffort` i wartość `"none"`** — `if (opts.effort) return opts.effort` przepuszcza
  `"none"` (niepusty string), więc ścieżka degradacji (`effort: "none"`) faktycznie wyłącza parametr,
  zamiast wracać do konfiguracji admina. Sprawdzone uruchomieniem.
- **Tryb maksymalny nie wybiera modelu** (C-40) — `boostEffort` podnosi `cfg.effort`, czyli to, co
  ustawił admin; `effectiveOperation("reasoning","max")` zwraca `reasoning` bez zmiany przypisania.
- **Anthropic nadal bez `temperature`** — `anthropicBody` jej nie dokłada, a `supportsTemperature`
  tylko *opisuje* ten fakt dla UI. Lekcja 026 nietknięta.
- **Bloki `thinking` nie wyciekają** — `anthropicComplete` filtruje po `type === "text"`, strumień
  przepuszcza tylko delty z polem `text`. Powód zapisany w komentarzu przy `anthropicBody`, żeby
  nikt tego nie „uprościł" w drugą stronę.
- **Walidacja przed zapisem** — wszystkie trzy `throw` w `setAssignment` są **przed** `upsert`, więc
  błędna wartość nie nadpisuje działającej konfiguracji; `revalidatePath` i `logAudit` na miejscu.
- **Migracja** — addytywna, idempotentna (`ADD COLUMN IF NOT EXISTS`), zgodna 1:1 ze `schema.prisma`,
  numer z `next:migration`; `AssistantPref.level` świadomie **bez** migracji (kolumna `String`).
- **C-30/C-31/C-32** — kolory wyłącznie ze zmiennych CSS (`LEVEL_COLORS`, `var(--accent-purple)`),
  siatka `grid-cols-1 md:grid-cols-3`, wszystkie teksty po polsku.
- **Brak nowych zależności npm.** Zero zmian w `package.json`.

---

## Bramki po naniesionych poprawkach

| Komenda | Wynik |
|---|---|
| `npm run check:migrations` | ✅ |
| `npm run check:actions` | ✅ 160/160 z kontraktem |
| `npm run check:access` | ✅ 497 akcji z zakresem i guardem |
| `next lint --dir src` | ✅ 0 błędów |
| `npm run test:unit` | ✅ **494 pass / 0 fail** |
| `npx next build` | ✅ przeszedł |

---

## Werdykt

**APPROVE Z UWAGAMI**

Cztery ustalenia naprawione w recenzji — z czego trzy realnie zmieniają zachowanie: degradacja przy
400 obejmuje teraz **oba** wejścia (jednorazowe i strumieniowe), zmiana wysiłku unieważnia cache, a
poziom wysiłku jest **widoczny** w diagnostyce, więc AC-8 jest domknięte naprawdę, a nie tylko w
bazie. Piąte ustalenie (rezerwacja TPM) jest dziś nieaktywne i udokumentowane na przyszłość.

Zmiana realizuje zgłoszenie w całości: admin ustawia wysiłek, temperaturę i limit odpowiedzi per typ
operacji, panel uczciwie mówi, czego dany model nie obsłuży, a użytkownik ma trzeci — droższy —
poziom pracy asystenta. Domyślny stan po wdrożeniu to „brak wysiłku", czyli zachowanie identyczne
jak przed zmianą; nic nie zaczyna kosztować więcej bez świadomej decyzji.

Uwagi z `verify.md` pozostają aktualne: warto raz kliknąć zapis z błędną temperaturą (walidacja) i
sprawdzić wpis w `/admin/audit`, a realny efekt wysiłku zobaczysz dopiero na modelu, który go
obsługuje (Claude 4/5 albo model rozumujący zgodny z OpenAI) — dla domyślnego Groq/llama panel
powie wprost, że ustawienie zostanie pominięte.
