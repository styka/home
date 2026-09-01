# Plan techniczny: Asystent dowozi DUŻY plan

- **Spec:** ./spec.md (113-asystent-duzy-plan)
- **Status:** draft
- **Data:** 2026-09-01

> **Zasada planu:** to jest **JAK**. Musi jawnie zaadresować reguły konstytucji, których dotyka
> feature. Plan pisze się pod istniejący kod — najpierw czytamy sąsiedni moduł i naśladujemy jego
> wzorzec (C-53), potem projektujemy.

## 1. Podejście

Wzorcem jest **112** — ten sam obszar (pętla agenta), ta sama metoda: czysta funkcja decyzyjna
w `platform/ai/agentContext.ts` (tam już mieszka `czyCachowacKatalog`) plus czysta funkcja
protokołu w `platform/ai/agentProtocol.ts`, obie testowalne bez bazy i bez sieci. Zmiana jest
**wyłącznie w warstwie AI i w jednym miejscu interfejsu**: nie rusza schematu, Server Actions,
RBAC ani katalogu akcji.

Kolejność jest częścią projektu: **najpierw przestać marnować wywołania** (rozpoznanie ucięcia),
**potem** podnieść budżet. Odwrotnie podnieślibyśmy cenę sześciu odpowiedzi lecących do kosza.

## 2. Model danych (Prisma)

**Bez zmian w schemacie i bez migracji.** Feature dotyczy przebiegu rozmowy z modelem, a nie danych.
Nie powstaje żadna nowa kolumna ani tabela, więc C-12 (zero enumów) nie ma tu zastosowania, a C-10/
C-11/C-14 są bezprzedmiotowe.

## 3. Warstwa serwera (Server Actions — C-20)

**Bez nowych Server Actions.** Zmiany żyją w trasie API asystenta (`/api/llm/home/agent`), która nie
jest mutacją danych użytkownika — nie ma czego rewalidować. Zapis danych (plan → akcje) idzie
**niezmienioną** ścieżką `/api/llm/home/execute`.

Guardy dostępu (C-21/C-17) **nietknięte**. Feature zmienia wyłącznie ile miejsca model dostaje na
odpowiedź i jak interpretujemy odpowiedź uciętą — nie dotyka ani jednego zapytania do bazy.

## 4. RBAC / rejestr modułu (C-22)

**Bez zmian.** Istniejące slugi; brak nowego modułu, więc `permissions.ts`, `modules.tsx`
i `ModuleSidebar` zostają nietknięte.

## 5. UI (C-30, C-31, C-32)

Jedna, wąska zmiana — wymuszona ustaleniem z rekonesansu:

**Panel planu ma ZASZYTĄ treść.** `AICommandSheet` buduje turę planu z `content:
\`Zaproponowano ${actions.length} akcji\`` i **nie pokazuje `thought` z serwera**. Gdyby informacja
o niepełnym planie poszła w `thought` (naturalny pierwszy odruch), byłaby **niewidoczna** — a AC-8
wymaga, żeby użytkownik ją zobaczył. Dlatego:

- trasa dokłada do odpowiedzi planu dwa pola: `niepelny: true` oraz `pominietoAkcji: <liczba>`
  (gdy nie znamy dokładnej liczby — samo `niepelny`),
- `AICommandSheet` rozszerza treść tury planu o zdanie o niekompletności,
- tekst idzie do `messages/pl.json` i jest czytany przez `useTranslations` (C-32) — **żadnych
  literałów w komponencie**, bo `check:i18n` jest regułą bezwzględną.

Zero nowych kolorów (C-30 nie dotknięte), zero zmian układu i nawigacji (C-31 nie dotknięte).

## 6. AI / integracje (C-23, C-40)

To jest rdzeń. **Nie powstaje żadna nowa `AIAction`**, więc `check:actions` i kontrakt akcji zostają
bez zmian — plan po prostu **mieści się** tam, gdzie dotąd się nie mieścił.

### 6.1 Ucięcie przestaje udawać poprawną odpowiedź (AC-1)

**Diagnoza (potwierdzona eksperymentalnie, nie domysł):** `callAgent` zwraca
`content: result.content || "{}"`. Gdy z uciętej odpowiedzi nie zostaje użyteczna treść, podstawiany
jest `"{}"`, a `extractJsonLoose("{}")` zwraca **prawdziwy, pusty obiekt**. Skutki są trzy:

1. `if (parsed) lastTruncated = false;` — informacja o ucięciu zostaje **skasowana**,
2. strażnik `truncationRetries` **nigdy nie wchodzi**, bo cały żyje w gałęzi `if (!parsed)`,
3. pętla widzi obiekt bez znanego kroku → dopisuje „Nieznany step…" → **spala kolejną iterację**.

Zweryfikowane: `extractJsonLoose("")` i `extractJsonLoose("   ")` zwracają **`null`**, więc usunięcie
podstawienia wprowadza dokładnie to zachowanie, którego chcemy, i nic więcej.

**Zmiany:**
- `callAgent` zwraca `result.content ?? ""` — bez podstawiania `"{}"`. Pusta treść ma **wyglądać na
  pustą**; wartość domyślna, która ukrywa błąd, jest gorsza niż brak wartości.
- `lastTruncated` **nie jest kasowane przez sam fakt sparsowania** — zerujemy je dopiero, gdy
  odpowiedź niesie **użyteczny krok** (`query`/`clarify`/`answer`/`navigate`/`plan`/`report`).
  Dziś obiekt bez kroku wystarczał, żeby uznać ucięcie za nieistniejące.

### 6.2 Marnowanie wywołań ma twardy sufit (AC-2)

Nawet po § 6.1 model może zwracać **parsowalne** odpowiedzi bez użytecznego kroku w nieskończoność —
dziś „Nieznany step…" nie ma żadnego licznika. Dokładamy licznik odpowiedzi **bez użytecznego kroku**,
bliźniaczy do istniejącego `truncationRetries`: po drugiej takiej odpowiedzi kończymy przebieg
zamiast dobijać do limitu iteracji. To jest ta sama reguła, którą 032 wprowadziło dla jałowych
odczytów (`unproductiveIterations`), zastosowana do drugiego rodzaju jałowego obrotu.

### 6.3 Budżet wyjścia dobierany do etapu tury (AC-4, AC-5, AC-6)

**Diagnoza:** `agentMaxTokens` jest liczone **raz, przed pętlą**, z treści wiadomości użytkownika
(`wsadowe ? 4000 : wantsReport ? 2800 : 1200`). Rozmiar planu zależy jednak od **ilości danych, które
asystent przeczytał**, a nie od długości prośby — więc rozpoznanie po wiadomości z zasady go nie
wykryje. Prośba o psa Raj ma trzy zdania; plan to kilkanaście akcji.

**Zmiana:** czysta funkcja `budzetWyjscia({ maDaneWKontekscie, wsadowe, raport })` w
`platform/ai/agentContext.ts` (obok `czyCachowacKatalog` — ten sam plik jest już „polityką pętli").
Zwraca **maksimum** z mających zastosowanie progów:

| Sytuacja | Budżet | Dlaczego |
|---|---|---|
| zwykła tura, brak danych w kontekście | **1200** | bez zmian wobec dziś — AC-5 |
| dane z odczytu są już w kontekście | **4000** | tylko tu jest co wypisywać |
| zlecenie wsadowe (080) | 4000 | zachowane |
| prośba o raport | 2800 | zachowane |

`maDaneWKontekscie` ustawiamy w pętli po **pierwszym udanym kroku `query`** — czyli dokładnie
wtedy, gdy do `messages` trafił blok wyników narzędzi. Budżet liczymy **per wywołanie**, tuż przed
`callAgent`, zamiast przekazywać jedną liczbę z góry.

**Wywołanie domykające** (`finishPartialRun`) dostaje `Math.max(REPORT_MAX_TOKENS, budżet pętli)` —
AC-6 mówi wprost, że domknięcie nie może mieć **mniej** miejsca niż krok, którego nie starczyło.
Dziś ma 2800 przy pętli 4000, co jest odwrotnością sensu.

### 6.4 Częściowy plan zamiast wyrzucenia całości (AC-7, AC-8, AC-9)

Nowa **czysta funkcja** w `platform/ai/agentProtocol.ts`:
`odzyskajAkcjeZUcietego(content): unknown[]` — z uciętej odpowiedzi wyciąga **kompletne, zbalansowane
obiekty akcji** z tablicy `"actions"`, pomijając ten urwany na końcu. Mechanika jest już w tym pliku:
`firstBalancedObject` zna stringi i escape'y; nowa funkcja robi to samo **wewnątrz** tablicy akcji.

Wpięcie w **dwóch** miejscach, oba przez ten sam helper (żeby nie rozjechały się przy pierwszej
zmianie):
- blok degradacji w pętli (po wyczerpaniu prób) — dziś zwraca `step:"answer"` z odratowanym tekstem;
  gdy odpowiedź była **ucięta** i dało się odzyskać choć jedną akcję, zwraca `step:"plan"`,
- `finishPartialRun` — tak samo, gdy domykające wywołanie też zostanie ucięte.

Plan częściowy idzie **istniejącą ścieżką**: `normalizeActions` → panel potwierdzenia → akcje
niszczące domyślnie odznaczone (AC-9, zero zmian w 041). Dokładamy tylko `niepelny`/`pominietoAkcji`
(§ 5).

### 6.5 Prawdziwy komunikat o przyczynie (AC-3)

`describeBlocker` **ma już** gałąź ucięcia jako pierwszą w kolejności — nie mogła zostać użyta,
bo § 6.1 wcześniej kasował flagę. Po naprawie § 6.1 działa bez zmian w tym pliku. Weryfikujemy to
testem, zamiast zakładać.

**C-40 nie jest naruszone:** zmieniamy **ile miejsca** dajemy na odpowiedź; dostawca, model i poziom
wysiłku nadal pochodzą z `/admin/llm`.

## 7. Pliki do utworzenia / zmiany

| Plik | Akcja | Po co |
|------|-------|-------|
| `src/app/api/llm/home/agent/route.ts` | edycja | usunięcie `\|\| "{}"`; `lastTruncated` zerowane dopiero przy użytecznym kroku; licznik odpowiedzi bez kroku; budżet per wywołanie; budżet domknięcia; zwrot planu częściowego (§ 6.1–6.5) |
| `src/platform/ai/agentContext.ts` | edycja | `budzetWyjscia(...)` — czysta polityka budżetu, obok `czyCachowacKatalog` (§ 6.3) |
| `src/platform/ai/agentProtocol.ts` | edycja | `odzyskajAkcjeZUcietego(...)` — odzysk kompletnych akcji z uciętego planu (§ 6.4) |
| `src/platform/ai/__tests__/agentProtocol.test.ts` | edycja | testy odzysku: pełny plan, plan urwany w środku akcji, urwany w stringu, brak akcji |
| `src/platform/ai/__tests__/agentContext.test.ts` | edycja | tabela budżetu (AC-4, AC-5, AC-6) |
| `src/platform/ai/__tests__/agentPartialRun.test.ts` | edycja | ucięcie jako przyczyna, nie „zabrakło kroków" (AC-3) |
| `src/components/assistant/AICommandSheet.tsx` | edycja | treść tury planu mówi o niekompletności (§ 5, AC-8) |
| `messages/pl.json` | edycja | tekst o niepełnym planie (C-32) |
| `doświadczenia.md` | edycja | lekcja o wartości domyślnej ukrywającej błąd (C-51) |
| `CLAUDE.md` | edycja | akapit o 113 w sekcji asystenta |

## 8. Bramki i weryfikacja (C-50)

Lokalnie: Postgres z obrazu, `.env.local` na `127.0.0.1:5432`, `npx prisma migrate deploy`.
**Nigdy prod `DATABASE_URL`** (C-13) — weryfikacja do kroku `next build`, bez `scripts/migrate.js`.

Kolejno: `check:migrations` · `check:actions` · `check:ai-coverage` · `check:cost-badge` ·
`check:i18n` · `check:logs` · `check:boundaries` · `check:module-registry` · `check:ui-contract` ·
`test:unit` · `tsc --noEmit -p tsconfig.test.json` · `next lint --dir src` · `next build` ·
`check:perf`.

| AC | Jak sprawdzamy |
|---|---|
| AC-1 | test: pusta treść modelu → `parsed === null` i flaga ucięcia **zachowana**; obiekt bez kroku → flaga też zachowana. **Próba mutacyjna:** przywrócenie `\|\| "{}"` musi wywalić test |
| AC-2 | test czystej funkcji licznika: druga odpowiedź bez użytecznego kroku kończy przebieg; liczba wywołań ograniczona |
| AC-3 | test `describeBlocker`/`partialRunFallbackMessage`: przy ucięciu komunikat mówi o **limicie długości**, a nie „zabrakło kroków" |
| AC-4, AC-5, AC-6 | test tabeli `budzetWyjscia`: brak danych → 1200; dane w kontekście → 4000; raport bez danych → 2800; domknięcie ≥ budżet pętli |
| AC-7 | test `odzyskajAkcjeZUcietego`: plan urwany po 3 kompletnych akcjach → zwraca **3** akcje |
| AC-8 | test: odpowiedź planu częściowego niesie `niepelny`; przegląd UI, że treść tury o tym mówi |
| AC-9 | przegląd kodu: plan częściowy przechodzi przez `normalizeActions` i tę samą ścieżkę zwrotu co pełny; `DESTRUCTIVE_ACTION_TYPES` nietknięte |
| AC-10, AC-11, AC-12 | scenariusz ręczny na `develop` — wymaga żywego modelu (patrz § 9) |
| AC-13 | rachunek z liczników tokenów + porównanie z 1,42 zł |
| AC-14 | przegląd diffu: zero zmian w `czyCachowacKatalog`, `compactToolResults`, `offsetOf`, `list_tasks` |

## 9. Ryzyka techniczne i plan wycofania

- **Ryzyko: `odzyskajAkcjeZUcietego` odda akcję niekompletną semantycznie** (zbalansowany JSON, ale
  brakuje `params`, bo model nie zdążył). → Odzyskane akcje przechodzą przez `normalizeActions`
  i **walidację kontraktu akcji** w egzekutorze — tę samą, co akcje z pełnego planu. Nic nie omija
  istniejącej bramki; w najgorszym razie akcja zostanie odrzucona przy wykonaniu, jak dziś.
- **Ryzyko: podniesiony budżet zbliża do limitów przepustowości dostawcy** (rezerwacja `max_tokens`
  liczy się do TPM — powód, dla którego 1200 było domyślne). → Dlatego podnosimy **wybiórczo**, tylko
  po odczycie danych (AC-5), a nie dla całej pętli.
- **Ryzyko: naprawa rozpoznawania ucięcia zepsuje ścieżkę degradacji formatu** z 030 (model zwraca
  prozę zamiast JSON). → To dwa różne problemy i muszą prowadzić do dwóch różnych zachowań;
  rozróżnienie jest osobnym testem, nie efektem ubocznym.
- **Ryzyko: naruszymy dorobek 112 przy okazji.** → AC-14 jest kryterium akceptacji, weryfikowanym
  przeglądem diffu, a nie dobrymi chęciami.
- **Ograniczenie środowiska (znane z 112, powtórzy się):** AC-10/AC-11/AC-12 to zachowania modelu —
  sandbox nie ma poświadczeń do dostawcy, a odtworzenie tury wydałoby pieniądze z konta właściciela.
  Zweryfikujemy **mechanizm**, a scenariusz na żywo zostaje właścicielowi na `develop`. Zapisujemy to
  wprost, zamiast oznaczać AC jako spełnione „na oko".
- **Rollback:** czysto kodowy, brak migracji. Wycofanie = `git revert`.

## 10. Zgodność z konstytucją — checklista

- [x] **C-10..C-14** — bezprzedmiotowe: **zero zmian w schemacie i zero migracji**, napisane wprost
      w § 2.
- [x] **C-20..C-25** — brak nowych Server Actions (nie ma czego rewalidować); guardy dostępu
      nietknięte (C-21/C-17); **żadnej nowej `AIAction`**, więc C-23 spełnione z definicji; brak
      kasowania (C-24) i brak zmian RBAC/konfiguracji (C-25).
- [x] **C-30..C-32** — zero hardcodowanych kolorów, zero zmian układu; jedyny nowy tekst UI idzie
      przez `t()` do `messages/pl.json`, bo `check:i18n` nie dopuszcza literałów.
- [x] **C-36** — `platform/ai` nie importuje żadnego modułu; nowe funkcje są czyste i modułowo ślepe.
- [x] **C-40** — dostawca, model i wysiłek nadal wyłącznie z `/admin/llm`; zmieniamy budżet
      odpowiedzi, nie routing.
- [x] **C-51** — wpis do `doświadczenia.md` jest pozycją w tabeli plików.
- [x] **C-53 (minimalizm)** — świadomie sprawdzone. Zero nowych zależności, tras, modeli, komponentów.
      **Odrzucone jako nadmiarowe:** dzielenie planu na zatwierdzane partie i wykonywanie etapami
      (właściciel wybrał „jeden plan, budżet dobrany do zadania"), zapowiedź zamiaru przed planem
      (odrzucona wprost), własny mechanizm ponawiania z rosnącym budżetem (wystarczy dobrać budżet
      od razu), nowa stała na „duży budżet" obok istniejącej 4000.
- [x] **C-54** — plan nie unieważnia 112; AC-14 czyni z jego nienaruszalności kryterium. Ustalenie
      o zaszytej treści panelu planu (§ 5) zostało odkryte w rekonesansie i **zmieniło kształt
      rozwiązania** — dlatego stoi w planie, a nie w komentarzu w kodzie.
