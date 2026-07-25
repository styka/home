# Plan techniczny: Ujednolicenie UX dynamicznych sekcji akcji asystenta AI + zgłaszanie problemów z asystentem

- **Spec:** ./spec.md (029-assistant-dynamic-actions-ux)
- **Status:** draft
- **Data:** 2026-07-25

> **Zasada planu:** to jest **JAK**, pod istniejący kod. Feature jest w ~95% frontendowy
> (`src/components/home/AICommandSheet.tsx`) + drobne rozszerzenie telemetrii kosztu w trasie agenta i
> w akumulatorze zużycia. **Bez zmian schematu, bez migracji, bez nowej `AIAction`, bez nowego slugu RBAC.**

## 1. Podejście

Wzorzec do naśladowania = sam istniejący `AICommandSheet.tsx` (nie ma bliższego „sąsiada" — to unikalny
komponent czatu). Zmieniamy go punktowo, zachowując konwencje pliku (inline style ze zmiennych CSS,
`Turn` jako union, `TurnView` jako renderer). Kluczowe decyzje:
1. **Scalenie sekcji akcji** — zamiast po wykonaniu dopisywać osobną turę `results`, wynik + „Cofnij"
   wchodzą **do tej samej tury `plan`** (rozszerzonej o `results`/`undone`), renderowane inline w bąbelku
   planu. Dotyczy każdej dynamicznej sekcji akcji (plan z tekstu i plan z obrazu) — globalnie (AC-14).
2. **Stopka** — jeden wiersz: akcje (Kopiuj / ikona-Odczytaj bez labelki / Ponów) + po prawej **sama
   kwota** kosztu; klik w kwotę rozwija panel rozbicia per wywołanie modelu.
3. **Koszt** — `UsageMeter` już sumuje koszt ze wszystkich wywołań; dokładamy **listę wywołań** (`calls[]`),
   żeby panel szczegółów pokazał rozbicie (model/tokeny/koszt) i sumę zgodną z kwotą w stopce.
4. **Logi rozumowania → tylko admin** (`ReasoningLog` gated `isAdmin`); usuwa to duplikację „ładny opis +
   brzydkie logi" dla zwykłego usera.
5. **Robaczek asystenta dostępny dla wszystkich**; poprawka tekstów; prefiksy emoji w tytułach zgłoszeń.

## 2. Model danych (Prisma)

**Bez zmian w schemacie.** Brak migracji. (Meta kosztu nie jest i nie będzie persystowana — `MetaFooter`
i panel szczegółów działają tylko na „żywych" turach z bieżącej odpowiedzi, jak dziś; hydratacja z DB
degraduje się do treści bez stopki — bez regresji.)

## 3. Warstwa serwera (Server Actions — C-20)

Brak nowych/zmienionych Server Actions. Feature nie dotyka mutacji danych przez `src/actions/*` poza już
używanymi (`createTask`, `ensureOmniaProject` w zgłoszeniu — bez zmian sygnatur). `revalidatePath` nie
dotyczy (brak nowych mutacji).

**Trasa agenta (nie Server Action, to route handler):**
`src/app/api/llm/home/agent/route.ts` — przy budowie `meta` wysyłanej do klienta dołożyć `calls`
(rozbicie per wywołanie), obok istniejących `model/tokens/costUsd`. Miejsca: fast-path (l. ~786) i pętla
agenta (l. ~852/874) — zmieniamy obiekt meta na `{ model, tokens, costUsd, calls: meta.calls }`.

**Akumulator zużycia:** `src/lib/ai/usage.ts`
- `UsageMeter` += `calls: UsageCall[]` gdzie
  `type UsageCall = { model: string; label?: string; promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number }`
  (rodzaj/label jako `String`, żaden enum — C-12).
- `newUsageMeter()` inicjalizuje `calls: []`.
- `accrueUsage(meter, usage, model, label?)` — po doliczeniu sumy **dopisuje jeden wpis** do `meter.calls`
  (gdy `usage` obecne). Dodać opcjonalny `label` (np. `"router"`, `"fast_path"`, `"agent"`) w miejscach
  wywołań (`callAgent`, `routeModules`, `classifyIntent`) — czysto informacyjny do panelu.
- Typ kliencki `AgentMeta` (w `AICommandSheet.tsx`, l. 73) += `calls?: UsageCall[]` (lekki mirror typu).

## 4. RBAC / rejestr modułu (C-22)

- **Slug:** bez nowego. Wykorzystujemy istniejący prop `isAdmin` przekazywany do `AICommandSheet`
  (pochodny z `module.admin`) do bramkowania **logów rozumowania** i diagnostyki.
- **Zmiana dostępu robaczka asystenta:** dziś ikona + panel zgłoszenia są `isAdmin`-gated (l. 1255–1257,
  1264). Zdejmujemy gate → dostępne dla każdej zalogowanej sesji (C-22: brak trybu anonimowego, ale to
  strona za auth — OK). Diagnostyka `getRecentAiCalls` w raporcie pozostaje best-effort (dla nie-admina
  po prostu nie dołączy się blok — obsłużone `try/catch` → `aiCallsError`).
- Bez wpięć w `modules.tsx`/`ModuleSidebar` (to nie moduł nawigacyjny).

## 5. UI (C-30, C-31, C-32)

Wszystko w `src/components/home/AICommandSheet.tsx` (+ typ w tym samym pliku). Zmiany punkt-po-punkcie:

**(A) Scalenie plan + results (AC-1, AC-2, AC-9, AC-14):**
- Rozszerzyć turę `plan` union (l. 81) o `results?: ActionResult[]; undone?: boolean` (pola już istnieją
  na turze `results` — przenosimy je „w górę" do planu).
- `handleExecute` (l. 1087–1099): zamiast `setTurns(... push {kind:"results"})` — **zaktualizować tę samą
  turę planu**: `{ ...x, done:true, results }`. Persist: zapisać wynik w danych tury planu
  (`persist("assistant", content, "plan", { actions, results })`) albo dołożyć kompaktowy zapis — spójnie
  z hydratacją (pkt niżej).
- `undoActions` (l. 1113–1127): przyjmować turę `plan` (nie `results`); po cofnięciu ustawić na tej turze
  `undone:true` (bez pushowania nowej tury „Cofnięto”). Zaktualizować `onUndo` typ w `TurnView`.
- Render tury `plan` (l. 1752–1790): gdy `done` i są `results` → renderować **inline listę wyników**
  (ikona ✓/✗ + opis + `navigateTo`) oraz przyciski **Cofnij / Popraw nieudane** w tym samym bąbelku
  (przenieść logikę z bloku `results`, l. 1818–1862). Zwykłe „✓ Wykonano” (l. 1763–1764) zastąpione tą
  bogatszą, dynamiczną sekcją. Zero drugiej tury.
- Zostawić gałąź renderu `kind:"results"` **tylko dla wstecznej zgodności** hydratowanych starych rozmów
  (l. 1175 hydratacja + l. 1818 render) — nowy przepływ jej nie tworzy.
- Hydratacja (l. 1174): tura `plan` czyta `data.results` (jeśli jest) → `{ done:true, results }`.

**(B) Stopka: ikona Odczytaj bez labelki + w linii z kosztem (AC-3, AC-4, AC-5):**
- `SpeakButton` (l. 1614–1627): wariant **icon-only** (usunąć tekst „Odczytaj/Zatrzymaj”; zostaje ikona
  `Volume2`/`Square` + `title`/`aria-label`). Zapewnić cel dotyku (min. `padding`/rozmiar — C-31).
- `MetaFooter` (l. 228–240) → komponent stopki pokazujący **tylko sumaryczną kwotę** (`withPln`), jako
  **przycisk** otwierający panel szczegółów. Gdy koszt nieznany/0 → neutralny afford („szczegóły modelu”)
  otwierający ten sam panel (nie gubimy modelu/tokenów, tylko schodzą z głównego wiersza).
- Złożyć **jeden wiersz stopki** w bąbelku `answer` (l. 1679–1687) i analogicznie w `plan`/`report`:
  `[Kopiuj] [Odczytaj-ikona] [Ponów] …spacer… [kwota↕]`. Ikona Odczytaj trafia do tego samego wiersza co
  kwota (AC-3).

**(C) Panel szczegółów kosztu (AC-5, AC-6):**
- Nowy mały komponent `CostBreakdown({ meta, rate })`: po kliknięciu kwoty rozwija (inline, pod stopką)
  listę `meta.calls`: `model · label · promptTokens+completionTokens=total tok · ~$koszt`, na końcu
  **SUMA** = `meta.costUsd` (musi zgadzać się z kwotą w stopce — AC-6). Styl: `--bg-elevated`, `--border`,
  `--text-secondary`; `Esc`/ponowny klik zamyka; `overflow-x:auto` dla wąskich ekranów (C-31).
- Gdy brak `calls` (np. stara/hydratowana tura) → panel pokazuje tylko `model` + `tokens` + `costUsd`
  (degradacja bez błędu).

**(D) Logi rozumowania tylko admin (AC-7, AC-8):**
- Przekazać `isAdmin` do `TurnView` (nowy prop) i renderować `<ReasoningLog>` **tylko gdy `isAdmin`**
  (l. 1668, 1730, 1746, 1787). Zwykły user nie widzi ani listy „myśli”, ani rozwijanych surowych logów.
  Admin — bez regresji (AC-8).
- To realizuje też AC-9: duplikat „ładnego opisu + logi” znika dla usera (zostaje jedna sekcja = treść
  tury planu).

**(E) Robaczek asystenta dla wszystkich + teksty (AC-10, AC-11):**
- Zdjąć `isAdmin &&` z ikony (l. 1255–1257) i z panelu (l. 1264).
- Usunąć akapit „Do zadania dołączymy pełny zrzut tej rozmowy i logi połączeń z backendem.” (l. 1288–1290).
- Zmienić label (l. 1279) „Zgłoś problem z czatem (opis opcjonalny)” → „Zgłoś problem z Asystentem AI
  (opis opcjonalny)”. Zaktualizować `title`/`aria-label` ikony (l. 1256) na „Zgłoś problem z Asystentem AI”.

**(F) Prefiksy emoji w tytułach (AC-12, AC-13):**
- **Robaczek asystenta** (`submitProblemReport`, l. 730–732): tytuł = `🐛✨ ${firstLine || "Problem z
  Asystentem AI"}` — **bez** `stamp` (usnąć prefiks z datą; data i tak jest w treści raportu, l. 215).
- **Główny robaczek (element → agent → create_task)**: (1) dopisać do promptu zgłoszenia (l. 1012–1018)
  instrukcję: `params.title MUSI zaczynać się od "🐛 " a po spacji zwięzły tytuł`; (2) **deterministyczne
  domknięcie na kliencie** — ref `feedbackPrefixRef` ustawiany na `"🐛 "` przy wysyłce trybu zgłoszenia
  (l. 1001), a przy wykonaniu planu (`handleExecute`/`quickConfirm`) znormalizować tytuł każdej akcji
  `create_task`: jeśli nie zaczyna się od `🐛`, doklej `🐛 ` (i wyczyść ref). Gwarantuje prefiks nawet gdy
  model pominie emoji. Teksty PL (C-32).

**Motyw (C-30):** wszystkie nowe elementy używają wyłącznie `var(--*)` (już konwencja pliku); tekst na
kolorowych przyciskach = `var(--on-accent)`. **Mobile/keyboard (C-31):** stopka zawija się na wąskich
ekranach; panel kosztu `overflow-x:auto`; ikona Odczytaj zachowuje cel dotyku; `Esc` zamyka panele.

## 6. AI / integracje (C-23, C-40)

- **Brak nowej `AIAction`** → `check:actions` nieaktywne dla tego feature'a. Wykorzystujemy istniejące
  `create_task` (bez zmiany kontraktu — tytuł normalizowany po stronie klienta/promptu).
- **Routing modeli** (C-40) bez zmian — czytamy tylko już zebraną telemetrię (`UsageMeter`), nie
  hardcodujemy modeli. Panel kosztu pokazuje faktycznie użyte modele (transparentność).
- Kalendarz/powiadomienia/trash — nie dotyczy.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/lib/ai/usage.ts` | edycja | `UsageMeter.calls[]` + `UsageCall`; `accrueUsage` dopisuje wpis (opcjonalny `label`) |
| `src/app/api/llm/home/agent/route.ts` | edycja | dołączyć `calls` do `meta` wysyłanej do klienta; przekazać `label` do `accrueUsage` |
| `src/components/home/AICommandSheet.tsx` | edycja | scalenie plan+results; stopka (ikona Odczytaj bez labelki + kwota); `CostBreakdown`; `ReasoningLog` gated `isAdmin`; robaczek asystenta dla wszystkich + teksty; prefiksy 🐛/🐛✨; typ `AgentMeta.calls`; hydratacja plan z `results` |
| `doświadczenia.md` | edycja | wpis-lekcja po wdrożeniu (C-51) |
| `specs/029-assistant-dynamic-actions-ux/{spec,plan,tasks,verify,review}.md` | artefakty | pipeline (C-03) |

## 8. Bramki i weryfikacja (C-50)

- **Lokalnie do `next build`** (bez `migrate.js` — C-13; brak migracji, więc nawet lokalny Postgres nie
  jest konieczny do kompilacji, ale build i tak nie rusza DB do kroku `migrate.js`).
- Kolejno: `node scripts/check-action-coverage.js` (przejdzie — brak nowej akcji), `node
  scripts/check-ai-coverage.js` (bez nowych Server Actions → bez zmian w manifeście),
  `node scripts/check-migrations.js`, `npx next lint --dir src`, `npx next build`. **Pominąć** `migrate.js`.
- **Mapowanie AC → weryfikacja:**
  - AC-1/2/9/14 — przegląd kodu: po `handleExecute` istnieje **jedna** tura (`plan` z `results`), brak
    push `kind:"results"`; render inline; dotyczy planów z tekstu i obrazu.
  - AC-3 — `SpeakButton` bez tekstu, w jednym wierszu ze stopką kosztu.
  - AC-4/5/6 — stopka pokazuje samą kwotę; `CostBreakdown` sumuje `meta.calls` do `meta.costUsd`
    (sanity: suma pozycji == kwota). Test manualny na realnej odpowiedzi wielo-wywołaniowej.
  - AC-7/8 — `ReasoningLog` renderowany tylko dla `isAdmin` (przegląd + test z kontem nie-admin/admin).
  - AC-10/11 — ikona/panel widoczne bez `isAdmin`; brak akapitu; nowy label/nagłówek.
  - AC-12/13 — utworzone zadanie ma tytuł `🐛 …` / `🐛✨ …`, bez prefiksu z datą (test manualny z obu
    robaczków; emoji przechodzi jako tekst).

## 9. Ryzyka techniczne i plan wycofania

- **Rozjazd sumy kosztu** — pozycje `calls` liczą koszt tym samym `estimateCostUsd`, a suma `meta.costUsd`
  akumuluje się z tych samych wywołań → z definicji spójne; ryzyko tylko przy wywołaniu bez `usage`
  (pomijane w obu miejscach). Mitygacja: panel liczy sumę z `calls` i porównuje wizualnie z `costUsd`.
- **Regresja hydratacji** — stare rozmowy z `kind:"results"` muszą się dalej renderować. Mitygacja:
  zostawiamy gałąź `results` w renderze i hydratacji.
- **Emoji w tytule** — pojedynczy `create_task` musi przenieść 🐛 bez zamiany na „?”. Mitygacja:
  deterministyczny prefiks na kliencie + test manualny.
- **Rollback:** czysto kodowy (brak migracji) — rewert commita/brancha; brak stanu w DB do cofania
  (por. runbook devops: rollback kodu bez rollbacku migracji).

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14 (migracje)** — brak zmian schematu, brak migracji (napisane wprost); zero enumów.
- [x] **C-20..C-25** — brak nowych mutacji/Server Actions; RBAC: reuse `isAdmin`/`module.admin` do
  bramkowania logów; robaczek dostępny za auth; bez nowego slugu; AI: brak nowej `AIAction` (C-23);
  routing modeli nietknięty (C-40); trash/audit nie dotyczy.
- [x] **C-30..C-32** — tylko zmienne CSS; stopka/panel mobile-first (zawijanie, `overflow-x`, `Esc`,
  cele dotyku); teksty PL.
- [x] **C-53 (minimalizm)** — brak nowych zależności i abstrakcji; scalamy istniejące tury i rozszerzamy
  istniejący akumulator; zmiany skupione w jednym komponencie + dwóch drobnych plikach telemetrii.
