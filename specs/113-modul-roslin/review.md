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

---

# Przebieg 2 recenzji — po fazie 7 (`af7d8ce..HEAD`)

Zakres: siedem commitów domykających ustalenia U-1…U-12. Recenzję świeżym okiem wykonał subagent
`omnia-reviewer`; **każde ustalenie zostało przed przyjęciem potwierdzone w kodzie** — żadne nie
zostało przyjęte na słowo.

Powód, dla którego ta runda w ogóle coś znalazła, jest ten sam co poprzednio i wart zapisania:
poprawki pisane pod listę braków usuwają OBJAW, a nie zawsze dowożą ścieżkę, którą same sobie
w komentarzu obiecują (F-4), i nie sprawdzają, czy tej samej dziury nie ma o piętro wyżej (F-2)
albo w sąsiedniej funkcji (F-3).

## Blokujące

### F-1 · `ui/Ewidencja.tsx:203` · correctness — AC-24, AC-25
**Przy pustym rejestrze formularz zabiegu nie renderuje się w ogóle — pierwszego wpisu nie da się
zrobić.** `ModuleView` w stanie `empty` rysuje `ViewEmpty` **zamiast** `children`
(`ModuleView.tsx:454-462`), a formularz siedzi w `children`; przycisk „Nowy zabieg" jest w `actions`,
czyli w pasku, który rysuje się zawsze.

*Awaria:* rolnik zakłada przestrzeń `field`, wchodzi na `/rosliny/ewidencja` (0 zabiegów) → klika
„Nowy zabieg" → **na ekranie nie zmienia się nic**. `recordTreatment` nie ma innego konsumenta
w aplikacji, więc ewidencja jest nieosiągalna dokładnie dla tego, kto ma ją założyć. Oba kryteria
były spełnione wyłącznie dla konta, które ma już jakiś zabieg w bazie.

### F-2 · `actions/przestrzenie.ts:171-187` + `src/actions/trash.ts` · correctness — AC-7
**Migawka kasowanej PRZESTRZENI nadal nie zawiera dziennika, pomiarów ani zdarzeń zdrowotnych —
a pętla, która miała je odtworzyć, jest pusta.** `plants: true` zwraca same wiersze rośliny, bez
zagnieżdżeń; kaskada usuwa `PlantJournalEntry`/`PlantMeasurement`/`PlantHealthEvent` przez
`Plant.space → Cascade`. `przywrocDzieciRosliny` czyta wtedy `undefined` → trzy puste tablice →
**no-op, który w kodzie wygląda na pokrycie**.

*Awaria:* to jest U-2 piętro wyżej. Ścieżka „usuń roślinę → przywróć" została naprawiona, ścieżka
„usuń przestrzeń → przywróć" nie: rośliny wracają z pustą osią czasu i bez historii diagnoz,
a wpis kosza — jedyna kopia — jest po przywróceniu kasowany.

### F-3 · `actions/rosliny.ts:293` · security
**T-62 pominął `propagatePlant`: `placeId` z klienta idzie prosto do zapisu, bez `sprawdzWskazania`.**
Guard sprawdza wyłącznie rodzica.

*Awaria:* `propagatePlant(<własna roślina>, { placeId: <cudze miejsce> })` tworzy sadzonkę w mojej
przestrzeni, ale z cudzym `placeId`. `getPlaceHistory` pyta `where: { placeId }` **bez zawężenia
przestrzenią**, więc ofiara widzi w „co tu rosło" nazwę pod kontrolą atakującego, a ostrzeżenie
płodozmianowe liczy się z jego wiersza.

## Przy kryteriach akceptacji

### F-4 · `lib/terminy.ts:105-123` · correctness — AC-8
**Gatunek z zerem w bieżącej porze nie dostaje zadania i nie ma ŻADNEJ drogi, żeby je kiedykolwiek
dostać.** Nagłówek obiecuje: „zadanie zakłada się z chwilą pierwszego odnotowanego podlania, tą samą
ścieżką co każde inne" — ta ścieżka nie istnieje: `recordCare` wymaga istniejącego `taskId`,
a `createCareTask` **nie ma konsumenta w `ui/` ani w `app/`** (jedyne wywołanie to zalecenie
diagnozy AI).

*Awaria:* pomidor dodany w styczniu (125 ze 182 wpisów katalogu ma `winter: 0`) i każda uprawa polowa
(20 wpisów ma zera we wszystkich porach — segment sztandarowy dla tego modułu) nigdy nie ma zadania
opieki: nie ma jej w agendzie, w kalendarzu ani w powiadomieniach, a użytkownik nie ma przycisku,
żeby to naprawić. **Rozstrzygnięcie:** to były dwa różne przypadki pod jedną flagą. „Zero w tej
porze, dodatnie w innej" ma **prawdziwą datę** następnego podlania i zadanie ma powstać; „zera we
wszystkich porach" to brak cyklu i zadania być nie powinno — ale wtedy użytkownik potrzebuje wejścia
do `createCareTask`.

### F-5 · `actions/rosliny.ts:157` · correctness
**Własność rośliny bierze się z `teamId` (którego widok nie podaje), a nie z przestrzeni.** Po
przejściu odczytów na `space: { is: zakresPrzestrzeni(…) }` (T-58) rozjazd przestał być widoczny.
`propagatePlant` robi to poprawnie (`rodzic.workspaceId`) — `createPlant` nie.

*Awaria:* członek zespołu dodaje 100 sadzonek do zespołowej szklarni; `Plant.workspaceId` wskazuje
jego przestrzeń OSOBISTĄ. Kasuje konto → `Plant.workspace → Cascade` → **100 roślin znika
z przestrzeni zespołu, bez wpisu w koszu**. Symetrycznie obejmuje je jego eksport i usunięcie danych
z RODO.

### F-6 · `lib/eksportEwidencji.ts:143-163` · correctness — AC-25
**Nazwa pliku liczy pola kalendarzowe w strefie PROCESU z instantów utworzonych w przeglądarce.**
Widok wysyła `new Date("2026-01-01T00:00:00")` = `2025-12-31T23:00Z`; na Renderze (UTC)
`getFullYear()` daje **2025**, więc warunek „cały rok" nigdy nie zachodzi.

*Awaria:* kliknięcie „Cały rok 2026" pobiera `ewidencja-zabiegow-2025-12-31_2026-12-31.csv`. Treść
jest poprawna, nazwa nie — czyli mniejsza wersja dokładnie tej wady, dla której powstało U-5.

### F-7 · `ui/RoslinaSzczegol.tsx:341` · convention — AC-2
**`poleWidoczne(tryb, "faza", true)` jest stałą `true`** (funkcja zwraca `true` dla każdego pola, gdy
trzeci argument jest prawdą). Widok szczegółu nie ma przełącznika „zaawansowane", więc lista 28 kodów
BBCH pokazuje się także w trybie `home`, dla którego `DOMYSLNIE_WIDOCZNE` jest puste — a komentarz
w tym samym pliku nazywa ten segment „jedynym o zerowej tolerancji na parametry". Dodatkowo wywołanie
o stałym wyniku następny czytelnik weźmie za działającą regułę.

### F-8 · `tasks.md` T-58 · correctness (C-54)
**Warunek ukończenia T-58 nie został dowieziony, choć zadanie jest odhaczone, a `verify.md` (AC-28)
się na nie powołuje.** Tabela prawdy nadal ma trzy podmioty (właściciel / członek zespołu / obcy);
przypadek `ResourceGrant` — ten sam, którego brak przepuścił U-3 — wciąż w niej nie występuje.
Poprawka jest w kodzie i wygląda dobrze, ale nie ma dowodu, że działa.

## Drobne

### F-9 · `ui/Ewidencja.tsx:148-172` · correctness
Nowa pozycja jest doklejana na czoło listy **niezależnie od wybranego okresu i od własnej daty** —
zabieg z dzisiaj pojawia się na liście zawężonej do 2025, a eksport (który okres honoruje) go nie
obejmie. Ten sam rozjazd „widok ≠ plik", przed którym broni komentarz nad komponentem.

### F-10 · `actions/rosliny.ts:204` · security
`updatePlant` woła `sprawdzWskazania` **bez `spaceId`**, więc działa gałąź „dowolna moja przestrzeń",
a nie ta, którą opisuje komentarz w `sharingGuard.ts` („miejsce musi należeć do TEJ przestrzeni").
Edytor przestrzeni nadanej może przypiąć własną roślinę do miejsca właściciela i zanieczyścić jego
płodozmian. `spaceId` jest już odczytywane w tej samej funkcji.

### F-11 · `modules/rosliny/calendar.ts:33`, `src/actions/notifications.ts:193` · convention
Po T-58 obdarowany widzi zadania nadanej przestrzeni w agendzie i na pulpicie, ale **nie w
`/calendar` i nie w powiadomieniach** — tam nadal `ownedOrAsync`. To jest wprost historyjka ze speca
(„opiekun podlewa kwiaty przez tydzień"), więc niedokończona zamiana, a nie decyzja. Przy okazji:
`contract.ts` twierdzi, że wkład do kalendarza idzie przez `getCareAgenda` — nie idzie, `calendar.ts`
pyta Prismę wprost.

### F-12 · resztki po zamianach (C-53)
- `messages/pl.json` → `Ewidencja.okresZastosuj` bez konsumenta,
- `domain/harmonogram.ts` — `dzienPrzymrozku(wejscie)` wołane trzy razy na jedno zdanie, z dwoma `!`,
- `actions/zbiory.ts` — gałąź przegranego wyścigu nie odświeża `/rosliny/<spaceId>`,
- `RoslinaSzczegol.potwierdzPadla` nie odświeża widoku, więc świeżo wpisana przyczyna nie pokazuje
  się aż do przeładowania,
- `tasks.md` T-57 wymienia `parentId` w warunku ukończenia, choć `wierszRoslinyZMigawki` świadomie
  go pomija (C-54).

## Sprawdzone i CZYSTE (bez zastrzeżeń)

Arytmetyka pór roku przy granicy roku (przejrzana ręcznie i potwierdzona osobnym przebiegiem),
atomowość `harvestToPantry`, parametryzacja `kubelekAgendy` razem z odpornością `userTimeZone()` na
wywołanie spoza żądania, zawężenia w `sprawdzWskazania` i treść jego komunikatów, C-30/C-31/C-32/C-34
oraz legalność importu kontraktu Roślin w `src/actions/trash.ts`.

## Werdykt: ⛔ ZMIANY WYMAGANE

F-1, F-2 i F-3 blokują. F-4 i F-5 uderzają w kryteria akceptacji. Zadania **T-69…T-80** dopisane do
`tasks.md`.

---

# Przebieg 3 recenzji — po fazie 8 (`9cdb857..HEAD`)

Znów świeżym okiem, znów z potwierdzeniem każdego ustalenia w kodzie. **Trzy z ośmiu są skutkami
ubocznymi poprawek z poprzedniej rundy** — i to jest najważniejsza obserwacja z całego przebiegu:
poprawka pod listę braków ma własne skutki uboczne, więc rundy nie wygasają same. Wygaszać je trzeba
świadomie, sprawdzając po każdej naprawie trzy rzeczy: czy zmiana znaczenia pola dotarła do
WSZYSTKICH jego czytelników, czy tekst interfejsu nadal mówi prawdę o kodzie, i czy nie zamieniliśmy
jednego naruszenia kryterium na drugie.

## Blokujące

### R-2 · `ui/RoslinaSzczegol.tsx:376` · correctness — AC-3
**Poprawka F-7 zamieniła naruszenie AC-2 na naruszenie AC-3.** `poleWidoczne(tryb, "faza")` bez
przełącznika „zaawansowane" (ten widok go nie ma) daje w trybach `home` i `garden` **stałe `false`
bez drogi obejścia** — czyli tryb tu *blokuje*, a nagłówek `lib/tryb.ts` mówi wprost, że tryb chowa
domyślnie i nigdy nie blokuje.

*Awaria:* ogród, pomidor; użytkownik chce zapisać BBCH 65, bo od fazy zależy, czy zalecenie oprysku
jest wykonalne — selektora nie ma i nie ma czym go wywołać. Asymetrycznie: fazę **ustawioną** przy
dodawaniu (tam przełącznik istnieje) widać w wierszu opisu, ale nie da się jej już zmienić ani
wyczyścić.

### R-4 · `actions/ewidencja.ts:252` ↔ `lib/eksportEwidencji.ts:83` · correctness — AC-25
**Poprawka F-6 przeliczyła na strefę użytkownika NAZWĘ pliku, ale nie jego TREŚĆ — w jednej funkcji
zostały dwie różne reguły strefy dla tych samych dat.** Kolumna „Data zabiegu" idzie nadal przez
`getFullYear()` w strefie procesu, czyli przez to samo, co komentarz dwie linijki wyżej nazywa
źródłem błędu.

*Awaria:* oprysk odhaczony o 00:30 czasu polskiego 1 kwietnia zapisuje `occurredAt =
2026-03-31T22:30Z`. Filtr okresu porównuje instanty, więc wiersz **wchodzi** do zakresu 1–30 kwietnia,
plik nazywa się `…-2026-04-01_2026-04-30.csv`, a w środku ten wiersz ma datę `2026-03-31` — dzień poza
okresem zadeklarowanym w nazwie, w dokumencie dla kontroli.

## Przy świeżo dodanej funkcji

### R-3 · `domain/harmonogram.ts:200` ↔ `actions/opieka.ts:132` · correctness
**Komentarz dopisany w tej rundzie twierdzi coś, czemu ta sama runda odebrała prawdziwość.** Stoi
tam, że data techniczna „i tak nikogo nie zobaczy, bo `pomijac` mówi «nie zakładaj zadania»" —
a `createCareTask` **`pomijac` nie czyta** i bezwarunkowo zapisuje `nextDueAt`. Ta sama runda dała
`createCareTask` wejście z interfejsu, z listą rodzajów zawierającą `WATERING`.

*Awaria:* pszenica w przestrzeni `field`. Użytkownik — dokładnie ten, dla którego F-4 kazało zrobić
to wejście — dodaje zadanie „Podlewanie" i dostaje termin dziś+30 dni z uzasadnieniem „ten gatunek
nie ma cyklu podlewania". Zaplanowane podlewanie, którego własne wyjaśnienie mówi, że podlewania się
nie planuje. Dodatkowo sekcja „Zadania opieki" **niczego nie wypisuje**, więc pomyłki nie da się
cofnąć w miejscu, w którym powstała.

### R-1 · `ui/RoslinaSzczegol.tsx:191` · correctness
**Tekst pola obiecuje tryb, którego w systemie nie ma:** „puste = jednorazowo", a pusty odstęp to
gałąź, w której `przeliczTermin` podstawia domyślne 14 dni. Pojęcia zabiegu jednorazowego moduł nie
zna — `recordCare` zawsze wyznacza następny termin.

*Awaria:* „Przesadzanie" z pustym odstępem wraca co dwa tygodnie w nieskończoność.

## Drobne

### R-5 · `lib/terminy.ts:105` · convention (C-54)
Nagłówek opisuje **starą** semantykę `pomijac` („gatunek, który w tej porze nie jest podlewany, nie
dostaje zadania w ogóle" — pomidor w styczniu dostaje je teraz na 1 marca) i wciąż obiecuje ścieżkę
„zadanie zakłada się z chwilą pierwszego odnotowanego podlania", o której F-4 ustaliło, że nie
istnieje. To pierwsze miejsce, do którego zajrzy następna osoba.

### R-6 · `domain/harmonogram.ts:204` · convention (C-32)
Zmiana semantyki `pomijac` wypuściła na produkcję łańcuch, który dotąd nigdy nie był zapisywany —
z błędem gramatycznym: „wracamy do tego na **wiosna**". `NAZWA_PORY` trzyma mianowniki, zdanie
wymaga biernika. To pierwsze zdanie, jakie moduł mówi o swoim najważniejszym rozstrzygnięciu (AC-9).

### R-7 · `src/actions/notifications.ts:192` · simplification
Zamiana na `getCareAgenda({ dni: 3 })` jest równoważna po stronie filtra, ale okno straciło **dolne**
ograniczenie: kontrakt zwraca też wszystkie zaległe, `orderBy asc`, `take: SUFIT_LISTY` (1000)
zamiast lokalnego limitu 200. Przy ≥1000 zaległych zadań opieki żadne nadchodzące nie zmieści się
w `take` i przypomnienia o roślinach zamilkną bez śladu.

### R-8 · `lib/eksportEwidencji.ts:57` · simplification (C-53)
`dzien` wyeksportowane bez importera — ta sama kategoria co martwy klucz z F-12.

## Sprawdzone i CZYSTE

Kompletność migawki przestrzeni (wszystkie pięć poziomów kaskady w `include`, każdy z gałęzią
w `restoreRosliny`, kolejność `createMany` zgodna z kluczami obcymi), własność rośliny po zmianie
(brak rozjazdu w drugą stronę — pozostałe tabele modułu nie mają `workspaceId`), guardy w
`propagatePlant` i `updatePlant`, arytmetyka pór roku przy granicy roku, `recordCare` dla gatunku
sezonowo niepodlewanego, zakres w `calendar.ts` i podniesiona zapadka N+1, tabela prawdy z czwartym
podmiotem (dowodzi osobno decyzji guardu i zakresu list, z kontrolą, że obcy tych samych zapytań nie
przechodzi), `pustyRejestr && !formularz` i `empty.action`, komplet kluczy i18n.

## Werdykt: ⛔ ZMIANY WYMAGANE

Blokują R-2 (naruszone AC-3) i R-4 (dokument prawny z datą wiersza poza okresem w nazwie).
Zadania **T-81…T-88** dopisane do `tasks.md`.

---

# Przebieg 4 recenzji — po fazie 9 (`95eb4b5..d983a4e`)

## Werdykt: ✅ APPROVE Z UWAGAMI

**Brak ustaleń blokujących.** Wszystkie osiem poprawek R-1…R-8 jest w kodzie i robi to, co
deklaruje. Recenzja znalazła jeden realny defekt i jeden tekst, który po tej rundzie przestał mówić
prawdę — oba trafiające dokładnie w punkty (a) i (b) lekcji dopisanej w tym samym commicie do
`doświadczenia.md`, co jest najlepszym możliwym potwierdzeniem, że lekcja opisuje realny wzorzec,
a nie wrażenie.

### Naprawione przed produkcją

**Z-1 · `actions/opieka.ts:279` · correctness.** `recordCare` zapisywało `nextDueAt` **bezwarunkowo**
— zmiana znaczenia `pomijac` dotarła do dwóch z trzech pisarzy tego pola. Odhaczenie podlewania
pszenicy (20 ze 182 wpisów katalogu ma same zera) dorabiało z powrotem techniczną datę „dziś + 30
dni" razem z uzasadnieniem „ten gatunek nie ma cyklu podlewania" — czyli **przywracało dokładnie to,
co T-83 usunęło**, i po 27 dniach wchodziło do agendy, kalendarza i powiadomień.

Poprawione **nie przez dopisanie warunku w trzecim miejscu**, tylko przez sprowadzenie decyzji do
jednej funkcji: `domain/harmonogram.ts` `terminDoZapisu(wynik)` zwraca `{ nextDueAt, reason }`
i używają jej wszyscy trzej pisarze. Warunek powielony w trzech miejscach zgubił się raz i zgubiłby
się znowu; funkcji, której się nie woła, nie da się zapomnieć po cichu — bo pole nie zostanie wtedy
zapisane w ogóle. Ścieżka zapisu dostała **własny test** (trzy przypadki), którego ta runda nie
miała — recenzja słusznie to wytknęła.

**Z-2 · `ui/RoslinaSzczegol.tsx` · correctness (tekst).** Komunikat „Zadanie opieki dodane — pojawi
się w agendzie" był bezwarunkowy, a zadanie bez terminu do agendy nigdy nie trafia. Ekran przeczył
sam sobie w dwóch sąsiednich elementach: toast obiecywał agendę, lista bezpośrednio nad nim mówiła
„bez terminu". Komunikat wybierany jest teraz po odpowiedzi serwera **o tym konkretnym zadaniu**
(po identyfikatorze zwróconym z zapisu, nie po „czy któreś nie ma daty").

### Domknięte przy okazji

- **Z-3** — komentarz przy polu odstępu nadal mówił o „jednorazowo", pojęciu, które R-1 kazało
  usunąć; tekst i komentarz mówią teraz to samo co kod.
- **Z-4** — `dzien` było wyeksportowane bez importera i dublowało `dataWStrefie` (zarzut R-8, który
  T-82 przedwcześnie uznało za zamknięty). Funkcja jest prywatna, a formater `Intl` budowany **raz
  na eksport**, nie raz na wiersz.
- **Z-5** — nowa lista zadań renderowała `slice(0, 10)` na ISO, czyli dzień w UTC — ten sam wzorzec,
  który ten sam commit naprawiał czterdzieści linii dalej w ewidencji.

### Sprawdzone i czyste

Pozostali wołający `getCareAgenda` nie stracili zaległych (parametru `od` nie podają), a `od: now`
w powiadomieniach nie zmienia widocznego zachowania — tylko przestaje zapychać limit zaległościami.
Wszyscy czytelnicy `nextDueAt = null` odcinają nulle poprawnie, `NULLS LAST` nie psuje sortowania.
`getPlantCareTasks` ma guard i wpis w manifeście spójny z rodzeństwem. `poleWidoczne` z przełącznikiem
odsłania fazę we wszystkich czterech trybach. `NAZWA_PORY_BIERNIK` poprawne dla wszystkich pór, i to
jedyne zdanie w module z nazwą pory. Test CSV sprawdza regułę, nie zegar maszyny.

---

## Zamknięcie serii

Cztery rundy recenzji świeżym okiem: **12 → 12 → 8 → 2** ustaleń, blokujących **4 → 3 → 2 → 0**.
Wygaszenie nie nastąpiło samo — w każdej rundzie część ustaleń dotyczyła poprawek z rundy
poprzedniej. To jest główny wniosek metodyczny z tego feature'a i stoi zapisany w `doświadczenia.md`.
