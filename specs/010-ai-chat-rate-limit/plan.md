# Plan techniczny: Odporność asystenta AI na limity szybkości (rate limit / 429)

- **Spec:** ./spec.md (010-ai-chat-rate-limit)
- **Status:** draft
- **Data:** 2026-07-19

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

> **Aktualizacja 2026-07-19 (C-54) — druga iteracja po testach:** dodano usunięcie **przyczyny pętli**
> agenta dla zapytań o tagi oraz redukcję rezerwacji `max_tokens`:
> - `src/lib/ai/agentTools.ts` — `list_tasks`: nowy arg `tag` (filtr
>   `tags: { some: { tag: { name: { contains, mode:"insensitive" } } } }`) + pole `tags` w wyniku;
>   opis w `READ_TOOLS_PROMPT` zaktualizowany. (AC-7)
> - `src/app/api/llm/home/agent/route.ts` — `AGENT_MAX_TOKENS=1200` domyślnie, `REPORT_MAX_TOKENS=2800`
>   tylko gdy tekst prośby wygląda na raport; `callAgent`/`runAgentLoop` przyjmują `maxTokens`. (AC-8)
> Bez zmian schematu (tagi już istnieją: `TaskTaskTag`/`TaskTagDef`).

## 1. Podejście (2–4 zdania)
Zmiana leży wyłącznie w **warstwie obsługi błędów LLM** — brak nowego modułu, modelu danych i UI.
Wzorcem jest istniejący łańcuch fallbacku (Z-133) w `src/lib/llm/chat.ts` oraz obecna obsługa błędu w
pętli agenta (`src/app/api/llm/home/agent/route.ts`). Robimy dwie rzeczy: (1) **ponawianie z backoff**
na poziomie pojedynczego wywołania dostawcy — wspólny owijacz `fetch`, który przy przejściowym błędzie
(429/5xx/sieć) czeka (respektując `Retry-After`) i próbuje ponownie, zanim odda sterowanie łańcuchowi
fallbacku; (2) **łagodny, polski komunikat** dla użytkownika, gdy limit trwa mimo prób — mapowany w
jednym miejscu w pętli agenta (obejmuje tryb zwykły i strumieniowy, bo oba przechodzą przez
`runAgentLoop`). Klient nie wymaga zmian — wyświetla tekst `error` zwrócony przez serwer.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** Feature nie dodaje ani nie zmienia modeli/kolumn — nie ma migracji.
(C-10/C-11/C-12 nie uruchamiają się; `npm run next:migration` niepotrzebne.)

## 3. Warstwa serwera (Server Actions — C-20)
**Nie dotyczy Server Actions.** Zmiana jest w:
- **`src/lib/llm/chat.ts`** — wspólny klient LLM (nie jest Server Action, brak `revalidatePath`; to
  warstwa integracji).
- **`src/app/api/llm/home/agent/route.ts`** — trasa API asystenta (Route Handler, nie akcja).

Brak mutacji danych → `revalidatePath`/guardy dostępu/`ownerId` nie dotyczą (C-20/C-21 poza zakresem).

### 3a. Ponawianie z backoff (`chat.ts`)
- Dodaj lokalny helper **`fetchWithRetry(url, init)`** (nieeksportowany), używany przez wszystkie
  cztery funkcje sięgające do dostawcy: `openAiComplete`, `anthropicComplete`, `openAiStream`,
  `anthropicStream`. Zastępuje w nich surowe `fetch(...)`.
- Logika `fetchWithRetry`:
  1. Wykonaj `fetch`. Jeśli **rzuci** (błąd sieci) — potraktuj jak przejściowe: odczekaj i ponów.
  2. Jeśli odpowiedź ma status **przejściowy** (`isRetryableLlmStatus`: 429 lub ≥500) i **nie**
     wyczerpaliśmy prób — odczytaj nagłówek **`Retry-After`** (sekundy albo data HTTP), policz czas
     oczekiwania, odczekaj (z **twardym capem** na pojedyncze oczekiwanie), zwolnij ciało poprzedniej
     odpowiedzi (`res.body?.cancel()`), ponów.
  3. Gdy `Retry-After` brak — użyj **rosnącego (wykładniczego) backoffu** z małym „jitterem".
  4. Zwróć **ostatnią** odpowiedź (ok albo nie-ok) — wywołujący dalej obsługuje `!res.ok` jak dziś
     (czyta `.text()` i zwraca `{ ok:false, status, message }`), więc łańcuch fallbacku Z-133 działa
     bez zmian.
- **Parametry (stałe w module, minimalizm C-53):**
  - `LLM_MAX_RETRIES = 2` (czyli do 3 prób łącznie na jeden model),
  - `LLM_RETRY_CAP_MS = 8000` (max pojedyncze oczekiwanie; gdy `Retry-After` > cap — nie czekamy tak
    długo: kończymy ponawianie tego modelu i oddajemy sterowanie łańcuchowi fallbacku / zwracamy błąd),
  - backoff bazowy `~600ms → ~1500ms` z jitterem, także capowany.
- **Ważne:** dla `Retry-After` uznawaj tylko rozsądne, dodatnie wartości; wartość spoza zakresu
  (ujemna/NaN/olbrzymia) → potraktuj jak brak nagłówka (użyj backoffu, z capem).
- Retry działa **per model w łańcuchu**: najpierw wyczerpujemy ponawianie bieżącego modelu, potem
  (jak dziś) `chatComplete`/`chatStream` przechodzą do kolejnego modelu na liście (AC-6 — fallback
  pozostaje).

### 3b. Łagodny komunikat (`agent/route.ts`)
- W `runAgentLoop`, w bloku `catch` wokół `callAgent` (obecnie zwraca `{ status, body: { error:
  e.message } }`), gdy `status === 429` — podmień `error` na **naszą, polską** treść (stała), np.:
  *„Asystent jest teraz przeciążony (chwilowy limit zapytań do modelu). Spróbuj ponownie za chwilę."*
  Nie przepisujemy surowej treści dostawcy (C-41 — brak wycieku klucza/surowego błędu).
- To jedno miejsce obsługuje **oba** tryby asystenta: zwykły (`return NextResponse.json(result.body…)`)
  i strumieniowy (SSE `send({ type:"final", status, body })`) — bo oba wywołują `runAgentLoop`, a klient
  wyświetla `body.error` tak samo (`AICommandSheet` linie ~821/830).
- Inne błędy (503 sieć, 502) zostawiamy bez zmian (poza zakresem speca).

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Asystent działa w `module.home`; nie dodajemy slugów, wpisów w `permissions.ts`,
`modules.tsx` ani `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
**Bez nowych komponentów ani tras.** Komunikat błędu renderuje istniejący `AICommandSheet`
(`error` → czerwony tekst, `var(--accent-red)`), tekst dostarcza serwer po polsku (C-32). Brak zmian
w motywie/mobile. **Nie zmieniamy klienta** — server-provided `error` już płynie do UI w obu trybach.

## 6. AI / integracje (C-23, C-40)
- **C-23:** brak nowej `AIAction` i read-toola → `check:actions` nieistotne.
- **C-40:** ponawianie i fallback **nie hardcodują** providera/modelu — działają na łańcuchu z
  `resolveLlmChain(op)` (DB-driven). `fetchWithRetry` operuje na już rozwiązanym `cfg` (dowolny
  dostawca OpenAI-compatible/Anthropic). Bez naruszenia routingu.
- Kalendarz/powiadomienia/auto-expense: nie dotyczy.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/lib/llm/chat.ts` | edycja | `fetchWithRetry` (backoff + `Retry-After`) i wpięcie w 4 funkcje dostawcy (AC-1, AC-2, AC-5, AC-6) |
| `worldofmag/src/app/api/llm/home/agent/route.ts` | edycja | mapowanie 429 w `runAgentLoop` → łagodny polski komunikat (AC-3, AC-4) |
| `doświadczenia.md` | edycja (dopisanie) | wpis-lekcja o obsłudze limitu 429/TPM (C-51) |

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie:** to zmiana czysto kodowa (bez migracji), więc weryfikacja idzie do kroku `next build`
  **bez** dotykania prod DB (C-13). Standup lokalnego Postgresa nie jest konieczny do zbudowania
  (build nie wymaga DB do `next build`; ostatni krok `migrate.js` pomijamy lokalnie — nie odpalamy
  pełnego `npm run build` z prod `DATABASE_URL`). Kompilację/typy sprawdzamy `next lint` + `tsc`/
  `next build` na etapie implementacji.
- `npm run check:migrations` — brak nowych migracji, przejdzie.
- `npm run check:actions` — brak nowych `AIAction`, przejdzie.
- **Mapowanie AC → weryfikacja:**
  - **AC-1/AC-2** (retry + `Retry-After`, ograniczone próby): przegląd kodu `fetchWithRetry` —
    ponawianie tylko dla statusów przejściowych, odczyt `Retry-After`, cap na oczekiwanie i twardy
    limit prób; ścieżka „429 raz, potem 200" kończy się sukcesem. (Opcjonalnie mały test jednostkowy z
    zamockowanym `fetch`, jeśli w repo jest runner — jeśli nie, weryfikacja przez rewizję.)
  - **AC-3** (łagodny komunikat, brak surowego tekstu): rewizja `runAgentLoop` — dla 429 zwracany jest
    nasz stały polski tekst; grep, że surowe „Rate limit reached" nie trafia do `body.error`.
  - **AC-4** (spójność SSE): oba tryby route’a używają `runAgentLoop`; ten sam `body.error` idzie w
    `type:"final"`. Rewizja ścieżki strumieniowej.
  - **AC-5** (brak ponawiania 4xx≠429): `isRetryableLlmStatus` już wyklucza 4xx poza 429; retry używa
    tej samej funkcji.
  - **AC-6** (fallback bez regresji): `chatComplete`/`chatStream` nadal iterują po `chain`; retry jest
    zagnieżdżony wewnątrz pojedynczego wywołania, nie zamiast pętli łańcucha.

## 9. Ryzyka techniczne i plan wycofania
- **Zbyt długie blokowanie żądania** przy dużym `Retry-After` → cap na pojedyncze oczekiwanie
  (`LLM_RETRY_CAP_MS`) i twardy limit prób; po przekroczeniu — fallback/łagodny komunikat.
- **Podwójne ponawianie** (retry w `fetchWithRetry` × iteracja łańcucha) mnożące czas → retry dotyczy
  tego samego modelu i jest krótkie/ograniczone; łańcuch i tak przechodzi dalej tylko dla błędów
  przejściowych. Świadomie akceptowane, bo Render to długo-żyjący Node (nie serverless z krótkim
  timeoutem).
- **Wyciek surowej treści dostawcy** → komunikat dla użytkownika jest naszym stałym tekstem (C-41).
- **Rollback:** zmiana wyłącznie w kodzie (2 pliki + log). Wycofanie = rewert commita; brak migracji,
  brak stanu do cofania (por. runbook devops — „code rollback").

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (brak zmian schematu; świadomie).
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — brak mutacji/akcji/AIAction; C-40 respektowany
  (routing DB-driven, brak hardcode modelu/providera); C-41 (brak wycieku surowego błędu/klucza).
- [x] C-30..C-32 (UX) — brak zmian UI; komunikat po polsku (C-32).
- [x] C-53 (minimalizm) — najmniejszy zestaw: jeden helper + jedno mapowanie komunikatu, zero nowych
  zależności, brak refaktorów „przy okazji".
- [x] C-50/C-52 — „gotowe" = zielony `next build`, potem merge do `develop`; C-51 — wpis do
  `doświadczenia.md`.
