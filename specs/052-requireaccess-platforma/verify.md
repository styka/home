# Weryfikacja: `requireAccess` — sprawdzanie dostępu jako zdolność platformy

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-12 · **Zakres:** 25 plików, +1543 / −36 (od `7d730bc3`, końca 051)

## Bramki

| Komenda | Wynik |
|---|---|
| `npm run build` (lokalny Postgres — C-13) | ✅ **exit 0**, „Compiled successfully" |
| `npm run test:unit` | ✅ **680 / 680** (było 671; +9 z nowych testów) |
| `tsc --noEmit` · `tsc -p tsconfig.test.json` · `next lint --dir src` | ✅ |
| `check:actions` **160** · `check:ai-coverage` **551** · `check:cost-badge` **35** · `check:content-memory` **35** | ✅ **bez ruchu** |
| `check:module-registry` (**9 kontroli**) · `check:boundaries` · `check:workspace-mirror` · `check:ui-contract` · `check:schema-drift` | ✅ |

**Spoza zakresu:** `⚠ Failed to seed LLM defaults` — zastane ostrzeżenie lokalnej bazy, build exit 0.

## Kryteria akceptacji

- **AC-1 ✅** `grep "@/modules/" src/platform/sharing/*.ts` → pusto; katalog to piąty parametr **bez
  wartości domyślnej**, więc zapomnienie go jest błędem kompilacji, nie cichym przyzwoleniem.
- **AC-2 ✅** Zadania mapują 7+3 operacje na cztery role z 051; **zero własnych nazw ról** w module.
- **AC-3 ✅** `resolve` zadania podaje rodzica; regułę rozstrzyga platforma. Z `assertTaskAccess`
  zniknęło ręczne `if (task.projectId)`.
- **AC-4 ✅ — sedno.** Macierz **5 relacji × 5 operacji = 25 komórek** zapisana **przed** napisaniem
  mechanizmu (T-1), porównana komórka po komórce (T-7) i **nadal identyczna po przełączeniu
  guardów** (T-8). Równoważność utrzymała się **przez** zmianę zachowania, nie obok niej.
- **AC-5 ✅ — z ustaleniem.** Wiersz „projekt zespołowy, użytkownik w zespole, bez członkostwa" ma
  własną asercję. **Ustalenie dla właściciela:** projekt zadań należący do zespołu jest dziś
  niedostępny **dla nikogo**, łącznie z właścicielem zespołu — `assertProjectAccess`
  i `accessibleProjectIds` czytają tylko `ownerId` i `TaskProjectMember`. Zachowane co do znaku;
  naprawa to osobna, świadoma zmiana.
- **AC-6 ✅ / AC-8 ✅** Pomiar szpiegami na metodach klienta, którego mierzony kod faktycznie używa
  (osobny `PrismaClient` z `$on("query")` liczyłby zapytania spoza mierzonej ścieżki): właściciel —
  **0** zapytań o nadania; obcy, łańcuch dwuogniwowy — **dokładnie 1**; dostęp do projektu —
  **1 zapytanie**, jak dawniej.
- **AC-7 ⚠️ CZĘŚCIOWO.** Memoizowany jest **kontekst użytkownika**, nie fakty o zasobie, a
  w środowisku testowym `React.cache` nie istnieje — więc **nie twierdzę, że zmierzyłem** „zero
  zapytań przy drugim sprawdzeniu". Zakres cache'u udokumentowany, degradacja poza żądaniem pokryta.
- **AC-9 ✅ — widziany na czerwono.** `get_task` pyta tym samym mechanizmem co zapis; zakres list
  przeniesiony do modułu, obok guardu. Test pokrywa **obie** drogi wejścia (identyfikator i tytuł)
  plus kontrolę pozytywną; po podłożeniu dziury 3 z 5 przypadków padają.
- **AC-10 ✅** `git diff 7d730bc3..HEAD -- src/app src/components` → **pusto**. Zero zmian sygnatur
  akcji; komunikaty odmowy zachowane co do treści.
  **Uczciwie o samym pomiarze:** pierwsze porównanie szło do `origin/develop` i dało 48 plików, bo
  ta gałąź nie zawiera commitów 049 z gałęzi roboczej. Błąd był w pomiarze, nie w kodzie — ale zły
  punkt odniesienia daje fałszywy alarm równie łatwo jak fałszywy spokój.
- **AC-11 ✅** komplet bramek, cztery liczniki bez ruchu.
- **AC-12 ✅** wpis 052 w dzienniku + **co dokładnie zamienia zadanie 11**, C-17 w konstytucji,
  `CLAUDE.md`, dwie lekcje w `doświadczenia.md`.

## Zgodność z konstytucją

C-01 ✅ · C-10..C-14 ✅ nie dotyczą (zero zmian schematu) · C-20..C-25 ✅ (zero nowych akcji, RBAC
nietknięty) · C-21 ✅ (`ownerId`/`ownerTeamId` czytane, nie zastępowane) · C-30..C-32 ✅ (brak UI) ·
**C-36 ✅** (platforma bez importu modułu; moduł **nie** sięga po korzeń kompozycji) · C-35 ✅
(zdolność z pierwszym konsumentem) · C-53 ✅ (jeden pilot, zero migracji danych).

## Regresje

Trzy rzeczy wyszły w trakcie i **wszystkie złapały testy, nie przegląd**:
1. **`React.cache` nie degraduje się poza kontekstem żądania** — rzuca. Bez jawnej degradacji
   `requireAccess` wywalałby każde zadanie w tle. Naprawione, zapisane w `doświadczenia.md`.
2. **`id` w `assertTaskAccess` jako opcjonalne** = ciche wracanie do starej reguły u wołających
   bez `id` w `select`. Wymuszone typem; kompilator wskazał `reorderTask`.
3. **Test izolacji budował syntetyczne zadanie** bez wiersza w bazie — teraz tworzy prawdziwe.

Sąsiednie moduły nietknięte. Klikacze nieuruchamiane (decyzja właściciela).

## Werdykt

## **GOTOWE Z UWAGAMI**

Jedenaście AC spełnionych w pełni, **AC-7 częściowo i napisane wprost**. Najważniejsze: tabela
prawdy powstała **przed** mechanizmem i przetrwała przełączenie — przy kodzie kontroli dostępu to
jedyna różnica między „działa" a „kompiluje się".

**Do recenzji:** (1) projekt zespołowy niedostępny dla nikogo — zastane, wymaga decyzji;
(2) AC-7 częściowe — pełny pomiar przy zadaniu 11; (3) moduł woła platformę z własnym katalogiem —
działa, dopóki łańcuch dziedziczenia nie wychodzi poza moduł (granica nazwana w kodzie).
