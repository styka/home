# Plan techniczny: Niezawodność i UX czatu asystenta AI

- **Spec:** ./spec.md (025-assistant-chat-reliability-ux)
- **Status:** draft
- **Data:** 2026-07-23

> **Zasada planu:** to jest **JAK**, pod istniejący kod. Naśladujemy wzorce już obecne w warstwie
> asystenta (specs 010/016/017 dołożyły retry, TPM-pacing, degradację modelu i uczciwe komunikaty —
> rozszerzamy je punktowo, bez nowych abstrakcji — C-53).

## 1. Podejście (2–4 zdania)
Trzy niezależne, chirurgiczne poprawki w istniejącej warstwie asystenta — **bez zmian schematu i bez
nowych zależności**. (A) rozszerzamy istniejący łańcuch fallbacku modeli i TPM-limiter o **limity
per-model** oraz **pomijanie modelu, w którym zapytanie i tak się nie zmieści**, plus lekkie
przycięcie promptu; (B) dokładamy **widoczny przycisk wysłania** do dymka `clarify`; (C) uczymy
read-toole zadań **rozwiązywać projekt po nazwie** (serwerowo, bez kosztu tokenów). Wzorzec do
naśladowania: `src/lib/llm/{chat,resolver,tpmLimiter}.ts` (A), `src/lib/ai/agentTools.ts` (C),
`src/components/home/AICommandSheet.tsx` (B).

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Feature jest wyłącznie kodowy (routing modeli, read-toole, UI). Brak
nowych modeli/kolumn → **brak migracji** (C-10 nie dotyczy).

## 3. Warstwa serwera (Server Actions — C-20)
Feature **nie dodaje mutacji danych** — nie ruszamy `src/actions/*` ani `revalidatePath`. Zmiany
serwerowe są w warstwie AI/LLM (poniżej), która respektuje istniejące reguły dostępu (C-21):
rozwiązywanie projektu po nazwie liczy tylko projekty dostępne dla użytkownika przez istniejący
`accessibleProjectIds(userId)` (już używany w `list_tasks`/`get_task`).

## 4. RBAC / rejestr modułu (C-22)
Bez zmian. Działamy w istniejącym `module.home`; brak nowego sluga, brak wpięć w `permissions.ts` /
`modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32) — Problem B
- **Plik:** `src/components/home/AICommandSheet.tsx`, blok renderujący `turn.kind === "clarify"`
  (obecnie: `turn.content` + chipy `options` + `SmartTextarea` z `onSubmit`, ale **bez widocznego
  przycisku** — stąd zgłoszenie „tylko skrót klawiszowy, na mobile się nie da").
- **Zmiana:** pod `SmartTextarea` dodać **widoczny przycisk „Wyślij"** (klikalny, `type=button`)
  wywołujący `onClarifySubmit(turn, clarifyInput)`. Przycisk:
  - kolory wyłącznie ze zmiennych CSS: tło `var(--accent-blue)`, tekst `var(--on-accent)` (C-30);
  - cel dotyku ≥ `py-3` (mobile-first, C-31); ikonka wysyłki (Lucide, spójnie z resztą);
  - `disabled`, gdy `clarifyInput.trim()` puste (unika pustych wysyłek);
  - tekst po polsku „Wyślij" (C-32).
- **Zachowujemy** dotychczasowe ścieżki: chipy opcji (`onClarifySubmit(turn, opt)`), zatwierdzanie
  klawiaturą (`SmartTextarea onSubmit`), dyktowanie głosem. Bez zmian w desktop/mobile layoutach poza
  tym jednym dymkiem (żadnych dwóch sidebarów itp.).

## 6. AI / integracje (C-23, C-40)

### 6A. Problem C — rozwiązywanie projektu po nazwie (`src/lib/ai/agentTools.ts`)
- **Nowy helper** `resolveProjectRef(userId, ref): Promise<{ id: string } | { unresolved: string; available: string[] }>`:
  1. jeśli `ref` pasuje do **id** wśród `accessibleProjectIds(userId)` → zwróć ten id (kompatybilność
     wstecz, AC-2 „prawdziwe id działa jak dotąd");
  2. inaczej dopasuj **po nazwie** wśród dostępnych projektów, bez rozróżniania wielkości liter:
     najpierw dokładne (`equals … mode:"insensitive"`), potem **jednoznaczne** częściowe (`contains`);
  3. brak dopasowania **lub** wiele częściowych → `{ unresolved: ref, available: [nazwy] }`.
- **Wpięcie w `list_tasks`:** parametr `projectId` interpretujemy jako **id albo nazwę**. Gdy podany:
  - rozwiązany → `where.projectId = <realne id>` (AC-1: zadania z „LZ" faktycznie wracają);
  - nierozwiązany → **rzucamy `Error`** z czytelnym komunikatem PL zawierającym listę dostępnych nazw
    („Nie znaleziono projektu o nazwie »LZ«. Dostępne projekty: …. Doprecyzuj albo użyj list_projects.").
    `runReadTool` łapie wyjątki i zwraca `{ error }` w wynikach narzędzia → agent dostaje sygnał i robi
    `clarify`/`answer` zamiast cicho zwracać pustą listę (AC-2).
    > **Korekta C-54 (podczas implementacji):** `get_task` przyjmuje tylko `taskId`/`search` — NIE ma
    > parametru projektu, więc rozwiązywanie nazwy dotyczy **wyłącznie `list_tasks`** (jedyna ścieżka z
    > wszystkich zgłoszeń). Nie dokładamy `projectId` do `get_task` (minimalizm C-53, żadne AC tego nie
    > wymaga).
- **Prompt (`READ_TOOLS_PROMPT`, wiersz `list_tasks`):** dopisać jedno zdanie: „`projectId` może być
  identyfikatorem **albo nazwą** projektu (dopasowanie bez rozróżniania wielkości liter)". To zero-koszt
  po stronie tokenów agenta (nie wstrzykujemy listy projektów do kontekstu — rozwiązanie jest serwerowe,
  co współgra z celem redukcji rozmiaru z Problemu A).
- **Bez nowej `AIAction`** (to odczyt, nie mutacja) → manifest `action-coverage.json` i bramka
  `check:actions` bez zmian (C-23 spełnione trywialnie).

### 6B. Problem A — limity i rozmiar zapytania (`src/lib/llm/{tpmLimiter,chat}.ts`, `agent/route.ts`)
Routing pozostaje **DB-driven** (C-40) — nie hardcodujemy providera/modelu w funkcjach; zmieniamy tylko
warstwę wspólną `lib/llm/*`, przez którą przechodzi każdy model z łańcucha.

- **AC-5 — limity per-model + pomijanie modelu, który i tak nie zmieści zapytania** (`tpmLimiter.ts` + `chat.ts`):
  - w `tpmLimiter.ts` dodać mapę **TPM per model** (`llama-3.3-70b-versatile → 12000`,
    `llama-3.1-8b-instant → 6000`, domyślnie `DEFAULT_TPM`) i eksport `modelTpmLimit(model)`;
    `reserveTpm` używa limitu **danego modelu** (dziś flat 12000 dla wszystkich — przez to 7,5k-tokenowy
    request przechodził rezerwację i lądował na 8b z limitem 6000 → 413).
  - w `chat.ts` (`chatComplete`, gałąź Groq/`openai_compat` z TPM-limited providerem): **przed**
    wysłaniem policzyć szacunek tokenów zapytania (`estimateTokens` + zarezerwowany `maxTokens`); jeśli
    przekracza użyteczny cap `modelTpmLimit(model)` → **pomiń ten model** (nie wysyłaj requestu, który
    może zwrócić tylko 413), przejdź do kolejnego ogniwa łańcucha i **zachowaj poprzednią, realną
    porażkę** jako `last`. Efekt: 7,5k-tokenowy request nie trafia na model 6000 TPM (AC-5), a
    użytkownik dostaje **uczciwy** komunikat z modelu 70b (wyczerpany limit dzienny), nie mylące
    „Request too large" (poprawia też AC-4).
  - jeśli **wszystkie** modele w łańcuchu zostaną pominięte jako za małe → zwróć czytelny błąd
    „Zapytanie było zbyt duże dla dostępnych modeli…" (PL, bez surowej treści dostawcy — C-41).
- **AC-4 — uczciwy komunikat + zachowanie tury** (`agent/route.ts` blok `catch` w `runAgentLoop`,
  `chat.ts`):
  - dołożyć klasyfikację **413 / „request too large"** → dedykowany komunikat PL („Zapytanie było zbyt
    duże — spróbuj krócej/prościej."), obok istniejącego rozpoznania limitu 429 (dzienny/minutowy).
  - **strona klienta już to spełnia**: `handleSend` wypycha wiadomość użytkownika jako `turn` i czyści
    pole; przy błędzie `setError(...)` pokazuje komunikat, a `retryLast()`/przycisk „Ponów"
    (`lastPayloadRef`) pozwala powtórzyć **bez przepisywania** polecenia. Zmiana kliencka: **żadna albo
    kosmetyczna** (potwierdzić w /verify, że tekst nie znika — obecny kod to gwarantuje).
- **AC-6 — mniejszy prompt** (`agent/route.ts`):
  - w `pushTrimmedHistory()` dołożyć **budżet znakowy** na wstrzykiwaną historię (np. ~2500 znaków)
    obok `MAX_HISTORY_MESSAGES` oraz obniżyć `MAX_HISTORY_MESSAGES` (12 → 8), żeby długie rozmowy nie
    rozsadzały okna. Katalog akcji i read-toole są **już** zawężane przez router modułów
    (`buildReadToolsPrompt`/`buildActionCatalog(modules)`) — nie ruszamy ich, by nie stracić
    poprawności odczytu zadań (AC-1). Cel: typowe „wybierz 3 zadania…" mieści się w limicie bez błędu.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/llm/tpmLimiter.ts` | edycja | Limity TPM **per model** + `modelTpmLimit()`; `reserveTpm` capuje wg modelu (AC-5) |
| `src/lib/llm/chat.ts` | edycja | Pomijanie modelu, w którym zapytanie się nie zmieści; klasyfikacja 413; zachowanie uczciwej porażki (AC-4, AC-5) |
| `src/lib/ai/agentTools.ts` | edycja | Helper `resolveProjectRef` + rozwiązywanie projektu po nazwie w `list_tasks`/`get_task`; sygnał braku dopasowania; drobna zmiana promptu (AC-1, AC-2) |
| `src/app/api/llm/home/agent/route.ts` | edycja | Budżet znakowy + `MAX_HISTORY_MESSAGES` (AC-6); komunikat PL dla 413 w `catch` (AC-4) |
| `src/components/home/AICommandSheet.tsx` | edycja | Widoczny przycisk „Wyślij" w dymku `clarify` (AC-3) |
| `doświadczenia.md` | dopisanie | Lekcja po naprawie (C-51) |

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie** (C-13 — nigdy prod DB): brak migracji, więc wystarcza `next lint` + `next build`
  (kompilacja TS). Jeśli potrzebny pełny build z Prisma — lokalny Postgres wg CLAUDE.md; **nie**
  odpalać `scripts/migrate.js` z prod `DATABASE_URL`.
- `npm run check:actions` (brak nowej `AIAction` → przejdzie), `npm run check:migrations` (brak nowej
  migracji → przejdzie), `next lint`, `next build`.
- **Mapowanie AC → weryfikacja:**
  - **AC-1/AC-2** — analiza kodu `list_tasks`/`resolveProjectRef` + test ręczny/rozumowy: „LZ" nazwą →
    zadania wracają; nieistniejąca nazwa → `error` w wynikach → agent `clarify`; prawdziwe id → jak dotąd.
  - **AC-3** — inspekcja renderu dymka `clarify`: widoczny przycisk „Wyślij" wywołuje `onClarifySubmit`;
    chip i Enter działają nadal; kolory ze zmiennych CSS; `py-3`.
  - **AC-4** — 413/429 → komunikat PL; wiadomość użytkownika zostaje w wątku; „Ponów" powtarza payload.
  - **AC-5** — dla zapytania > limitu 8b, `chatComplete` **nie** wysyła go na 8b (pomija) i zwraca
    uczciwą porażkę z 70b; ścieżka rezerwacji capuje wg `modelTpmLimit`.
  - **AC-6** — porównanie rozmiaru wstrzykiwanej historii/promptu przed/po (mniejszy budżet znakowy,
    niższy `MAX_HISTORY_MESSAGES`); poprawność AC-1 zachowana.

## 9. Ryzyka techniczne i plan wycofania
- **Za agresywne pomijanie modeli** mogłoby zablokować odpowiedź, gdy wszystkie ogniwa uznamy za „za
  małe" → mitigacja: pomijamy tylko modele Groq z realnie mniejszym limitem niż rozmiar zapytania;
  gdy pominięto wszystkie, zwracamy jasny komunikat (nie cichą pustkę), a admin może ustawić większy
  model w `/admin/llm`.
- **Szacunek tokenów jest przybliżony** (`estimateTokens` ~4 znaki/token) → używamy istniejącego
  `CAP_RATIO`/marginesu z `tpmLimiter`, żeby nie odcinać zapytań tuż-pod-limitem.
- **Dopasowanie projektu po nazwie** — niejednoznaczność (kilka „LZ…") → celowo `unresolved` z listą,
  agent robi `clarify` (AC-2), nie zgadujemy.
- **Rollback:** czysto kodowy (brak migracji) — rewert commita/PR-a przywraca stan; żadnych zmian w
  bazie do cofania (por. runbook devops: rollback kodu bez rollbacku migracji).

## 10. Zgodność z konstytucją — checklista
- [x] **C-10..C-14 (migracje)** — brak zmian schematu, brak migracji (świadomie).
- [x] **C-20..C-25** — brak nowych mutacji/Server Actions; dostęp do projektów przez istniejący guard
  (`accessibleProjectIds`, C-21); brak nowej `AIAction` (C-23); routing DB-driven (C-40); klucze nadal
  szyfrowane/maskowane, nie logujemy surowej treści dostawcy (C-41).
- [x] **C-30..C-32 (UX)** — przycisk `clarify` na zmiennych CSS, mobile-first `py-3`, teksty PL.
- [x] **C-53 (minimalizm)** — trzy punktowe zmiany, bez nowych zależności ani „przy okazji" refaktorów;
  reużycie istniejącego łańcucha fallbacku, TPM-limitera i infry retry klienta.
- [x] **C-51** — po naprawie wpis do `doświadczenia.md`.
