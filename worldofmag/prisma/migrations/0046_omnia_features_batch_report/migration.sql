-- Raport implementacji 2026-05-30 (batch: zarządzanie modelami LLM, Nauka języków, Zdrowie)
-- → widoczny w /admin/reports oraz /reports. INSERT idempotentny: ON CONFLICT (slug) DO NOTHING.
-- Uwaga: slug 'omnia-implementacja-2026-05-30' jest już zajęty (migracja 0041), dlatego ten
-- raport ma własny, unikalny slug.

INSERT INTO "Report" ("id", "title", "slug", "content", "category", "authorId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Omnia — Raport implementacji 2026-05-30 (LLM, Nauka języków, Zdrowie)',
  'omnia-implementacja-2026-05-30-llm-nauka-zdrowie',
  $omnia_batch_2026_05_30$# Omnia — Raport implementacji 2026-05-30

Sesja zrealizowała trzy zgłoszenia: rozbudowę zarządzania modelami LLM oraz dwa nowe działy —
Nauka języków i Zdrowie. Kolejność prac: najpierw warstwa LLM (bo korzysta z niej generator słówek),
potem moduły funkcjonalne.

## Rozbudowa zarządzania modelami LLM
**Diagnoza:** Cała aplikacja była na sztywno podpięta do Groq — każda z 23 tras `/api/llm/**`
samodzielnie czytała `Config.groq_api_key` i wołała `https://api.groq.com/...` z zaszytą nazwą modelu.
Nie dało się użyć innego modelu/dostawcy ani różnicować modeli wg rodzaju zadania.

**Rozwiązanie:** Rozbicie użycia LLM na **typy operacji wg charakteru zadania** (a nie wg modułu),
zgodnie z decyzją: `dispatch` (szybkie parsowanie), `reasoning` (myślenie/agent/planowanie),
`vision` (analiza obrazów/OCR), `generation` (dłuższe generowanie). Każdy typ ma w panelu admina
przypisany model + dostawcę z własnym tokenem; jeden dostawca może obsługiwać wiele typów. Wprowadzono
wspólny interfejs `chatComplete`/`chatStream`, który tłumaczy jednolite wiadomości w stylu OpenAI na
format konkretnego dostawcy: **OpenAI-compatible** (Groq, OpenAI, xAI, OpenRouter…) oraz **natywny
Anthropic** (Messages API — system osobno, obrazy jako base64, streaming przepisywany na zdarzenia
w stylu OpenAI, by front nie wymagał zmian). Powód takiego podziału: granularność po „rodzaju myślenia"
jest stabilniejsza niż po module i pozwala kierować np. OCR do modelu wizyjnego, a planowanie do
mocniejszego modelu — niezależnie od tego, który dział je wywołał. Migracja danych (0043 + idempotentny
seed w `migrate.js`) tworzy domyślnego dostawcę „Groq" z dotychczasowego klucza i ustawia wszystkim
typom obecne modele Groq, więc zmiana jest bezinwazyjna. `resolver.ts` ma fallback do starego
`groq_api_key`, co gwarantuje działanie nawet przed zaseedowaniem.

**Zmienione pliki:**
- `src/lib/llm/operationTypes.ts` — definicja typów operacji + domyślne modele.
- `src/lib/llm/resolver.ts` — rozwiązywanie konfiguracji (przypisanie → dostawca; fallback do Groq).
- `src/lib/llm/chat.ts` — wspólny `chatComplete`/`chatStream` (OpenAI-compatible + Anthropic, obrazy, streaming).
- `src/app/api/llm/**/route.ts` (21 tras) — użycie wspólnego interfejsu zamiast hardcode Groq; zachowane prompty/temperatury/limity.
- `src/actions/llmConfig.ts`, `src/app/admin/llm/page.tsx`, `src/components/admin/LlmConfigPanel.tsx` — panel: CRUD dostawców (maskowane tokeny) + przypisanie modelu do typu.
- `src/app/admin/config/page.tsx` — link do nowego panelu LLM.
- `prisma/schema.prisma` (modele `LlmProvider`, `LlmAssignment`), `prisma/migrations/0043_llm_model_management`, `scripts/migrate.js` (seed domyślnych).

## Dział „Nauka języków"
**Diagnoza:** Brak narzędzia do nauki słownictwa. Potrzeba: wygenerować listę słówek z dowolnego
tekstu (np. kodu, który programista przygotowuje pod demo) i uczyć się ich algorytmem, który pilnuje
słów idących najgorzej, ale nie pozwala zapomnieć pozostałych.

**Rozwiązanie:** Talie słówek (`LanguageDeck`) z kartami (`Vocabulary`). Słówka można dodać ręcznie
lub wygenerować z tekstu — nowa trasa `/api/llm/languages/extract` (typ operacji `generation`) wyciąga
przydatne słownictwo w języku docelowym wraz z tłumaczeniem, przykładem i częścią mowy. Nauka opiera
się na **SuperMemo-2** (`src/lib/srs.ts`): ocena < 3 zeruje powtórki i sprowadza kartę „na jutro"
(słowa trudne wracają szybko), a ocena ≥ 3 wydłuża interwał wg współczynnika łatwości — karty dobrze
opanowane dostają długie odstępy, ale **zawsze mają termin powtórki**, więc nie są zapominane. To
bezpośrednio realizuje wymaganie „obserwuje najgorsze, nie zapomina reszty". SM-2 wybrano, bo jest
sprawdzony, deterministyczny i nie wymaga zależności zewnętrznych. Tryb nauki jest klawiaturowy
(spacja odsłania, 1–4 oceniają) — spójnie z resztą aplikacji.

**Zmienione pliki:**
- `src/lib/srs.ts` — algorytm SM-2 + opcje ocen.
- `src/app/api/llm/languages/extract/route.ts`, `src/lib/llm-client.ts` — generowanie słówek z tekstu.
- `src/actions/languageDecks.ts` — CRUD talii/słówek, `getDueCards`, `submitReview`.
- `src/components/languages/*` (LanguagesHomePage, DeckPage, StudySession, LanguagesSideNav), `src/app/languages/**` — UI i trasy.
- `prisma/schema.prisma` (modele `LanguageDeck`, `Vocabulary`), `prisma/migrations/0044_language_learning`, `src/lib/permissions.ts` (`module.languages`), `src/components/shell/ModuleSidebar.tsx`.

## Dział „Zdrowie"
**Diagnoza:** Brak miejsca na wizyty u lekarzy i badania z terminami, statusami i wynikami.

**Rozwiązanie:** Jeden model `HealthEvent` z dyskryminatorem `kind` (`VISIT`|`TEST`) zamiast dwóch
osobnych encji — wizyty i badania dzielą prawie wszystkie pola (termin, status, miejsce, lekarz/placówka,
notatki), a badania korzystają dodatkowo z `result` i `referral`. Jedna lista, jeden formularz z
przełącznikiem typu — podejście minimalne („unix-owe") i łatwe w utrzymaniu (konwencja String zamiast
enuma, zgodnie z resztą projektu). UI grupuje wpisy na nadchodzące/minione, filtruje po typie i pozwala
cyklicznie zmieniać status; terminy przez natywny `datetime-local`. Własność user/zespół wg wspólnego
wzorca (`ownerId`/`ownerTeamId` + `getUserTeamIds`).

**Zmienione pliki:**
- `src/actions/health.ts` — CRUD + `setHealthStatus`, kontrola dostępu, bezpieczne parsowanie dat.
- `src/components/health/HealthHomePage.tsx`, `src/app/health/page.tsx` — UI i trasa.
- `prisma/schema.prisma` (model `HealthEvent`), `prisma/migrations/0045_health_module`, `src/lib/permissions.ts` (`module.health`), `src/components/shell/ModuleSidebar.tsx`.

## Podsumowanie
Zrealizowano 3 zadania: cross-cutting refaktor LLM (per-typ operacji, multi-dostawca z natywnym
Anthropic) oraz dwa nowe działy (Nauka języków z SRS, Zdrowie). Główne obszary zmian: nowa warstwa
`src/lib/llm/` i migracja 21 tras AI, dwa komplety modeli/akcji/UI wpięte we wzorzec architektury
(gating `module.*` dla ADMIN, własność user/zespół, server actions z `revalidatePath`, motyw na
zmiennych CSS). Trzy migracje schematu (0043–0045) + raport (0046). `next build` przechodzi
(`✓ Compiled successfully`). Uwagi utrzymaniowe: nowe modele LLM dodaje się jako kolejnych dostawców
w `/admin/llm` (bez zmian w kodzie); przy dokładaniu tras AI należy nadać im właściwy `op`, a nie
zaszywać modelu.
$omnia_batch_2026_05_30$,
  'general',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
