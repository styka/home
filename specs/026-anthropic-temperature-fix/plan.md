# Plan techniczny: Naprawa czatu asystenta AI po wyborze dostawcy Anthropic (`temperature`)

- **Spec:** ./spec.md (026-anthropic-temperature-fix)
- **Status:** draft
- **Data:** 2026-07-23

> **Zasada planu:** to jest **JAK**, pod istniejący kod. Wzorzec do naśladowania: sama warstwa
> `src/lib/llm/chat.ts` (ścieżki `anthropicComplete` / `anthropicStream` vs. `openAiComplete` /
> `openAiStream`) i istniejące testy jednostkowe w `src/lib/llm/__tests__/`.

## 1. Podejście (2–4 zdania)
Przyczyna błędu jest w warstwie klienta LLM: obie anthropicowe ścieżki (`anthropicComplete` i
`anthropicStream` w `src/lib/llm/chat.ts`) zawsze wstawiają do ciała żądania pole
`temperature: opts.temperature ?? cfg.temperature ?? undefined`. Nowsze modele Anthropic (np.
`claude-sonnet-5`, Opus 4.x) odrzucają ten parametr błędem **400 „temperature is deprecated for this
model"**; ponieważ 400 to błąd nieprzejściowy (`isRetryableLlmStatus` → false), `chatComplete`
przerywa łańcuch fallbacku i cały agent pada. Naprawa jest punktowa i minimalna (C-53): **dla dostawcy
Anthropic nie wysyłamy pola `temperature`** — Messages API użyje wartości domyślnej. Ścieżka
OpenAI-compatible (Groq/OpenAI) pozostaje nietknięta.

## 2. Model danych (Prisma)
**Bez zmian w schemacie.** To naprawa warstwy integracyjnej LLM — brak nowych modeli/kolumn, brak
migracji (C-10..C-12 nie dotyczą). `LlmAssignment.temperature` (opcjonalna wartość ustawiana w panelu
admina) zostaje w bazie i nadal działa dla dostawców OpenAI-compatible; dla Anthropic po prostu nie
jest przekazywana do żądania.

## 3. Warstwa serwera (Server Actions — C-20)
**Nie dotyczy Server Actions.** Zmiana jest w bibliotece klienta LLM (`src/lib/llm/chat.ts`), której
używają trasy `/api/llm/*` (w tym `/api/llm/home/agent`). Brak `revalidatePath` (to nie mutacja danych).
Guard/własność (C-21) nie dotyczy — brak dostępu do danych użytkownika w tej warstwie.

**Konkret zmiany w `src/lib/llm/chat.ts`:**
1. Dodać mały helper decydujący, czy dla danej konfiguracji Anthropic wysłać `temperature`. Domyślne,
   odnotowane w specu założenie: **dla Anthropic nie wysyłamy `temperature` w ogóle** (odporne na
   wszystkie obecne i przyszłe modele — pominięty parametr nigdy nie powoduje 400; determinizm
   `dispatch`/JSON dla Anthropic i tak jest wymuszany promptem, nie parametrem). Realizacja: nie
   budować pola `temperature` w ciele żądania anthropicowego — analogicznie do tego, jak `json`/
   `response_format` jest pomijane dla Anthropic.
2. `anthropicComplete` (obecnie linia ~396): usunąć `temperature: opts.temperature ?? cfg.temperature ?? undefined`
   z obiektu `body`. Pole `max_tokens`, `system`, `messages` bez zmian.
3. `anthropicStream` (obecnie linia ~528): analogicznie usunąć `temperature: …` z obiektu `body`
   (zostaje `max_tokens`, `system`, `messages`, `stream: true`).
4. `openAiComplete` i `openAiStream`: **bez zmian** — nadal wysyłają
   `temperature: opts.temperature ?? cfg.temperature ?? undefined` (AC-4).

> Uwaga architektoniczna (C-40): warunek zależy od **rodzaju dostawcy** (`cfg.kind === "anthropic"` /
> osobna funkcja anthropicowa), nie od zaszytego na sztywno nazwiska providera czy modelu w logice
> operacji. Routing modeli pozostaje DB-driven przez resolver.

## 4. RBAC / rejestr modułu (C-22)
**Bez zmian.** Brak nowego slugu; korzysta z istniejących `module.home` (asystent) i `module.admin`
(panel LLM). Żadnych wpięć w `permissions.ts` / `modules.tsx` / `ModuleSidebar`.

## 5. UI (C-30, C-31, C-32)
**Bez zmian w UI.** Naprawa jest czysto backendowa (warstwa klienta LLM). Brak nowych tras/komponentów,
brak zmian motywu, brak zmian mobilnych. Komunikaty błędów użytkownika (już PL) pozostają bez zmian.

## 6. AI / integracje (C-23, C-40)
- **Brak nowej `AIAction`** i brak zmian w egzekutorze `/api/llm/home/execute` — nie zmieniamy zestawu
  akcji agenta, więc `check:actions` pozostaje zielone (C-23 nie dotyczy).
- **Routing (C-40):** bez zmian w `resolver.ts` — naprawiamy tylko budowę ciała żądania w ścieżce
  Anthropic w `chat.ts`.
- Kalendarz / powiadomienia / auto-expense: nie dotyczy.

## 7. Pliki do utworzenia / zmiany
| Plik | Akcja | Po co |
|------|-------|-------|
| `worldofmag/src/lib/llm/chat.ts` | edycja | Nie wysyłać `temperature` w żądaniach Anthropic (`anthropicComplete` + `anthropicStream`); ścieżka OpenAI bez zmian. |
| `worldofmag/src/lib/llm/__tests__/anthropicBody.test.ts` | nowy | Test jednostkowy sprawdzający budowę ciała żądania: dla Anthropic brak `temperature`, dla OpenAI-compatible `temperature` obecne. |
| `doświadczenia.md` (root) | edycja | Wpis-lekcja o parametrze `temperature` deprecated w nowych modelach Anthropic (C-51). |

> Jeśli funkcje budujące ciało żądania są dziś inline w `fetch(...)`, w ramach naprawy wyodrębnić
> budowę ciała (przynajmniej dla Anthropic) do testowalnej, czystej funkcji pomocniczej (np.
> `anthropicBody(cfg, opts)` / `openAiBody(cfg, opts)`), tak by test z tabeli mógł ją zweryfikować bez
> realnego `fetch`. To minimalna refaktoryzacja wyłącznie w służbie testu (C-53), nie zmienia
> zachowania sieciowego.

## 8. Bramki i weryfikacja (C-50)
- **Lokalnie:** `npm run test` (Vitest) dla nowego testu jednostkowego oraz istniejących testów LLM
  (`fallback.test.ts`, `rateLimitMessage.test.ts`, `tpmLimiter.test.ts`) — muszą przechodzić.
- `npm run check:migrations`, `npm run check:actions`, `next lint`, `next build` — do kroku
  `next build` (C-13: **nie** odpalać `migrate.js` / pełnego `npm run build` przeciw prod DB; brak
  zmian w migracjach, więc weryfikacja buildu wystarcza).
- **Mapowanie AC → weryfikacja:**
  - **AC-1** (Anthropic reasoning bez `temperature`) → test jednostkowy `anthropicBody.test.ts`:
    ciało żądania Anthropic **nie zawiera** klucza `temperature`, nawet gdy `opts.temperature` lub
    `cfg.temperature` jest ustawione.
  - **AC-2** (czat odpowiada) → wynika z AC-1 (usunięcie 400 przywraca łańcuch); weryfikacja manualna na
    `develop` po deployu (dostawca Anthropic ustawiony w panelu) — asystent odpowiada.
  - **AC-3** (streaming bez `temperature`) → test jednostkowy sprawdza również ciało dla ścieżki
    strumieniowej (ten sam builder ciała albo osobny przypadek `stream:true`).
  - **AC-4** (Groq/OpenAI bez regresji) → test jednostkowy: ciało żądania OpenAI-compatible **zawiera**
    `temperature` (gdy podane) — zachowanie niezmienione.
  - **AC-5** (dispatch/JSON dla Anthropic nadal OK) → wynika z AC-1 (brak `temperature` = brak 400);
    determinizm JSON dla Anthropic jest prompt-based, więc niezmieniony.

## 9. Ryzyka techniczne i plan wycofania
- **Ryzyko:** odpowiedzi Anthropic mają domyślną temperaturę zamiast ustawianej w panelu. →
  Akceptowalne: operacje reasoning/generation działają dobrze na domyślnej; determinizm dispatch jest
  prompt-based. Odnotowane w specu jako świadome założenie.
- **Ryzyko:** przypadkowa regresja ścieżki OpenAI. → Mityguje test AC-4 + brak dotknięcia funkcji
  `openAiComplete`/`openAiStream`.
- **Rollback:** czysto kodowy — rewert commita w `chat.ts` (brak migracji, brak zmian schematu).

## 10. Zgodność z konstytucją — checklista
- [x] C-10..C-14 (migracje) — **nie dotyczy** (bez zmian schematu); świadomie odnotowane.
- [x] C-20..C-25 (server/RBAC/AI/trash/audit) — nie dotyczy (zmiana w bibliotece LLM, nie w akcjach/RBAC).
- [x] C-30..C-32 (UX) — nie dotyczy (backend); teksty błędów PL pozostają.
- [x] C-40 (routing DB-driven) — zachowany; warunek zależy od rodzaju dostawcy, nie od hardcode.
- [x] C-41 (klucze/komunikaty) — bez logowania klucza; komunikaty bezpieczne.
- [x] C-51 (lekcja) — wpis do `doświadczenia.md` w zakresie.
- [x] C-53 (minimalizm) — najmniejsza zmiana (pominięcie jednego pola dla Anthropic + test); bez nowych
  zależności ani szerokiego refaktoru.
