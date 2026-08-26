# Weryfikacja: Dolny pasek — inteligentne ikony, gwiazdka, historia, drzewiasty wachlarz

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md
- **Data:** 2026-08-26
- **Środowisko:** lokalny Postgres 16 (`omnia_dev`), C-13 — produkcyjna baza NIE była dotykana.

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ numeracja OK (następny wolny 0267; **żadna migracja nie doszła** — feature nie rusza schematu) |
| `check:schema-drift` | ✅ brak rozjazdu (5 świadomych wyjątków) — uruchomione **z** lokalną bazą |
| `check:actions` | ✅ 164 akcje asystenta, każda z egzekutorem i kontraktem |
| `check:ai-coverage` | ✅ 597 akcji z zakresem i guardem |
| `check:cost-badge` · `check:content-memory` | ✅ 39 plików · 39 plików |
| `check:module-registry` | ✅ 22 moduły — **z nową, 9. kontrolą szybkich celów** |
| `check:boundaries` | ✅ 4 przypadki (import przez granicę blokowany) |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:ui-contract` | ✅ 23/23 modułów |
| `check:logs` · `check:client-safe` · `check:e2e-waits` · `check:tailwind` | ✅ · ✅ · ✅ · ✅ |
| `check:owner-columns` · `check:ownership-scope` · `check:workspace-*` | ✅ (2408 wywołań Prismy) |
| `check:route-gating` · `check:pagination` · `check:domain` · `check:events` · `check:realtime` · `check:versioning` | ✅ |
| `test:unit` | ✅ **1247 / 1247** |
| `next lint --dir src` | ✅ **0 błędów** (ostrzeżenia kosmetyczne — stan zastany, bez zmian) |
| `next build` | ✅ **exit 0** |
| `check:perf` | ✅ 1172 kB najcięższa trasa, suma 67 464 kB — **w paśmie ±5 %, próg bez zmian** |

## 2. Kryteria akceptacji

| AC | Werdykt | Dowód |
|----|---------|-------|
| AC-1 cztery kotwice | ✅ | `pozycjePaska` + klikacz `[103-AC1]` na `/tasks` i `/shopping` |
| AC-2 moduły w pozostałych miejscach | ✅ | test „moduły nie wypchną kotwic" |
| AC-3 360 px, ≥ 44 px | ✅ | klikacz `[103-AC3]` — pomiar `getBoundingClientRect` każdej pozycji |
| **AC-4 lustrzenie wg ręki** | ❌ | **patrz brak B-1** — kolejność pod kciukiem wychodzi odwrócona |
| AC-5 konto bez modułów | ✅ | test „konto BEZ uprawnień modułowych…" |
| AC-6 tap zapisuje | ✅ | klikacz `[103-AC6]` — brak `role="dialog"`, `aria-pressed` się zmienia |
| AC-7 tap odwraca | ✅ | klikacz `[103-AC6/AC7]` — drugi tap wraca do stanu wyjściowego |
| **AC-8 hold → wachlarz ulubionych** | ⚠️ | działa przy niepustej liście (`WachlarzNawigacji.tsx:269`), ale **przy zerze ulubionych otwiera PUSTĄ warstwę** — patrz brak B-2 |
| AC-9 błąd zapisu | ✅ | `useUlubioneBiezacego` — `setWstepny(null)` + toast błędu w `catch` |
| AC-10 gwiazdka znika z góry | ✅ | klikacz `[103-AC10]`; zastane `[085-AC1]`/`[087-AC21]` poprawione i zdane |
| AC-11 kolejność historii | ✅ | `historia.test.ts` — „najświeższy wpis jest PIERWSZY" |
| AC-12 skok z historii | ✅ | `WachlarzNawigacji` `onPointerUp` → `router.push(cel.href)` |
| AC-13 pusta historia | ✅ | klikacz `[103-AC13]` — komunikat, brak warstwy |
| AC-14 tap = krok wstecz | ✅ | klikacz `[103-AC14]` — `/shopping` → `/tasks` |
| AC-15 brak powtórzeń, limit | ✅ | `historia.test.ts` — scalanie, awans, przycięcie do 12 |
| AC-16 historia a uprawnienia | ✅ | `PasekKciukaPolaczony` — `filterAccessibleFavorites` przy odczycie |
| AC-17 drugi poziom bez ulubionych | ✅ | `celeGlebiej` + bramka wymuszająca cele w każdym z 22 modułów |
| AC-18 scalenie bez duplikatów | ✅ | `celeGlebiej` — `widziane` po `href`, etykieta użytkownika nadpisuje |
| AC-19 „Nowy projekt" z gestu | ✅ | `TasksHomePage` + klikacz `[103-AC20]` |
| AC-20 ten sam adres z linku | ✅ | klikacz `[103-AC20]` — wejście wprost pod adres daje ten sam widok |
| AC-21 poziom 1 zawsze ten sam | ✅ | `PasekKciuka:237` — pozycja modułu woła `uchwyty(m.href)` **bez** źródła |
| AC-22 moduł bez uprawnienia | ✅ | test „moduł bez uprawnienia nie trafia do paska" + `celeGlebiej` |
| AC-23 „Ustawienia paska" | ✅ | klikacz `[103-AC23]` — ostatnia pozycja poziomu 1 |
| AC-24 kotwic nie da się usunąć | ✅ | `MenuPrefsEditor` (kotwice nie są pozycjami listy) + `updateMenuPrefs` |
| AC-25 skórki, zero hexów | ✅ | `check:ui-contract` |
| AC-26 ograniczenie ruchu | ✅ | reguła `prefers-reduced-motion` w `WachlarzNawigacji` nietknięta |
| AC-27 dostępność | ✅ | `aria-label` opisuje CZYNNOŚĆ, `aria-pressed` na gwiazdce, `aria-current` na module |

**Wynik: 25 ✅ · 1 ⚠️ · 1 ❌.**

## 3. Braki do poprawy

### B-1 (AC-4) — kolejność kotwic pod kciukiem wychodzi ODWROTNIE niż w zgłoszeniu

Właściciel wymienił skład jako „Strona domowa | Sparkles | ulubione | historia", czyli przy ręce
prawej historia stoi w **prawym rogu**, pod kciukiem. `pozycjePaska` zwraca `bliskie =
[ulubione, historia]`, ale `PasekKciuka` renderuje stronę kciuka przez `[...bliskie].reverse()` —
więc w rogu ląduje **ulubione**, a historia bliżej środka.

Wada przeszła przez test, bo test sprawdzał **listę przed lustrzeniem**, a nie kolejność
wyrenderowaną — i twierdził przy tym („historia stoi w SAMYM ROGU") coś przeciwnego do tego, co
faktycznie widać. To jest dokładnie ten rodzaj testu, który daje fałszywe poczucie pokrycia.

Przy ręce lewej mirror wypada poprawnie, więc błąd jest **jednostronny** — i tym łatwiej byłoby go
przeoczyć w przeglądzie.

### B-2 (AC-8) — przytrzymanie gwiazdki przy ZERZE ulubionych otwiera pustą warstwę

`const lista = wlasne ?? [...pozycje, ustawieniaPaska]` — operator `??` przepuszcza **pustą tablicę**
(reaguje tylko na `null`/`undefined`), więc konto bez zapisanych widoków dostaje wachlarz bez jednej
podpowiedzi: ciemną warstwę, z której jedynym wyjściem jest domyślenie się, że trzeba puścić palec
obok. Historia ma tę sytuację zamkniętą (AC-13, wyszarzenie + komunikat) — gwiazdka nie, i jest to
niespójność w obrębie jednego paska, a nie tylko brak wobec AC-8.

## 4. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| C-01 (praca w `worldofmag/`) | ✅ — jeden plik powstał chwilowo w legacy `src/`, przeniesiony przed commitem, w którym się pojawił |
| C-10..C-14 (migracje) | ✅ — brak zmian schematu, brak migracji; potwierdzone bramką, nie założeniem |
| C-20/C-21 (akcje, własność) | ✅ — zero nowych akcji; `updateMenuPrefs` zachowuje `revalidatePath` i guardy |
| C-22 (RBAC) | ✅ — trzy nowe miejsca filtrowane tą samą funkcją co reszta powłoki |
| C-30 (zmienne CSS) | ✅ | 
| C-31 (mobile, 44 px, safe-area) | ✅ — mierzone klikaczem przy 360 px |
| C-32 (teksty przez `t()`) | ✅ |
| C-34 (bez `window.confirm`) | ✅ — przełączenie ulubionego bez potwierdzenia, bo odwracalne |
| C-35 (komponent z konsumentem) | ✅ — cele w 22 modułach, `?akcja=` w 5 widokach; **martwy `MAX_TAB_BAR` usunięty**, nie zostawiony |
| C-36 (granice) | ✅ — `platform/nawigacja` nie zna modułów (etykieta parametrem); bramka granic zielona |
| C-51 (doświadczenia) | ✅ — wpis o oknie zaimportowanym i nierenderowanym |
| C-53 (minimalizm) | ✅ — zero nowych zależności, sygnatura `uchwyty()` zgodna wstecz |
| C-54 (spójność artefaktów) | ✅ — testy zastane poprawione tam, gdzie zmieniła się REGUŁA, nie kod |

## 5. Regresje

- **Klikacze:** pełny przebieg `desktop` — 202 zdane, 18 niezdanych. Po poprawkach: 5 dotyczyło tej
  zmiany (3 testy zastane pilnujące starego miejsca gwiazdki + 2 błędy lokatora w moich nowych
  testach) i wszystkie są **zdane** w przebiegu kontrolnym. Pozostałe **12 potwierdzono jako
  ZASTANE**: te same pliki na commicie bazowym `a2b3e3e` (osobne drzewo robocze) dają identyczną
  listę 12 niezdanych. Wszystkie dotyczą Wiadomości i lektora — w tym środowisku nie ma sieci,
  więc kanały RSS są puste.
- **Testy jednostkowe sąsiednich modułów:** 1247/1247. Dwa czerwone testy zastane naprawiono
  (licznik modułów 21 → 22 po YouTube z run 102; `ownership.test.ts` wymagał bazy).
- **Nawigacja boczna (komputer):** `uchwytyLinku()` nietknięte — sygnatura `uchwyty()` rozszerzona
  wstecznie zgodnie, więc żadne dzisiejsze wywołanie nie wymagało zmiany.
- **Naprawa poza zakresem, świadoma:** `HabitFormModal` był zaimportowany i nigdy nierenderowany —
  w Nawykach nie dało się dodać nawyku. Bez tego szybki cel „Nowy nawyk" prowadziłby donikąd.

## 6. Werdykt

**DO POPRAWY** — dwa braki (B-1: AC-4 niespełnione, B-2: AC-8 częściowo). Oba są w powłoce, oba
mają jasną poprawkę i oba wynikają z KODU, nie z błędu speca ani planu, więc `spec.md`/`plan.md`
nie wymagają zmiany (C-54). Wracam do `/implement` z zadaniami T-25 i T-26.
