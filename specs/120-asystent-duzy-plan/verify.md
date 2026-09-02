# Weryfikacja: 120 — Asystent dowozi DUŻY plan

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Zadania:** ./tasks.md (14/14 odhaczonych)
- **Data:** 2026-09-02
- **Środowisko:** lokalny PostgreSQL 16 (`127.0.0.1:5432/omnia_dev`). **Nigdy prod `DATABASE_URL`**
  — weryfikacja zatrzymana przed `scripts/migrate.js` (C-13).

## 1. Bramki

| Komenda | Wynik |
|---|---|
| `check:migrations` | ✅ Numeracja OK (następny wolny: 0272) — **120 nie dodaje migracji** |
| `check:actions` | ✅ 164 akcje, wszystkie z egzekutorem i kontraktem — **120 nie dodaje żadnej akcji** |
| `check:ai-coverage` | ✅ 611 akcji z zakresem i guardem |
| `check:cost-badge` | ✅ 39 plików wołających model |
| `check:content-memory` | ✅ 39 plików sklasyfikowanych |
| `check:i18n` | ✅ zero tekstów zaszytych w komponentach |
| `check:logs` | ✅ 798 plików serwerowych bez `console.*` |
| `check:boundaries` | ✅ granice modułów trzymają |
| `check:module-registry` | ✅ 23 moduły kompletne |
| `check:ui-contract` | ✅ 25/25 modułów na `ModuleView` |
| `check:owner-columns` | ✅ 2517 wywołań Prismy + 5 prób mutacyjnych |
| `check:pagination` | ✅ każde `findMany` z granicą |
| `check:client-safe` | ✅ żaden moduł nie tworzy `async_hooks` przy imporcie |
| `tsc --noEmit -p tsconfig.test.json` | ✅ bez błędów |
| `next lint --dir src` | ✅ **0 błędów**, 20 ostrzeżeń kosmetycznych — wszystkie **sprzed** tej zmiany |
| `next build` | ✅ Compiled successfully |
| `check:perf` | ✅ 1176 kB najcięższa trasa, suma 69 949 kB — w paśmie ±5 % |
| `npm run test:unit` | ✅ **1364/1364** (9 nowych testów) |
| `scripts/migrate.js` | ⛔ **świadomie nieuruchomione** (C-13) |

## 2. Kryteria akceptacji

### A. Ucięcie nie udaje błędu protokołu

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-1** — ucięcie rozpoznane, informacja **nie skasowana** | ✅ | **Próba mutacyjna uruchomiona**, wynik w konsoli: przy starym `\|\| "{}"` → `parsed = {}` → flaga ucięcia **kasowana**; po zmianie → `parsed = null` → **zachowana**. Obrona jest **dwuwarstwowa i to jest sprawdzone osobno**: nawet gdyby ktoś cofnął T-1, `czyUzytecznyKrok({})` zwraca `false`, więc flaga i tak przetrwa. Test `czyUzytecznyKrok` ma pusty obiekt jako **jawny przypadek** |
| **AC-2** — liczba zmarnowanych wywołań ograniczona i mała | ✅ | `czyPrzerwacBezKroku`: `1 → false`, `2 → true` (test). Wpięte w gałąź „Nieznany step", która do 120 **nie miała żadnego licznika** — i to ona spaliła pięć iteracji. Ścieżka ucięcia zachowuje istniejący `truncationRetries` (ten sam próg) |
| **AC-3** — komunikat mówi prawdę | ✅ | Trzy testy w `agentPartialRun.test.ts`: przy ucięciu komunikat pasuje do `/długoś\|dopuszczaln/` i **`doesNotMatch(/zabrakło kroków/)`**; bez ucięcia dotychczasowy komunikat 032 zostaje. Asercja negatywna jest tu istotą — to dokładnie zdanie, które użytkownik zobaczył nieprawdziwie |

### B. Budżet wyjścia

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-4** — tura po odczycie ma wyraźnie więcej miejsca | ✅ | Test: `budzetWyjscia({maDaneWKontekscie:true})` = 4000 > 1200. W pętli flaga wstaje po **pierwszym udanym kroku `query`** (`if (gainedSomething) maDaneWKontekscie = true`), a budżet liczony jest **przed każdym** `callAgent` |
| **AC-5** — zwykła tura **bez zmian** | ✅ | Test asercjonuje **wartość**: `BAZOWY_BUDZET_WYJSCIA === 1200`, z komentarzem, że AC-5 to wymóg „braku zmiany", nie „prawie braku". Bez danych w kontekście `budzetWyjscia` zwraca dokładnie 1200 |
| **AC-6** — domknięcie ≥ budżet pętli | ✅ | `Math.max(RAPORT_BUDZET_WYJSCIA, budzetWyjscia({maDaneWKontekscie:true}))` = 4000. Dotąd 2800 przy pętli 4000 — **mniej miejsca niż krok, któremu go zabrakło**, i dlatego domknięcie też wróciło ucięte (zmierzone: 2800 tokenów co do jednego) |

### C. Częściowy plan

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-7** — użytkownik dostaje akcje, które się zbudowały | ✅ | 6 testów `odzyskajAkcjeZUcietego`: plan urwany po 2 kompletnych → **2 akcje**; urwanie **wewnątrz stringu** → wcześniejsze akcje zachowane; **klamra w opisie** („zabieg {co 3 miesiące}") nie przesuwa głębokości; brak `actions`/pusta tablica/nie-JSON → pusta lista |
| **AC-8** — jawna informacja o niekompletności | ✅ | Serwer zwraca `niepelny: true`; `AICommandSheet` dokleja `t("planNiepelny")` do treści tury. **To była nietrywialna część**: panel buduje tekst sam i ignoruje `thought`, więc informacja w `thought` byłaby niewidoczna. `check:i18n` zielony |
| **AC-9** — ta sama ścieżka co plan pełny | ✅ | Plan częściowy przechodzi przez `normalizeActions` i zwracany jest tym samym kształtem `body`. `DESTRUCTIVE_ACTION_TYPES` i logika auto-zatwierdzania (041) **nietknięte** — `git diff` na nich pusty |

### D. Pierwotne zadanie właściciela

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-10** — plan z profilem + przeniesionymi obowiązkami | ⚠️ **mechanizm zweryfikowany, zachowanie nie** | Usunięta została **przyczyna**, dla której plan nie miał gdzie się zmieścić (budżet 1200 → 4000 po odczycie) oraz ta, dla której ucięcie kończyło się niczym. Czy model faktycznie zbuduje komplet akcji — rozstrzyga żywy przebieg |
| **AC-11** — lista informacji nieprzenoszalnych | ⚠️ **jw.** | Wymóg stoi w prompcie od 112; 120 daje mu miejsce, w którym się zmieści. Egzekwowalne wyłącznie obserwacją |
| **AC-12** — zadania źródłowe nietknięte | ✅ | Weryfikowalne bez modelu: egzekutor Zwierząt ma **zero** odwołań do Zadań, a 120 nie dodało żadnej akcji (`check:actions`: 164, tyle samo co przed) |

### E. Koszt i nienaruszalność 112

| AC | Werdykt | Dowód |
|---|---|---|
| **AC-13** — taniej niż 1,42 zł | ✅ **w projekcji** | Rachunek z liczników tokenów ze zgłoszenia; **kontrola odtwarza kwotę sprzed zmiany co do czwartego miejsca po przecinku** ($0,3735). Wynik: **−59 %** gdy plan mieści się w 4000 (2 wywołania, pełny plan), **−33 %** gdy się nie mieści (3 wywołania, plan częściowy). W obu wariantach użytkownik dostaje akcje |
| **AC-14** — dorobek 112 nienaruszony | ✅ | `git diff 2f6910f..HEAD` na `modules/tasks/ai/readTools.ts` i `lib/ai/readToolShared.ts` — **pusty**. W `agentContext.ts` **zero linii usuniętych** z `czyCachowacKatalog`, `compactToolResults`, `PER_TOOL_MAX_RECORDS`, `TOOL_RESULT_MAX_CHARS` |

**Bilans: 12 ✅ · 2 ⚠️ · 0 ❌.**

Oba ⚠️ (AC-10, AC-11) to **zachowania modelu językowego**, zapowiedziane jako niesprawdzalne już
w `tasks.md` (notatka pisana **przed** implementacją, nie tłumaczenie po fakcie). Sandbox nie ma
poświadczeń do dostawcy, a odtworzenie tury wydałoby pieniądze z konta właściciela.

## 3. Rachunek (AC-13)

Ceny z `LlmModelPrice`: sonnet-5 $3/$15 za 1M, zapis cache ×1,25, odczyt ×0,1.

| Wariant | Wywołań | Koszt | Zmiana | Co dostaje użytkownik |
|---|---|---|---|---|
| **przed** (log zgłoszenia) | 7 | $0,3735 | — | nic — „nie dokończyłem" |
| po 120, plan mieści się w 4000 | 2 | $0,1544 | **−59 %** | pełny plan |
| po 120, plan się nie mieści | 3 | $0,2486 | **−33 %** | plan częściowy + informacja |

Oszczędność nie bierze się z tańszych wywołań, tylko z **zaprzestania produkowania odpowiedzi do
kosza**: było sześć uciętych, zostaje jedna użyteczna (albo dwie, gdy potrzebna jest próba
skrócenia).

## 4. Zgodność z konstytucją

| Reguła | Ocena |
|---|---|
| **C-01** | ✅ cała zmiana w `worldofmag/` |
| **C-10…C-14** | ✅ bezprzedmiotowe — **zero zmian w schemacie, zero migracji**, zadeklarowane w planie §2 i potwierdzone przez `check:migrations` (następny wolny numer nie drgnął) |
| **C-13** | ✅ lokalny Postgres; `migrate.js` nieuruchomione |
| **C-20…C-25** | ✅ brak Server Actions; guardy nietknięte; **zero nowych `AIAction`** (C-23 spełnione z definicji); brak kasowania i zmian RBAC |
| **C-32** | ✅ jedyny nowy tekst UI (`planNiepelny`) w `messages/pl.json` przez `useTranslations`; `check:i18n` zielony |
| **C-36** | ✅ `platform/ai` nie importuje żadnego modułu; nowe funkcje są czyste i modułowo ślepe |
| **C-40** | ✅ dostawca i model nadal z `/admin/llm` — zmieniamy **budżet odpowiedzi**, nie routing |
| **C-51** | ✅ wpis w `doświadczenia.md` zacommitowany **razem z fixem**, z trzema regułami na przyszłość |
| **C-53** | ✅ **trzy stałe usunięte, nie dołożone**: `AGENT_MAX_TOKENS`, `REPORT_MAX_TOKENS` i `BULK_MAX_TOKENS` wraz z regułą „która z nich" zniknęły z trasy na rzecz jednej polityki w `budzetWyjscia`. Odzysk akcji to jeden helper wołany z dwóch miejsc, nie dwie kopie |
| **C-54** | ✅ 112 pozostaje w mocy (AC-14); ustalenie o zaszytej treści panelu planu zostało zapisane **w planie** (§5), zanim trafiło do kodu |

Naruszeń nie stwierdzono.

## 5. Regresje

- **Testy:** 1364/1364, w tym 9 nowych. Zero zmian w istniejących asercjach — 120 niczego nie
  przedefiniowało, tylko dołożyło.
- **Dorobek 032 zachowany świadomie i sprawdzony testem:** komunikat „zabrakło kroków" **nadal
  pojawia się**, gdy przyczyną faktycznie był brak kroków (test negatywny). Naprawiliśmy fałszywe
  użycie tego zdania, nie usunęliśmy samego zdania.
- **Dorobek 080 zachowany:** próg dla zlecenia wsadowego (wklejona lista ~100 pozycji) żyje dalej
  jako `wsadowe` w `budzetWyjscia`, z zachowaną wartością 4000. Usunięcie `BULK_MAX_TOKENS` przeniosło
  regułę, nie skasowało jej.
- **Plan pełny wygląda dokładnie jak dotąd** — zdanie o niekompletności dokleja się wyłącznie przy
  `niepelny`, więc ~99 % planów nie zmienia wyglądu.
- **RBAC / migracje / dane:** brak zmian. Rollback = `git revert`, bez odwracania migracji.

## 6. Werdykt końcowy

**GOTOWE Z UWAGAMI.**

**12 z 14 kryteriów spełnionych w pełni, 2 częściowo, 0 niespełnionych.** Wszystkie bramki zielone,
build przechodzi, 1364 testy zielone. Przyczyna zgłoszenia — pięć wywołań produkujących treść do
kosza i fałszywy komunikat o przyczynie — została usunięta u źródła i pokryta testami, w tym
**uruchomioną próbą mutacyjną**.

**Do domknięcia przez właściciela na środowisku testowym (`develop`):**

1. Powtórzyć „załóż psa Raj na podstawie zadań" i sprawdzić, że tura kończy się **planem** (pełnym
   albo częściowym z widoczną adnotacją), zawierającym profil zwierzęcia, przeniesione obowiązki
   (AC-10) i listę informacji nieprzenoszalnych (AC-11).
2. Porównać sumę z logu `AiCall` z punktem odniesienia **1,42 zł** (AC-13; projekcja: 0,59–0,95 zł).

Nic z tego nie blokuje merge — to potwierdzenie zachowania modelu, nie brakująca funkcja.
