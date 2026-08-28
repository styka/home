# Weryfikacja: 112 — Asystent, kompletny odczyt, domknięcie tury i uczciwy koszt

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (17/17 odhaczonych)
- **Data:** 2026-08-28
- **Środowisko:** lokalny PostgreSQL 16 (`127.0.0.1:5432/omnia_dev`), migracje zaaplikowane.
  **Nigdy prod `DATABASE_URL`** — weryfikacja zatrzymana przed `scripts/migrate.js` (C-13).

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ Numeracja OK (następny wolny: 0272) |
| `check:actions` | ✅ 164 akcje w katalogu, wszystkie z egzekutorem i kontraktem; 386 parametrów z etykietami PL |
| `check:ai-coverage` | ✅ 611 akcji z zadeklarowanym zakresem i guardem w kodzie |
| `check:cost-badge` | ✅ 39 plików wołających model, każdy przekazuje zużycie |
| `check:content-memory` | ✅ 39 plików sklasyfikowanych |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:logs` | ✅ 798 plików serwerowych bez surowego `console.*` |
| `check:boundaries` | ✅ import przez granicę blokowany, kontrakt przechodzi |
| `check:module-registry` | ✅ 23 moduły, każdy kompletny |
| `check:ui-contract` | ✅ 25/25 modułów na `ModuleView` |
| `check:owner-columns` | ✅ 2517 wywołań Prismy + 5 prób mutacyjnych |
| `check:pagination` | ✅ każde `findMany` z granicą |
| `tsc --noEmit -p tsconfig.test.json` | ✅ bez błędów |
| `next lint --dir src` | ✅ **0 błędów**, 20 ostrzeżeń kosmetycznych (`no-img-element`, `exhaustive-deps`) — wszystkie **sprzed** tej zmiany, na roadmapie |
| `next build` | ✅ przechodzi |
| `check:perf` (po buildzie) | ✅ najcięższa trasa 1176 kB, suma 69 949 kB — w paśmie ±5 % |
| `npm run test:unit` | ✅ **1347/1347** |
| `scripts/migrate.js` | ⛔ **świadomie nieuruchomione** — rusza prod DB (C-13) |

**Uwaga o stabilności testów.** W jednym z sześciu przebiegów pełnego zestawu zaraportowano 2 błędy
bez wypisania nazw. **Nie udało się tego powtórzyć w czterech kolejnych pełnych przebiegach** ani w
czterech przebiegach samych nowych testów integracyjnych (10/10 za każdym razem). Testy integracyjne
dzielą jedną bazę i node uruchamia pliki równolegle, więc najprawdopodobniej była to kolizja stanu
w bazie, nie regresja — ale odnotowuję to zamiast przemilczeć, bo pojedynczy nieodtworzony błąd
to fakt, a nie szum.

## 2. Kryteria akceptacji

### A. Kompletny odczyt (AC-1…AC-5)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — komunikat mówi, że dane niepełne, i JAK dobrać resztę | ✅ | `agentContext.test.ts` „obcina listę powyżej limitu i mówi, JAK dobrać resztę": 60 rekordów → znacznik `pokazano 40 z 60`, zawiera `offset: 40`, **i asercja negatywna** `doesNotMatch(/zawęź zapytanie/)` — dokładnie to sformułowanie wyprodukowało spiralę |
| **AC-2** — kolejne porcje nienachodzące, do wyczerpania zbioru | ✅ | `stronicowanieOdczytu.integration.test.ts` na **realnej bazie**: 60 zadań, dwie porcje po 40 → część wspólna **0**, suma unikalnych id **60**. Dodatkowo test znacznika: `offset: 40` w argumentach → komunikat wskazuje `offset: 80` |
| **AC-3** — zbiór mieszczący się nie dostaje fałszywego alarmu | ✅ | Test „nie rusza wyników mieszczących się w limicie": `truncated === undefined` |
| **AC-4** — wynik zawsze poprawną strukturą, nigdy urwany w połowie | ✅ | Dwa testy: (a) 40 rekordów × 600 znaków → `JSON.parse` nie rzuca, rekordów mniej, budżet dotrzymany; (b) skrajność 200 rekordów → `doesNotThrow(JSON.parse)`. Kod: `ograniczDoBudzetu` usuwa **całe rekordy**, `json.slice()` usunięty |
| **AC-5** — komplet danych z treścią opisów w ≤ 3 iteracjach | ⚠️ **częściowo** | Zweryfikowany **mechanizm**, nie przebieg: test dowodzi, że `includeDescription: true` zwraca treść ≥ 20 opisów w JEDNYM odczycie, a bez flagi wynik jest identyczny jak przed 112. Że model **skorzysta** z tego w ≤ 3 iteracjach, można potwierdzić wyłącznie żywym przebiegiem — patrz AC-16 |

### B. Domknięcie tury (AC-6…AC-8)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-6** — asystent dokańcza zadanie zamiast opisywać porażkę | ⚠️ **częściowo** | Zweryfikowane **prześledzeniem ścieżki**, bez testu zachowania (wymaga modelu). `route.ts:695` — treść żądania zmieniona ze „streść, czego nie zrobiłeś" na „DOKOŃCZ zadanie na ich podstawie"; `finishPartialRun` zwraca `{actions}` albo `{answer}`, a wołający oddaje krok `plan` tą samą ścieżką co plan z pętli (`normalizeActions` → panel potwierdzenia, `limitReached: true`) |
| **AC-7** — jawna lista braków | ⚠️ **częściowo** | Jak wyżej: wymóg jest w treści żądania („wypisz osobno… czego NIE udało się ustalić lub przenieść i dlaczego"). To **instrukcja dla modelu**, więc egzekwowalna tylko przez obserwację przebiegu |
| **AC-8** — przy zerze danych zostaje dzisiejszy uczciwy komunikat | ✅ | Predykat pokryty testem (`countSuccessfulReads` → 0 dla pustego logu, powtórek i błędów); rozgałęzienie zweryfikowane w kodzie: `if (countSuccessfulReads(log) === 0) return { answer: partialRunFallbackMessage(...) }` **przed** jakimkolwiek wywołaniem modelu. `partialRunFallbackMessage` i cały dorobek 032 **nietknięte** |

### C. Zwierzę z profilem (AC-9…AC-11)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-9** — dane profilu trafiają do rekordu | ✅ | `profilZwierzecia.integration.test.ts` na realnej bazie: `add_pet` z datą urodzenia, pochodzeniem, mikroczipem, umaszczeniem i notatkami → wszystkie pola odczytane z `Pet`. Dodatkowo dwa niezmienniki: niepoprawna data **pomijana** (`birthDate === null`, nie `Invalid Date`) i łatka `update_pet` zawiera **wyłącznie** pola podane |
| **AC-10** — wyodrębniona lista informacji nieprzenoszalnych | ⚠️ **częściowo** | Reguła dopisana do katalogu akcji Zwierząt (4 punkty, w tym „ZAWSZE wypisz, czego nie dało się przenieść i dlaczego… nie zastępuj ogólnikiem"). Jak AC-7 — instrukcja dla modelu, weryfikowalna obserwacją |
| **AC-11** — zadania źródłowe nietknięte | ✅ | Egzekutor Zwierząt zawiera **zero** odwołań do Zadań (`grep prisma.task\.|createTask|updateTask|deleteTask` → 0 trafień). Ścieżka przenoszenia jest z definicji jednokierunkowa: read-toole Zadań → akcje Zwierząt. Dodatkowo reguła nr 4 w prompcie |

### D. Koszt (AC-12…AC-18)

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-12** — katalog opłacany raz, nie w każdej iteracji | ✅ | `systemBlocks.test.ts` (6 przypadków): bez flagi oznaczony tylko blok stały; z flagą **oba**; treść promptu identyczna co do znaku. `agentContext.test.ts`: `czyCachowacKatalog(1)=false`, `(2)=true`, `(6)=true`. Wpięcie: licznik `numerWywolania` inkrementowany **przy każdym wywołaniu modelu**, nie przy iteracji (jedna iteracja potrafi wołać model 3× przy naprawie formatu) |
| **AC-13** — brak płatnego zapisu w ostatnim wywołaniu | ✅ | `czyCachowacKatalog(0, true)=false` i `(7, true)=false`. Dodatkowo naprawiona **prawdziwa przyczyna** zmierzonej straty: domknięcie nie przekazywało `systemBlocks`, więc `toAnthropicSystem` oznaczał **cały** prompt — stąd 11 860 tokenów zapisu ($0,0445). Teraz przekazuje |
| **AC-14** — wyjście decyzji klasyfikacyjnej krótkie | ✅ | `effort: "none"` w obu wywołaniach (`fastPath.ts:237`, `route.ts:256`). Mechanizm potwierdzony w `effort.ts`: `applyEffort` przy `medium` ustawia `budget_tokens: 6144` i **podnosi `max_tokens` ze 120 do 7168** — to unieważniało zadeklarowany budżet. Z `effort: "none"` funkcja zwraca się natychmiast i `max_tokens` zostaje przy 120 |
| **AC-15** — brak płatnej klasyfikacji, gdy nie może pomóc | ✅ | `fastPathStraznicy.test.ts` (7 testów) na funkcji **czystej** `wartoKlasyfikowac` — wydzielonej właśnie po to, by dowieść „model nie został wołany" bez uruchamiania dostawcy. Zdanie ze zgłoszenia (215 znaków) → `false`. **Przy okazji wykryto i naprawiono usterkę T-2a** (patrz niżej) |
| **AC-16** — koszt niższy o ≥ 50 % | ⚠️ **spełnione w projekcji, nie w pomiarze na żywo** | Patrz sekcja 3 |
| **AC-17** — rozbicie rachunku dostępne w aplikacji | ✅ | Migracja `0271` (zero DDL — `grep -cE "^(DROP\|ALTER\|CREATE)"` = 0) zaaplikowana; `SELECT` potwierdza wiersz `asystent-koszt-tury-rozbicie`, 4829 znaków. Powtórny `migrate deploy` → nadal **dokładnie 1** wiersz (idempotencja) |
| **AC-18** — kwoty nieukryte i niezaniżone | ✅ | `git diff` na `AiCostBadge.tsx`, `usage.ts`, `costVisibility.ts`, `KosztToasts.tsx`, `kosztWidocznosc.ts` — **pusty** |

**Bilans: 12 ✅ · 6 ⚠️ częściowo · 0 ❌.**

Wszystkie ⚠️ mają **jedną wspólną przyczynę i jest nią granica środowiska, nie luka w implementacji**:
AC-5, AC-6, AC-7, AC-10 to zachowania **modelu językowego**, a AC-16 to pomiar jego zużycia. W tym
sandboksie nie ma poświadczeń do dostawcy, a odtworzenie tury wydałoby realne pieniądze z konta
właściciela. W każdym z tych przypadków zweryfikowano **wszystko, co dało się zweryfikować bez
modelu** — mechanizm, wpięcie i treść instrukcji — i powiedziano wprost, czego nie.

## 3. AC-16 — pomiar netto (projekcja)

Koszt policzony z **rzeczywistych liczników tokenów z logu zgłoszenia** i cennika z `LlmModelPrice`
(sonnet-5 3/15 USD za 1M, haiku-4.5 1/5, zapis 1,25×, odczyt 0,1×). **Rachunek kontrolny odtwarza
kwotę sprzed zmiany co do czwartego miejsca po przecinku ($0,3560 = tyle, ile pokazała aplikacja)**,
więc model kosztu jest wiarygodny, a nie dobrany do tezy.

Wielkość bloku zmiennego wyprowadzona z logu: domknięcie zapisało cały prompt systemowy (11 860),
blok stały to 1276 → **katalog ≈ 10 584 tokeny**.

| Scenariusz | Koszt | Zmiana |
|---|---|---|
| przed (8 wywołań, log zgłoszenia) | $0,3560 | — |
| 6 iteracji + domknięcie (gdyby zadziałała **tylko** pamięć podręczna) | $0,2338 | **−34 %** |
| 3 iteracje + domknięcie | $0,1788 | **−50 %** |
| 3 iteracje, tura kończy się **planem** (cel 112) | $0,1256 | **−65 %** |

Druga zgłoszona sesja, potraktowana jako zwykła tura: **$0,0813 → $0,0714 (−12 %)**.

**Koszt uboczny, wpisany do kodu zamiast przemilczany:** przebieg **dwuwywołaniowy** (`query` →
`answer`) płaci **12 % więcej** za katalog (2,25× zamiast 2,00×), bo zapis kosztuje 1,25×, a odczyt
zdąży nastąpić raz. Przyjęte świadomie: przebiegi 3+ są tymi drogimi (tam −22 % … −56 %), a pamięć
dostawcy żyje ~5 minut i jest wspólna dla kolejnych **tur** tej samej rozmowy, więc nadpłata wraca
przy następnej turze. Tabela z tym rachunkiem stoi w komentarzu `czyCachowacKatalog`.

## 4. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** | ✅ cała zmiana w `worldofmag/`; legacy `src/`, `_old/`, `pom.xml` nietknięte |
| **C-10…C-12** | ✅ jedna migracja, **wyłącznie dane**, ręcznie pisana; zero nowych kolumn → zero ryzyka enumów. `Pet` miał już wszystkie pola profilu, więc migracji schematu **nie było potrzeba** |
| **C-13** | ✅ lokalny Postgres; `migrate.js` nieuruchomione |
| **C-14** | ✅ dollar-quoting `$koszt_tury$`, `gen_random_uuid()::text`, `ON CONFLICT DO NOTHING`; idempotencja **sprawdzona** dwukrotnym `migrate deploy` |
| **C-15** | ✅ `grep -E "^(DROP\|ALTER)"` na nowej migracji → 0 trafień |
| **C-17 / C-21** | ✅ guardy dostępu **nietknięte i nieposzerzone**. Test dowodzi wprost, że `offset` zmienia **okno, nie zakres**: obcy użytkownik ze stronicowaniem nie widzi ani jednego zadania z cudzego projektu |
| **C-20** | ✅ nie dotyczy — brak nowych Server Actions, więc nie ma czego rewalidować |
| **C-23** | ✅ nowe pola mają egzekutor **i** wpis w kontrakcie akcji; `check:actions` zielony. Bramka złapała 5 brakujących etykiet i zostały dopisane |
| **C-32** | ✅ zero nowych literałów w komponentach (`check:i18n` zielony). Treść promptu i komunikat serwerowy świadomie poza `t()` — to protokół, nie tekst UI |
| **C-36** | ✅ `platform/` nie importuje żadnego modułu; zmiany w Zadaniach i Zwierzętach w `src/modules/<x>/`. `check:boundaries` zielony |
| **C-40** | ✅ dostawca i model nadal z `/admin/llm`. `effort: "none"` to deklaracja call-site'u o kształcie **własnej** odpowiedzi — pole `ChatOptions.effort` istnieje od 033 dokładnie po to |
| **C-51** | ✅ wpis w `doświadczenia.md` zacommitowany **razem z fixem**, z trzema regułami na przyszłość |
| **C-53** | ✅ zero nowych zależności, tras, modeli i wspólnych komponentów. Odrzucone jako nadmiarowe: nowe narzędzie `get_tasks`, kursor zamiast `offset`, `offset` we wszystkich 56 narzędziach |
| **C-54** | ✅ dwa ustalenia naniesione wstecz: istniejący strażnik pętli (→ `spec.md`) i usterka granicy słowa (→ `plan.md` + nowe **T-2a**) |

Naruszeń nie stwierdzono.

## 5. Regresje

- **Testy sąsiednich modułów:** 1347/1347. Trzy istniejące testy `agentContext` wymagały aktualizacji,
  bo **asercjonowały stary kontrakt** (limit 12 i komunikat „zawęź zapytanie") — to zmiana zamierzona
  i opisana w specu, nie regresja.
- **Zwykłe odczyty bez nowych flag są nietknięte:** test dowodzi, że bez `includeDescription` wynik
  `list_tasks` niesie `hasDescription` dokładnie jak przed 112 — zero kosztu tokenów dla ścieżek,
  które tej zmiany nie potrzebują.
- **Kolejność `list_tasks` doprecyzowana** (`id` jako ostatni klucz). Bez tego PostgreSQL nie
  gwarantuje stałej kolejności przy remisie i stronicowanie mogłoby **gubić rekordy** — zmiana
  wzmacnia istniejące zachowanie, nie zmienia go.
- **Granica słowa (T-2a) zmienia zachowanie strażników intencji** — świadomie i w stronę poprawności:
  formy z polskimi znakami (`pokaż`, `znajdź`, `sprawdź`) zaczynają być łapane. Sprawdzono asercją
  negatywną, że dopasowanie **wewnątrz** słowa nadal nie zachodzi („podajnik", „opiszwierzak"),
  więc nie poszerzyliśmy przypadkowo zakresu strażnika.
- **RBAC/migracje:** brak zmian w uprawnieniach; migracja wstawia jeden wiersz `Report` i nie dotyka
  istniejących danych. Rollback = `git revert`, bez odwracania migracji.

## 6. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

Wszystkie 18 kryteriów spełnione w zakresie możliwym do sprawdzenia bez żywego modelu: **12 w pełni,
6 częściowo, 0 niespełnionych.** Wszystkie bramki zielone, build przechodzi, 1347 testów zielonych.

**Do domknięcia przez właściciela na środowisku testowym (`develop`)** — jedyne, czego sandbox nie
mógł zrobić:

1. Powtórzyć polecenie „przeczytaj obowiązki z projektu Raj i załóż na ich podstawie psa" i
   sprawdzić, że tura kończy się **planem** (AC-6, AC-7), zawiera **listę braków** (AC-10) i mieści
   się w ≤ 3 iteracjach odczytu (AC-5).
2. Porównać sumę z logu `AiCall` z zapisanym punktem odniesienia **1,36 zł** (AC-16) — projekcja
   mówi ~0,48 zł.

Nic z tego nie blokuje merge: to potwierdzenie pomiaru, nie brakująca funkcja.
