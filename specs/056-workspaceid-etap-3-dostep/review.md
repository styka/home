# Recenzja: rozstrzyganie dostępu czyta przestrzeń — etap 3A

Zakres: `git diff` względem produkcji (`50f27a3d`). Poza plikami generowanymi z treści: trzy pliki
`platform/sharing`, dwa pliki modułu Zadań, dwa testy, artefakty `specs/056-*`, dziennik,
`doświadczenia.md`. **Bez migracji, bez zmian w `src/app/` i `src/components/`.**

## Ustalenia

### 1. Zmieniona komórka odtworzyła asymetrię, którą 053 zamknęło — dla innej osoby
*`src/modules/tasks/lib/sharingGuard.ts:39`* · **correctness** · **naprawione w recenzji**

Świadoma zmiana ze speca §5 daje właścicielowi zespołu **dostęp** do projektów zespołowych.
`accessibleProjectIds` — zakres list — liczył gałąź zespołową z `ctx.teamIds`, czyli z wierszy
`TeamMember`. A cała zmiana dotyczy właśnie osoby, **która takiego wiersza nie ma**.

*Scenariusz:* Szymon jest właścicielem zespołu i nie ma wiersza `TeamMember` (tak powstaje zespół
utworzony inną ścieżką niż `createTeam`). Po tym przebiegu może edytować zadania w projekcie
zespołowym, ale projekt **nie pojawia się na jego liście**, a asystent — który zakres list czyta
z tej samej funkcji — twierdzi, że taki projekt nie istnieje. To jest dosłownie sytuacja opisana
w komentarzu, który 053 zostawiło **w tej samej funkcji**: *„użytkownik ma prawo działać
w projekcie, którego nie widzi"*.

*Poprawka:* gałąź zespołowa idzie po **przestrzeniach**, nie po `ctx.teamIds` — tak samo, jak
rozstrzyga teraz `rolaZWlasnosci`. Z filtrem `rola !== "guest"`, żeby lista była **tym samym**
zbiorem co dostęp, a nie jego nadzbiorem. Sieroty (rekord bez przestrzeni) wychodzą osobną gałęzią
`{ workspaceId: null, ownerTeamId: { in: teamIds } }` — ta sama droga awaryjna, co w rozstrzyganiu,
i zniknie razem z nią w etapie 4.

*Dowód:* nowa asercja w tabeli prawdy sprawdza **oba kierunki** (właściciel widzi, obcy nie).
Kontrola negatywna: przywrócenie starego zakresu → asercja czerwona.

> To ustalenie jest argumentem za podziałem etapu 3 na A i B, ale też jego korektą: **zakres listy,
> który pary się ze zmienioną komórką, musi iść razem z nią.** 3B to sweep po kilkunastu modułach,
> a nie ta jedna funkcja.

### 2. Bramka rozjazdu schematu była POMIJANA, nie zielona
*`scripts/check-schema-drift.js` (środowisko)* · **process** · **naprawione w recenzji**

Build wypisywał *„Rozjazd schematu: pominięty (nie udało się przygotować bazy cienia)"*. Baza cienia
zniknęła przy odtworzeniu kontenera, a rola `e2e` nie ma `CREATEDB`.

*Skutek:* przez cały ten przebieg schemat i migracje **nie były porównywane**, a build i tak
świecił na zielono. Dokładnie ten kształt defektu naprawialiśmy w 051 — i wrócił inną drogą, bo
tamta poprawka dotyczyła rozpoznawania błędu, a nie braku samej bazy.

*Poprawka:* baza cienia odtworzona (`sudo -u postgres createdb -O e2e worldofmag_e2e_shadow`);
bramka w kolejnym buildzie raportuje **„brak rozjazdu"**, nie „pominięty". Odnotowane
w `verify.md`, bo różnica między „sprawdzone" a „nie dało się sprawdzić" jest treścią, a nie
szczegółem środowiska.

### 3. Test licznika zapytań przeszedł, choć nie kompilował się typowo
*`src/platform/sharing/__tests__/queryCount.integration.test.ts:39`* · **correctness (test)** ·
**naprawione w implementacji**

Syntetyczny `AccessContext` w teście nie miał nowych pól. `test:unit` był zielony (tsx nie sprawdza
typów), `tsc --noEmit` też (wyklucza testy) — złapał to dopiero `check:test-types` w buildzie,
czyli bramka dodana w 046 dokładnie na ten przypadek. Warto to odnotować jako **potwierdzenie, że
tamta bramka zarabia na siebie**.

## Rzeczy sprawdzone, w których NIE ma ustalenia

- **Ryzyko odwrotne: rozjazd lustra odbiera dostęp.** Gdy użytkownik ma wiersz `TeamMember`, ale
  **nie** ma `WorkspaceMember` (nieuzgodnione lustro), nowa gałąź odmówi tam, gdzie stara dawała
  dostęp. Zaakceptowane świadomie: lustro pilnuje `check:workspace-mirror` (trzy pliki mutujące
  zespół, każdy uzgadnia), a `reconcileWorkspaces` z 051 jest wykrywaczem rozjazdu i zwraca
  `{0,0,0}` na obecnym stanie. To jest cena okresu przejściowego, znikająca w etapie 4.
- **`guest`.** Nie dostaje nic ani w rozstrzyganiu, ani na liście. Nic dziś tej roli nie produkuje;
  przyznanie czegokolwiek byłoby poszerzeniem na zapas.
- **Liczba zapytań.** Kontekst nadal robi trzy zapytania równolegle — nowe dane weszły jako pola
  i złączenie w istniejącym `workspaceMember.findMany`. Test licznika zielony **bez korekty
  oczekiwań**, co jest mocniejszym dowodem niż zaktualizowana liczba.
- **Rozdzielenie „mój zasób" od `kind`.** Przestrzeń osobista rozpoznawana po
  `personalUserId === userId`, nie po `kind === "personal"` — dzięki temu członek cudzej przestrzeni
  osobistej (gdyby kiedyś powstał) nie dostaje w niej roli właściciela.
- **C-12, C-20, C-23, C-30..C-35.** Nie dotyczy: bez enumów, bez zmian w akcjach, bez `AIAction`,
  zero UI.

## Werdykt

**APPROVE Z UWAGAMI.**

Trzy ustalenia, wszystkie naniesione. Ustalenie 1 jest jedynym istotnym merytorycznie i pokazuje
regułę, którą warto zapamiętać na etap 3B: **zmiana reguły dostępu i zakres listy, który jej
odpowiada, to jedna zmiana, nie dwie.** Rozdzielenie ich daje stan gorszy od obu — użytkownik
z prawem do czegoś, czego nie widzi.

Drugie ustalenie jest przypomnieniem, że **„bramka nie zgłosiła błędu" i „bramka sprawdziła"
to dwa różne zdania** — po raz drugi w tej fazie przy tej samej bramce.
