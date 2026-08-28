# Recenzja: Moduł Rośliny

- **Spec:** ./spec.md · **Plan:** ./plan.md · **Weryfikacja:** ./verify.md
- **Data:** 2026-08-28
- **Zakres:** `git diff origin/develop...HEAD` — 86 plików, ~11 000 linii
- **Werdykt:** ⛔ **ZMIANY WYMAGANE**

> Recenzję świeżym okiem wykonał subagent `omnia-reviewer`; **każde ustalenie zweryfikowałem
> następnie na kodzie** i żadnego nie przyjąłem na słowo. Wszystkie poniższe potwierdziły się.
> Dwa ustalenia (§13 recenzenta) dotyczyły stanu sprzed moich commitów w trakcie recenzji i są już
> zamknięte — opisane w §4.

---

## 1. Ustalenia blokujące

### U-1 · `actions/przestrzenie.ts:171-177` · correctness
**Migawka kosza przy kasowaniu przestrzeni nie zawiera ewidencji zabiegów, którą kaskada FK usuwa
bezpowrotnie.** `include` bierze `places` i `plants`; tymczasem migracja 0272 kasuje kaskadą także
`PlantCareEvent` i `PlantCareTask` (sprawdzone: dwa `ON DELETE CASCADE` po `spaceId`).

*Scenariusz awarii:* rolnik ma „Pole 12" z trzema latami zabiegów ŚOR. Klika „usuń przestrzeń" →
migawka zapisuje nazwę, miejsca i rośliny → `delete` kasuje kaskadą **cały rejestr** → „Przywróć"
oddaje przestrzeń z roślinami, a **rejestr nie wraca nigdy** (nie ma go w migawce, a wpis kosza jest
po przywróceniu kasowany). To wprost przeczy nagłówkowi `retention.ts`, który wyłącza ewidencję
z automatycznego usuwania — z tą różnicą, że tutaj niszczy ją jedno kliknięcie użytkownika.

*Poprawka:* dołożyć `careTasks` i `careEvents` do migawki i odtwarzać je przy przywracaniu.

### U-2 · `src/actions/trash.ts` (gałąź `plant`) · correctness
**Przywrócenie rośliny odtwarza sam wiersz — dziennik, pomiary i zdarzenia zdrowotne, zebrane
w migawce, są ignorowane; nie wracają też daty.** `deletePlant` zbiera trzy kolekcje do payloadu,
a `restoreRosliny` robi jedno `plant.createMany`.

*Scenariusz awarii:* użytkownik prowadzi zdjęcia monstery przez rok (30 wpisów), kasuje ją omyłkiem,
przywraca → roślina wraca z **pustą osią czasu**, zerem pomiarów i bez historii diagnoz, a wpis kosza
(jedyna kopia) znika. Ginie dokładnie ta funkcja, którą badania nazwały najsilniejszym mechanizmem
utrzymania użytkownika. Osobno: `sownAt` nie wraca, a `getPlaceHistory` liczy z niego rok sezonu —
przywrócona roślina posadzona w 2023 dostaje rok przywrócenia i **ostrzeżenie płodozmianowe zaczyna
liczyć nieprawdę**.

### U-3 · wszystkie zapytania listujące modułu · correctness
**Guard uwzględnia nadania, ale żadna lista ich nie uwzględnia — udostępniona przestrzeń jest
widoczna i pusta.** `ownedWhereAsync` to `workspaceId IN (moje przestrzenie)`; moduł nie woła ani
razu `idZasobowNadanychMi` (sprawdzone: 0 wystąpień, przy 1 w Notatkach).

*Scenariusz awarii* — dosłownie historyjka ze speca („opiekun podlewa kwiaty przez tydzień"):
właściciel udostępnia przestrzeń rolą `editor`. Osoba obdarowana wchodzi na `/rosliny` → **przestrzeni
nie ma na liście**; wchodzi z linku → widok się rysuje (guard zna nadanie), ale `getPlants`,
`getCareAgenda` i `getCareHistory` zwracają **zero**. Udostępnienie wpuszcza do pustego ekranu, czyli
wygląda jak awaria danych, a nie jak brak dostępu.

*Dlaczego weryfikacja tego nie złapała:* tabela prawdy sprawdza właściciela, członka zespołu i obcego —
**przypadek `ResourceGrant` nie występuje w niej ani razu**, a AC-28 zaliczyłem na obecności
`ShareDialog` i deklaracji. To błąd mojej weryfikacji, nie tylko kodu.

### U-4 · `domain/agenda.ts` + migracja 0273 · correctness
**Zero w `waterJson` znaczy w seedzie „nie licz odstępu", a w kodzie jest traktowane jak śmieć
i zastępowane domyślnymi 14 dniami.** Potwierdzone: **125 ze 182** wpisów katalogu ma `winter: 0`.

*Scenariusz awarii:* użytkownik dodaje w styczniu pomidora → harmonogram „Podlewanie za 14 dni,
uzasadnienie: zima — odstęp podstawowy 14 dni" → pozycja w agendzie, wpis w kalendarzu i
powiadomienie. Reguła niczego „świadomie nie pomija" — zgaduje.

*Zaostrzenie:* test `agenda.test.ts` **utrwala ten błąd**, sprawdzając `winter: 0` jako „bezsensowne
pole, bierze zapas". Test powtarza implementację zamiast sprawdzać regułę zapisaną w migracji.

## 2. Ustalenia wpływające na kryteria akceptacji

### U-5 · `ui/Ewidencja.tsx` · correctness — AC-25
**„Eksport za wybrany okres" nie istnieje: przycisk woła akcję bez argumentów, a nazwa pliku i tak
twierdzi, że to jeden rok.** W 2028 rolnik dostaje `ewidencja-zabiegow-2028.csv` zawierający zabiegi
z 2026, 2027 i 2028. Dokument o nazwie mówiącej co innego niż zawartość jest gorszy niż jego brak.

### U-6 · `ui/Ewidencja.tsx` · correctness — AC-24
**Formularz zabiegu nie ma daty ani wskazania uprawy/miejsca — trzy kolumny dokumentu są
strukturalnie niewypełnialne.** Oprysk wpisany dwa dni później dostaje datę wpisania; kolumny
„Uprawa / roślina" i „Miejsce" są zawsze puste, a `brakiEwidencji` tego nie zgłasza, więc wpis
pokazuje się jako **kompletny**.

### U-7 · `actions/rosliny.ts`, `actions/opieka.ts`, `actions/analiza.ts` · security
**Klucze obce podane przez klienta (`placeId`, `speciesId`, `parentId`, `plantId`) nie są sprawdzane
pod kątem przynależności do zakresu wołającego.** Guard weryfikuje wyłącznie `spaceId`.

*Scenariusz awarii:* atakujący woła `createPlant({ spaceId: własna, parentId: <id cudzej rośliny> })`
→ zapis przechodzi → `getPlant` zwraca `parent: { name }`, czyli **nazwę cudzej rośliny**;
symetrycznie ofiara widzi cudzą roślinę jako swoje potomstwo. Cięższy wariant:
`createCareTask({ spaceId: własna, plantId: <cudza roślina> })` + `recordCare` tworzy zdarzenie
z `plantId` ofiary, a `diagnosePlant` czyta zdarzenia **bez zawężenia przestrzenią** — treść
kontrolowana przez atakującego wchodzi do promptu diagnozy ofiary.

### U-8 · `actions/zbiory.ts` + `ui/RoslinaSzczegol.tsx` · correctness — AC-15
**`getHarvests` nie ma konsumenta; „do spiżarni" i „zapisz koszt" działają wyłącznie dla zbioru
zapisanego w bieżącej sesji strony.** Po przeładowaniu stan znika, a lista zbiorów nigdzie się nie
renderuje — zbiór istnieje w bazie i **nie ma do niego drogi z interfejsu**.

### U-9 · sześć funkcji bez konsumenta · C-35 — AC-7
`deleteSpace`, `updatePlace`, `deletePlace`, `updateCareTask`, `updateSpecies`, `listaFaz`.
Potwierdzone `grep`-em: `deleteSpace` ma **zero** wystąpień w `ui/` i `app/`, więc **usunięcie
przestrzeni jest nieosiągalne z aplikacji**, choć AC-7 je wymienia. Osobno `Plant.stage` nie ma
edytora, więc `etykietaFazy` i `poleWidoczne(…, "faza")` nigdy nie mają czego pokazać.

**To jest także błąd mojej weryfikacji:** `verify.md` §3 twierdzi, że C-35 jest naprawiona, bo
„każda z jedenastu funkcji ma konsumenta". Sprawdziłem jedenaście funkcji z listy braków, a nie
**wszystkie** eksporty modułu. Zdanie w `verify.md` wymaga korekty (C-54).

### U-10 · `ui/RoslinaSzczegol.tsx` · convention (C-34, C-32)
**`window.prompt` zbiera przyczynę śmierci rośliny.** Ta sama klasa okna, którą konstytucja zakazuje
dla potwierdzeń, i z tych samych powodów: nie zna skórki, przyciski w języku systemu, blokuje wątek.
Dodatkowo na iOS w trybie PWA `prompt` bywa tłumiony — wtedy użytkownik **nie ma jak oznaczyć rośliny
jako padłej**, czyli traci funkcję, którą moduł sam nazywa najcenniejszą daną zwrotną.

## 3. Ustalenia drobne

### U-11 · `domain/agenda.ts` · correctness
„Koniec dnia" liczony `setHours(23,59,59,999)` na czasie **serwera**, a nie przez `lib/userTime.ts`
(strefa użytkownika). Render chodzi w UTC, więc dla Polski granica kubełków przesuwa się o dwie
godziny. Konwencja repo mówi wprost, żeby do „dziś/zaległe" używać `userTime`.

### U-12 · `actions/zbiory.ts` · correctness
Idempotencja `harvestToPantry` jest w trybie odczyt-potem-zapis; dwa szybkie kliknięcia dadzą dwie
pozycje w spiżarni i jedną zapamiętaną. Komentarz obiecuje więcej, niż kod dowozi.

**Przyjęte bez zmian (zgłoszone przez recenzenta, uznane za nieistotne):** martwy wariant
`outcome: "worse"` w interfejsie oraz ogólne klucze w `PARAM_LABELS` — pierwsze to ścieżka, którą
uzupełnimy przy okazji, drugie to własność wspólnego słownika sprzed tego feature'a.

## 4. Ustalenia zamknięte w trakcie recenzji

Recenzent pracował na `HEAD` sprzed moich commitów; dwa jego ustalenia (§13) są już naprawione
i zacommitowane, a ja znalazłem je niezależnie, zanim jego raport dotarł:

- **Kolizja nazw łacińskich w katalogu** vs `UNIQUE (workspaceId, nameLatin)` — dziewięć par wpisów
  dzieli nazwę gatunku (cukinia/dynia/kabaczek = `Cucurbita pepo`). Dodanie dyni po cukinii zwracało
  **cukinię**, a roślina dostawała cudze wymagania wodne. Naprawione migracją 0274 (unikalność po
  `catalogKey`) + `upsert` zamiast „sprawdź i utwórz" (wyścig dwóch kart).
- **`identifyPlant` bez `userId`** — omijało miesięczny budżet AI i limit zapytań. Naprawione.

---

## 5. Werdykt: ⛔ ZMIANY WYMAGANE

Cztery ustalenia blokujące (U-1…U-4) opisują utratę danych przy operacjach reklamowanych jako
odwracalne, udostępnianie wpuszczające do pustego widoku i regułę, która zgaduje zamiast liczyć.
Sześć kolejnych (U-5…U-10) dotyczy kryteriów akceptacji, które weryfikacja zaliczyła zbyt pobieżnie.

**Wniosek o samej weryfikacji, ważniejszy od pojedynczych błędów:** drugi przebieg `/verify` wystawił
„30/30 z dowodem", a recenzja świeżym okiem znalazła dwa kryteria zaliczone na podstawie **obecności
mechanizmu zamiast jego skutku** (AC-28 — jest `ShareDialog`, więc uznałem udostępnianie za działające;
AC-7 — jest `deleteSpace`, więc uznałem usuwanie za dostępne). Dowód „funkcja istnieje i ma guard" nie
jest dowodem „użytkownik dostaje to, co obiecuje kryterium".

Poprawki wypisane jako **T-56…T-67** w `tasks.md`. Powrót do `/implement`; `verify.md` wymaga korekty
w dwóch miejscach (C-54), bo zawiera twierdzenia, które recenzja obaliła.
