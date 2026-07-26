# Zadania: Effort i temperature modeli LLM + tryb „maksymalny" asystenta

- **Plan:** ./plan.md (032-llm-effort-temperature)
- **Status:** done
- **Data:** 2026-07-26

> **Zasada listy zadań:** kolejność **od najłatwiejszego do najtrudniejszego** i **zgodna z
> zależnościami** (migracja → akcje → UI → AI → bramki). Każde zadanie jest małe, samodzielne i
> **weryfikowalne**. Odhaczamy `[ ]` → `[x]` w trakcie `/implement`. `[P]` = można zrównoleglić.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane (patrz notatka)
- `[P]` — niezależne od poprzedniego, można robić równolegle

---

## Faza 0 — Fundament danych

- [x] **T-1** — **Migracja `0210_llm_effort`.** Ręczny `migration.sql` wg planu §2.2: dwa
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS "effort" TEXT` (`LlmAssignment`, `AiCall`). Addytywna,
  nullable, bez backfillu.
  *Gotowe, gdy:* `npm run check:migrations` przechodzi i migracja aplikuje się na lokalnym Postgresie.

- [x] **T-2** — **`schema.prisma`.** Kolumny `effort String?` w `LlmAssignment` i `AiCall`, zgodne
  1:1 z DDL, z komentarzem wskazującym unię TS (C-12 — bez enuma Prisma).
  *Gotowe, gdy:* `npx prisma generate` czysto.

## Faza 1 — Rdzeń: skala wysiłku i tłumaczenie na dostawcę

- [x] **T-3** — **`src/lib/llm/effort.ts` — skala i pomocniki.** `LlmEffort`, `LLM_EFFORT_LEVELS`,
  `LLM_EFFORT_LABELS` (PL), `bumpEffort()` (o stopień, `high` → `high`), `parseEffort()` (walidacja
  wejścia z bazy/klienta).
  *Gotowe, gdy:* moduł kompiluje się, `bumpEffort` pokryty testem (AC-10).

- [x] **T-4** — **Tabela możliwości dostawców.** `effortSupported(kind, model)` (rodziny modeli wg
  planu §6.1) + `supportsTemperature(kind)` (Anthropic → `false`, zgodnie z istniejącą lekcją
  026-anthropic-temperature-fix).
  *Gotowe, gdy:* testy potwierdzają: `claude-sonnet-5` ✓, `claude-3-5-sonnet` ✗, `llama-3.3-70b` ✗,
  `gpt-5`/`o3`/`qwen3` ✓ (AC-3, AC-14).

- [x] **T-5** — **`applyEffort()` — tłumaczenie na parametr dostawcy.** Anthropic →
  `thinking:{type:"enabled",budget_tokens}` + podniesienie `max_tokens` do `budget + 1024`;
  `openai_compat` (rodzina rozumująca) → `reasoning_effort`; pozostałe → ciało **bez zmian**.
  `effort:"none"`/`null` → nigdy nic nie dokłada.
  *Gotowe, gdy:* testy dla wszystkich czterech przypadków przechodzą, w tym „ciało identyczne jak bez
  wysiłku" (AC-4, AC-5).

- [x] **T-6** — **`isEffortRejection(status, text)`** — rozpoznaje błąd 400 dotyczący parametru
  wysiłku (nazwy parametrów + typowe frazy dostawców), żeby dało się zdegradować zamiast wywalić
  agenta.
  *Gotowe, gdy:* test rozpoznaje 400 o `thinking`/`reasoning_effort` i **nie** myli go z innym 400.

## Faza 2 — Warstwa serwera: konfiguracja i zapis

- [x] **T-7** — **`resolver.ts`: przeniesienie wysiłku.** `ResolvedLlm.effort`; gałąź przypisania
  admina przenosi wartość z `LlmAssignment`, ogniwa fallbackowe dostają `null`.
  *Gotowe, gdy:* `resolveLlmChain` zwraca `effort` z konfiguracji, a fallbacki `null`.

- [x] **T-8** — **`llmConfig.ts`: DTO + zapis + walidacja.** `AssignmentDTO` dostaje `effort` i
  `providerKind`; `setAssignment` przyjmuje `effort` i **waliduje** (`effort` ∈ skala,
  `temperature ∈ [0,2]`, `maxTokens ∈ [1,32000]`) z polskimi komunikatami; opis w `logAudit`
  rozszerzony o ustawione parametry.
  *Gotowe, gdy:* niepoprawna wartość → wyjątek bez zapisu (AC-6), poprawna → wpis w `AuditLog` (AC-7).

- [x] **T-9** `[P]` — **Trzeci poziom asystenta w typach.** `AssistantLevel` + `"max"`,
  `ASSISTANT_LEVELS`, etykieta „Maksymalny" i opis mówiący wprost o wyższym koszcie.
  *Gotowe, gdy:* `updateAssistantPrefs({level:"max"})` zapisuje się, a `getAssistantPrefs` zwraca
  `max` (AC-12); zapis wartości spoza unii nadal odrzucany.

## Faza 3 — Wywołanie modelu

- [x] **T-10** — **`chat.ts`: wysiłek w obu ciałach żądania.** `ChatOptions.effort` + `boostEffort`;
  rozstrzyganie `opts.effort ?? cfg.effort ?? "none"` (z `bumpEffort` przy `boostEffort`);
  `applyEffort` wołane w `openAiBody` i `anthropicBody` — jedno miejsce dla trybu jednorazowego i
  strumieniowego.
  *Gotowe, gdy:* testy ciał żądania przechodzą; brak wysiłku = ciało jak dotąd (AC-4, AC-5, AC-10).

- [x] **T-11** — **Degradacja przy 400.** Gdy żądanie z wysiłkiem dostanie 400 rozpoznany przez
  `isEffortRejection`, wykonaj **jedną** ponowną próbę bez wysiłku na tym samym modelu.
  *Gotowe, gdy:* ścieżka degradacji działa i nie zmienia zachowania dla innych błędów 400.

- [x] **T-12** — **Parser odpowiedzi Anthropic przy rozszerzonym myśleniu.** Sprawdź, jak
  `anthropicComplete`/`anthropicStream` wyciąga tekst; jeśli bierze pierwszy blok bez sprawdzania
  typu — filtruj bloki `text` (blok `thinking` nie może trafić do treści odpowiedzi). Jeśli parser
  już filtruje — bez zmian, tylko odnotuj.
  *Gotowe, gdy:* wiadomo (i zapisane), że blok myślenia nie wycieka do odpowiedzi użytkownika.

- [x] **T-13** — **`usage.ts`: wysiłek w logu wywołań.** `AiCallEntry.effort` → kolumna
  `AiCall.effort`; `chat.ts` przekazuje faktycznie użyty poziom (po degradacji — ten realny).
  *Gotowe, gdy:* po wywołaniu z wysiłkiem wiersz `AiCall` ma wypełnioną kolumnę (AC-8).

## Faza 4 — Tryb maksymalny asystenta

- [x] **T-14** — **`operationTypes.ts`: obsługa `max`.** `effectiveOperation`: `economy` → `dispatch`
  (bez zmian), `max` → `op` bez zmian; nowy `effortForLevel(base, level)`.
  *Gotowe, gdy:* testy potwierdzają oba przejścia.

- [x] **T-15** — **`agent/route.ts`: tryb `max`.** W trybie maksymalnym `primaryOp` to **zawsze**
  `reasoning` (znika zejście na tańszy model przy prostych pytaniach) i przekazywana jest flaga
  podniesienia wysiłku do `chatComplete`.
  *Gotowe, gdy:* AC-11 spełnione (przegląd kodu + log `AiCall` pokazuje model rozumowania i podniesiony
  wysiłek).

## Faza 5 — Interfejs

- [x] **T-16** — **Panel administratora: trzy kontrolki.** W `AssignmentRow` drugi wiersz siatki:
  wysiłek (lista PL), temperatura (liczba 0–2), limit odpowiedzi (liczba); siatka jednokolumnowa
  poniżej `md`; wyłącznie zmienne CSS.
  *Gotowe, gdy:* AC-1, AC-2 spełnione, wartości zapisują się i wracają po przeładowaniu.

- [x] **T-17** — **Informacja o możliwościach dostawcy.** Pod kontrolkami komunikat wyliczany na
  bieżąco z `effortSupported`/`supportsTemperature` (zmiana modelu w wierszu od razu go przelicza);
  nieobsługiwana kontrolka wyszarzona, ale edytowalna.
  *Gotowe, gdy:* AC-3 spełnione dla obu przypadków (model bez wsparcia wysiłku, dostawca Anthropic +
  temperatura).

- [x] **T-18** `[P]` — **Trzecia opcja w przełączniku asystenta.** Ikona i kolor dla „Maksymalny"
  (menu renderuje pętla po `ASSISTANT_LEVELS`, więc bez zmian w strukturze JSX).
  *Gotowe, gdy:* AC-9 i AC-13 spełnione — trzy opcje z opisami, dostępne dla każdego użytkownika.

## Faza 6 — Bramki i domknięcie

- [x] **T-19** — **Bramki lokalnie.** `npm run check:migrations`, `npm run check:actions`,
  `npm run check:access`, `npm run test:unit`, `next lint --dir src`, `npx next build` na **lokalnym**
  Postgresie (C-13 — bez `scripts/migrate.js`).
  *Gotowe, gdy:* wszystkie kroki zielone (AC-15).

- [x] **T-20** — **Dokumentacja.** `CLAUDE.md`: `effort` w opisie konfiguracji LLM (wraz z informacją,
  że możliwości zależą od rodziny modelu) + trzeci poziom pracy asystenta.
  *Gotowe, gdy:* opis zgadza się z kodem.

- [x] **T-21** — **Mapowanie AC → wynik** (input do `/verify`): dla każdego z AC-1..AC-15 wskazanie
  zadania i sposobu sprawdzenia.
  *Gotowe, gdy:* żaden AC nie zostaje bez pokrycia.

- [x] **T-22** — **Wpis(y) do `doświadczenia.md`** (C-51), jeśli po drodze wyjdzie nieoczywisty
  problem (kandydaci: wymóg `max_tokens > budget_tokens` u Anthropic, bloki `thinking` w odpowiedzi,
  400 jako błąd nieprzejściowy przerywający fallback).
  *Gotowe, gdy:* lekcje dopisane po polsku we właściwym formacie i zacommitowane z fixem.

---

## Mapowanie kryteriów akceptacji → zadania

| AC | Zadanie(a) |
|---|---|
| AC-1, AC-2 | T-16 |
| AC-3 | T-4, T-17 |
| AC-4 | T-5, T-10 |
| AC-5 | T-5, T-10 |
| AC-6 | T-8 |
| AC-7 | T-8 |
| AC-8 | T-13 |
| AC-9 | T-18 |
| AC-10 | T-3, T-10, T-14 |
| AC-11 | T-15 |
| AC-12 | T-9 |
| AC-13 | T-18 |
| AC-14 | T-4, T-5 |
| AC-15 | T-19 |

## Ścieżka krytyczna

`T-1 → T-2` — kolumny blokują wszystko, co je czyta/zapisuje.
`T-3 → T-4 → T-5` — skala blokuje tabelę możliwości, ta blokuje tłumaczenie na parametry.
`T-5 → T-10 → (T-11, T-13)` — tłumaczenie blokuje wpięcie w wywołanie, to degradację i log.
`T-7 → T-10` — resolver musi przenosić wysiłek, zanim `chat.ts` go użyje.
`T-8 → (T-16, T-17)` — DTO z `providerKind` blokuje komunikat o możliwościach w panelu.
`T-9 → T-18`, `T-14 → T-15` — trzeci poziom w typach blokuje UI i logikę agenta.
Wszystko zbiega się w **T-19** (bramki), potem T-20..T-22.

Zadania `[P]` (T-9, T-18) są niezależne od gałęzi „effort" — można je zrobić w dowolnym momencie.

## Notatki / blokady
- **T-12 rozstrzygnięte bez zmian w kodzie:** `anthropicComplete` filtruje bloki po
  `type === "text"`, a strumień przepuszcza tylko delty mające pole `text` — `thinking_delta` i
  `signature_delta` go nie mają. Bloki myślenia NIE mogą więc wyciec do odpowiedzi. Powód zapisany w
  komentarzu przy `anthropicBody`, żeby nikt tego nie „poprawił" w drugą stronę.
- **T-12 było jedynym zadaniem rozpoznawczym** — plan świadomie zostawia rozstrzygnięcie na kod, bo
  zależy od tego, jak istniejący parser Anthropic wyciąga tekst z odpowiedzi. Jeśli okaże się, że
  filtruje po typie bloku — zadanie kończy się notatką, bez zmian w kodzie.
