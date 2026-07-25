# Zadania: Ujednolicenie UX dynamicznych sekcji akcji asystenta AI + zgłaszanie problemów z asystentem

- **Plan:** ./plan.md (029-assistant-dynamic-actions-ux)
- **Status:** done
- **Data:** 2026-07-25

> Kolejność: telemetria (fundament pod koszt) → UI scalenie/stopka/koszt → RBAC-gate/teksty → prefiksy →
> bramki. Brak migracji i nowych Server Actions (plan §2, §3). Każde zadanie ≈ jeden spójny commit.

## Legenda
- `[ ]` do zrobienia · `[x]` zrobione · `[~]` w trakcie · `[!]` zablokowane
- `[P]` — niezależne, można zrównoleglić

## Faza 0 — Fundament danych
- [x] **T-0** — Brak zmian schematu i migracji (plan §2). Zadanie-placeholder: potwierdzić, że
  `prisma/migrations` nietknięte i `npm run check:migrations` przechodzi bez nowych katalogów.

## Faza 1 — Telemetria kosztu (fundament pod stopkę)
- [x] **T-1** — `src/lib/ai/usage.ts`: dodać typ `UsageCall = { model; label?; promptTokens;
  completionTokens; totalTokens; costUsd }` (String/number, zero enumów — C-12), rozszerzyć `UsageMeter`
  o `calls: UsageCall[]`, zainicjalizować w `newUsageMeter()`, a w `accrueUsage(meter, usage, model,
  label?)` dopisać wpis do `meter.calls` (gdy `usage` obecne). **Gotowe, gdy:** typy się kompilują, suma
  `costUsd` niezmieniona, `calls` zbiera po jednym wpisie na wywołanie.
- [x] **T-2** — `src/app/api/llm/home/agent/route.ts`: przekazać `label` do `accrueUsage` w miejscach
  wywołań (`classifyIntent`→`"fast_path"`, `routeModules`→`"router"`, `callAgent`→`"agent"`) i dołączyć
  `calls: meta.calls` do obiektu `meta` wysyłanego do klienta (fast-path ~l.786, pętla agenta ~l.852/874).
  **Gotowe, gdy:** klient dostaje `meta.calls` z rozbiciem; brak zmian w kontrakcie odpowiedzi poza
  dodaniem pola.

## Faza 2 — UI: scalenie sekcji akcji (AC-1, AC-2, AC-9, AC-14)
- [x] **T-3** — `AICommandSheet.tsx`: rozszerzyć union tury `plan` o `results?: ActionResult[]; undone?:
  boolean` oraz typ kliencki `AgentMeta` o `calls?: UsageCall[]` (mirror z `usage.ts`). **Gotowe, gdy:**
  typy się kompilują, `results`/`plan` współistnieją.
- [x] **T-4** — Scalić wykonanie: `handleExecute` aktualizuje **tę samą** turę planu (`{...x, done:true,
  results}`) zamiast pushować turę `kind:"results"`; `undoActions` przyjmuje turę `plan` i ustawia
  `undone:true` bez nowej tury „Cofnięto”. Persist wyniku w danych tury planu (`persist(... "plan",
  {actions, results})`); hydratacja tury `plan` czyta `data.results`. **Gotowe, gdy:** po zatwierdzeniu
  jest **jedna** sekcja; cofnięcie działa w miejscu; stare rozmowy z `kind:"results"` dalej się renderują.
- [x] **T-5** — Render tury `plan` (l. 1752–1790): gdy `done && results` → renderować inline listę
  wyników (✓/✗ + opis + `navigateTo`) + przyciski **Cofnij** / **Popraw nieudane** (przenieść z bloku
  `results`, l. 1818–1862). Zwykłe „✓ Wykonano” zastąpione tą sekcją. Zostawić gałąź renderu
  `kind:"results"` tylko dla wstecznej zgodności. **Gotowe, gdy:** brak podwójnej informacji o wykonaniu
  (AC-1/2/9); dotyczy planów z tekstu i z obrazu (AC-14).

## Faza 3 — UI: stopka, ikona Odczytaj, panel kosztu (AC-3, AC-4, AC-5, AC-6)
- [x] **T-6** — `SpeakButton` (l. 1614–1627): wariant **icon-only** (bez tekstu „Odczytaj/Zatrzymaj”;
  zostaje ikona + `title`/`aria-label`, cel dotyku — C-31). **Gotowe, gdy:** ikona bez labelki (AC-3).
- [x] **T-7** — `MetaFooter` → stopka pokazująca **tylko sumaryczną kwotę** jako **przycisk**; gdy koszt
  0/nieznany → neutralny afford („szczegóły modelu”). Złożyć **jeden wiersz stopki** w bąbelkach
  `answer`/`plan`/`report`: `[Kopiuj] [Odczytaj-ikona] [Ponów] … [kwota↕]` (ikona Odczytaj w tej samej
  linii co kwota — AC-3/AC-4). **Gotowe, gdy:** w stopce jest sama kwota + ikona w jednej linii.
- [x] **T-8** — Nowy komponent `CostBreakdown({ meta, rate })`: klik w kwotę rozwija inline listę
  `meta.calls` (`model · label · prompt+completion=total tok · ~$koszt`) + **SUMA** = `meta.costUsd`
  (AC-6); `Esc`/ponowny klik zamyka; `overflow-x:auto` (C-31); brak `calls` → tylko model+tokeny+koszt.
  **Gotowe, gdy:** rozbicie widoczne po kliknięciu, suma == kwota w stopce (AC-5/AC-6).

## Faza 4 — UI: logi admina, robaczek dla wszystkich, teksty (AC-7, AC-8, AC-10, AC-11)
- [x] **T-9** — Przekazać `isAdmin` do `TurnView` (nowy prop) i renderować `<ReasoningLog>` **tylko gdy
  `isAdmin`** (l. 1668, 1730, 1746, 1787). **Gotowe, gdy:** nie-admin nie widzi logów rozumowania; admin
  bez regresji (AC-7/AC-8/AC-9).
- [x] **T-10** `[P]` — Robaczek asystenta: zdjąć `isAdmin &&` z ikony (l. 1255–1257) i panelu (l. 1264);
  usunąć akapit „Do zadania dołączymy pełny zrzut…” (l. 1288–1290); label (l. 1279) → „Zgłoś problem z
  Asystentem AI (opis opcjonalny)”; `title`/`aria-label` ikony → „Zgłoś problem z Asystentem AI”.
  **Gotowe, gdy:** dostępne dla zwykłego usera, teksty poprawione (AC-10/AC-11).

## Faza 5 — Prefiksy emoji w tytułach (AC-12, AC-13)
- [x] **T-11** — `submitProblemReport` (l. 730–732): tytuł = `🐛✨ ${firstLine || "Problem z Asystentem
  AI"}` bez `stamp`. **Gotowe, gdy:** zadanie z robaczka asystenta ma tytuł `🐛✨ …` bez daty (AC-13).
- [x] **T-12** — Główny robaczek (element→agent→create_task): (1) dopisać do promptu zgłoszenia
  (l. 1012–1018) wymóg `params.title zaczyna się od "🐛 "`; (2) ref `feedbackPrefixRef="🐛 "` przy wysyłce
  trybu zgłoszenia (l. 1001), a w `handleExecute`/`quickConfirm` znormalizować tytuł każdej akcji
  `create_task` (doklej `🐛 ` gdy brak) i wyczyść ref. **Gotowe, gdy:** zadanie z głównego robaczka ma
  tytuł `🐛 …` bez prefiksu z datą, deterministycznie (AC-12).

## Faza 6 — Bramki i domknięcie
- [x] **T-13** — Lokalne bramki (C-13 — bez `migrate.js`): `node scripts/check-action-coverage.js` &&
  `node scripts/check-ai-coverage.js` && `node scripts/check-migrations.js` && `npx next lint --dir src`
  && `npx next build`. **Gotowe, gdy:** wszystko zielone.
- [x] **T-14** — Mapowanie każdego AC (poniżej) na konkretną zmianę/test — input do `/verify`.
- [x] **T-15** — Wpis do `doświadczenia.md` (C-51), jeśli po drodze był nieoczywisty problem
  (np. spójność sumy kosztu, hydratacja `results`, emoji w tytule).

## Mapowanie kryteriów akceptacji → zadania
| AC | Zadania |
|----|---------|
| AC-1 jedna sekcja wykonania | T-4, T-5 |
| AC-2 dynamiczny stan sekcji | T-4, T-5 |
| AC-3 ikona Odczytaj bez labelki, w linii ze stopką | T-6, T-7 |
| AC-4 w stopce tylko suma kwoty | T-7 |
| AC-5 rozwijane rozbicie kosztu | T-2, T-8 |
| AC-6 suma = wszystkie wywołania | T-1, T-2, T-8 |
| AC-7 logi rozumowania nie dla usera | T-9 |
| AC-8 admin ma logi bez regresji | T-9 |
| AC-9 brak duplikatu „ładny opis + logi” | T-5, T-9 |
| AC-10 robaczek asystenta dla wszystkich | T-10 |
| AC-11 teksty panelu zgłoszenia | T-10 |
| AC-12 prefiks 🐛 (główny robaczek) | T-12 |
| AC-13 prefiks 🐛✨ (robaczek asystenta) | T-11 |
| AC-14 globalne ujednolicenie sekcji | T-4, T-5 |

## Ścieżka krytyczna
T-1 → T-2 (telemetria) blokują T-8 (panel kosztu). T-3 blokuje T-4/T-5 (scalenie). T-6+T-7 blokują T-8
(wspólny wiersz stopki). Reszta (T-9, T-10, T-11, T-12) w większości niezależna. Wszystko zbiega w T-13
(bramki) → T-14/T-15.

## Notatki / blokady
- Brak. Plan w pełni rozbijalny bez decyzji właściciela (decyzje zebrane w `/specify`).
