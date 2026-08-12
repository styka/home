# Spec: Przestrzenie i nadania — fundament danych pod współdzielenie

- **ID:** 051-przestrzenie-i-nadania
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-12
- **Moduł(y):** żaden — to zdolność **platformy** (współwłasność i dostęp), wspólna dla wszystkich 21 modułów

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Omnia ma dziś **pięć niespójnych mechanizmów** decydowania, kto co widzi: `ownerId`, `ownerTeamId`,
`TaskProjectMember`, `TaskShare`, `PetShare` — plus trzy różne słowniki ról
(`MEMBER|ADMIN|OWNER`, `VIEWER|EDITOR`, `String?`). Skutek jest podwójny. Dla użytkownika:
udostępnić da się **zadania i zwierzęta**, a pozostałych dziewiętnastu modułów nie — bo każdy
wymagałby własnej tabeli, własnych ról i własnych guardów. Dla systemu: każde zapytanie w aplikacji
musi obsłużyć dwa przypadki własności naraz (`ownerId` **albo** `ownerTeamId`), a zasób
współdzielony między użytkownikami łamie każdy naiwny podział danych.

Rozdz. 8.1 stawia zasadę: **udostępnianie jest zdolnością platformy, nie funkcją modułu.** Żeby
mogła nią być, potrzebne jest pojęcie, którego dziś nie ma — **przestrzeń**, w której zasób żyje.

**Dlaczego teraz:** Faza 1 domknięta (050), a przestrzeń jest kluczem, który rozdz. 8.2 nazywa
*jedynym elementem Progu C, który musi być w modelu danych już teraz* — dołożenie go później to
migracja stu kilkudziesięciu modeli.

## 2. Cel i miary sukcesu

- **Cel:** w bazie istnieje kompletny, wypełniony danymi fundament współdzielenia — przestrzenie
  i nadania — **przy zerowej zmianie zachowania aplikacji**.
- **Sukces mierzymy:**
  - **każdy** istniejący użytkownik ma dokładnie jedną przestrzeń osobistą, **każdy** istniejący
    zespół — dokładnie jedną zespołową o zgodnym składzie członków;
  - niezmiennik obowiązuje **także dla danych powstałych po wdrożeniu** (nowe konto, nowy zespół,
    zmiana składu) i jest pilnowany testem, nie obietnicą;
  - **zero** przełączonych odczytów: aplikacja czyta dalej przez `ownerId`/`ownerTeamId`, a
    użytkownik nie zauważa niczego;
  - backfill jest **idempotentny** — powtórne uruchomienie nie tworzy duplikatów.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby dołożenie współdzielenia do dowolnego modułu było
  deklaracją kilku linijek, a nie własną tabelą — więc najpierw musi powstać wspólny fundament.
- Jako **osoba rozwijająca Omnię** chcę jednego pojęcia własności zamiast pary
  `ownerId`/`ownerTeamId` rozsypanej po każdym zapytaniu.
- Jako **użytkownik aplikacji** nie chcę zauważyć **niczego** — ten sam widok, te same dane, te same
  uprawnienia. Ten przebieg jest dla mnie niewidzialny i to jest jego kryterium jakości.

## 4. Kryteria akceptacji (testowalne)

**Fundament istnieje i jest spójny ze schematem**

- [ ] **AC-1** — Given schemat bazy po zmianie, when porównuję go z plikami migracji, then **nie ma
      rozjazdu** — kształt opisany w rozdz. 8.3 istnieje w obu źródłach prawdy naraz.
- [ ] **AC-2** — Given rodzaje i role w nowych bytach (rodzaj przestrzeni, rola członka, rodzaj
      podmiotu nadania, rola na zasobie), when sprawdzam ich reprezentację, then są **tekstem
      z zawężającym typem**, nigdy typem wyliczeniowym bazy (C-12).

**Backfill — bo puste tabele niczego nie dowodzą**

- [ ] **AC-3** — Given baza z istniejącymi kontami i zespołami, when backfill się wykona, then
      **każdy** użytkownik ma dokładnie jedną przestrzeń osobistą, a **każdy** zespół dokładnie
      jedną zespołową.
- [ ] **AC-4** — Given zespół z członkami i właścicielem, when powstaje jego przestrzeń, then jej
      skład **odpowiada składowi zespołu** — łącznie z właścicielem, także wtedy gdy nie figuruje on
      na liście członków zespołu.
- [ ] **AC-5** — Given wykonany backfill, when uruchomię go **po raz drugi**, then nic się nie
      duplikuje i nic nie znika. Migracja musi znieść powtórzenie, bo wdrożenie potrafi ją powtórzyć.

**Niezmiennik trzyma się w przyszłości**

- [ ] **AC-6** — Given nowe konto zakładane po wdrożeniu, when powstaje, then dostaje przestrzeń
      osobistą **bez udziału człowieka**.
- [ ] **AC-7** — Given zespół tworzony, usuwany albo zmieniający skład po wdrożeniu, when operacja
      się kończy, then jego przestrzeń **odzwierciedla stan faktyczny**. Kierunek jest
      **jednostronny**: zespół pozostaje źródłem prawdy, przestrzeń jest jego lustrem.
- [ ] **AC-8** — Given dowolny stan bazy, when uruchamiam test niezmiennika, then **wykrywa on
      rozjazd**, a nie tylko istnienie tabel. Sprawdzone **testem negatywnym**: podłożony rozjazd →
      test czerwony.

**Brak regresji**

- [ ] **AC-9** — Given aplikacja po zmianie, when korzystam z niej jak dotąd, then **nic się nie
      zmienia** — żaden odczyt nie idzie przez nowe byty, żaden widok nie wygląda inaczej.
- [ ] **AC-10** — Given komplet bramek i budowanie, when je uruchamiam, then wszystko przechodzi,
      a liczniki 160 / 551 / 35 / 35 nie spadają.

**Dziennik**

- [ ] **AC-11** — Given dziennik przebudowy, when go czytam, then **Faza 2 jest otwarta**, zadanie 9
      odnotowane jako zrobione, a następny krok (zadanie 10) wskazany razem z tym, co ten przebieg
      świadomie zostawił.

## 5. Zakres

**W zakresie:**
- Cztery nowe byty wg rozdz. 8.3: **przestrzeń**, **członkostwo w przestrzeni**, **nadanie dostępu
  do zasobu**, **zaproszenie do zasobu** — w kształcie, który dokument już rozstrzygnął.
- **Wypełnienie ich danymi** (rozdz. 8.10, kroki 1 i 2): przestrzeń osobista na użytkownika,
  przestrzeń zespołowa na zespół wraz ze składem.
- **Utrzymanie niezmiennika w przód**: nowe konto, tworzenie/usuwanie zespołu, zmiany składu.
- **Słownik czterech ról zasobu** (`viewer` < `commenter` < `editor` < `manager`, rozdz. 8.4) jako
  sam słownik — bez logiki egzekwowania.
- Test niezmiennika i wpięcie go w bramki.

**Poza zakresem (świadomie) — każde ma swój numer w checkliście rozdz. 14:**
- **Sprawdzanie dostępu przez wspólną zdolność platformy** (`requireAccess`, dziedziczenie, cache
  per żądanie, unieważnianie zdarzeniem) — **zadanie 10**.
- **Przypisanie 46 modeli do przestrzeni** — **zadanie 11**; rozdz. 8.10 nazywa ten krok
  **najbardziej ryzykownym w całej przebudowie** i wymaga rozbicia na cztery etapy. Ten przebieg
  nie dotyka ani jednego z tych modeli.
- **Przeniesienie trzech istniejących mechanizmów udostępniania na nadania** — **zadanie 12**.
- Kontrola współbieżności (8.5), współredagowanie (8.6), obecność (8.8), UI udostępniania,
  wysyłka zaproszeń.
- **Personel firm w marketplace zostaje osobno** — to rola w organizacji, nie dostęp do zasobu
  (rozdz. 8.10, uwaga do kroku 7). Wciągnięcie go tutaj byłoby pomyleniem dwóch pojęć.
- Jakakolwiek zmiana widoczna dla użytkownika.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** **bez nowych slugów** i bez zmian w istniejącym RBAC. Role przestrzeni
  i role zasobu to **inny wymiar** niż uprawnienia modułowe (`module.*`): pierwsze mówią „do czego
  masz dostęp", drugie „jaką część aplikacji widzisz". Ten przebieg niczego między nimi nie łączy —
  połączenie przyjdzie z zadaniem 10.
- **Własność danych:** **bez zmian.** `ownerId`/`ownerTeamId` pozostają jedynym źródłem prawdy
  o własności i jedyną podstawą odczytów (C-21). Przestrzenie są na razie **lustrem**, nie
  zamiennikiem — dokument przewiduje okres przejściowy, w którym istnieją oba.
- **Asystent AI:** nie dotyczy — zero nowych akcji i read-tooli.
- **Kalendarz / powiadomienia / trash:** bez zmian.
- **Baza danych:** **migracja jest sednem tego przebiegu** — nowe byty plus wypełnienie ich danymi.
  Wyłącznie dokładanie: żadna istniejąca kolumna nie znika i nie zmienia znaczenia, więc wycofanie
  kodu nie wymaga wycofania migracji.

## 7. Zgodność z konstytucją

- **C-10, C-11, C-14** — reguły wiodące: ręcznie napisana migracja z unikalnym numerem, wypełnienie
  danych **idempotentne**. AC-5 podnosi idempotencję do kryterium akceptacji, bo wdrożenie potrafi
  powtórzyć migrację.
- **C-12** — cztery nowe słowniki (rodzaj przestrzeni, rola członka, rodzaj podmiotu, rola na
  zasobie) to **tekst + unia TS**, nigdy typ wyliczeniowy bazy. AC-2 to sprawdza.
- **C-13** — weryfikacja wyłącznie na **lokalnym** Postgresie; backfill dotyka wszystkich kont, więc
  uruchomienie go przeciw produkcyjnej bazie z pętli weryfikacyjnej byłoby szczególnie kosztowne.
- **C-21** — model współwłasności **pozostaje nietknięty**; ten przebieg go nie zastępuje, tylko
  przygotowuje następcę obok.
- **C-22** — RBAC bez zmian; nowe role **nie są** uprawnieniami modułowymi.
- **C-36** — nowe byty należą do **platformy**, nie do modułu: platforma nadal nie zna żadnego
  modułu, a rodzaje zasobów w nadaniach są **tekstem**, nie odwołaniem do modułu.
- **C-53** — minimalizm rozstrzyga dwa kuszące rozszerzenia na „nie": nie przełączamy odczytów
  i nie ruszamy 46 modeli, choć technicznie dałoby się to zrobić „przy okazji".
- **C-50, C-51** — build zielony; nieoczywiste problemy do `doświadczenia.md`.
- **C-54** — jeśli w trakcie okaże się, że kształt z rozdz. 8.3 nie daje się odwzorować na istniejące
  dane (np. rola, której nie ma jak zmapować), poprawiamy **spec**, a nie naciągamy dane.

## 8. Otwarte pytania / decyzje właściciela

**Brak pytań** — właściciel zlecił kontynuację automatyczną, a wszystkie decyzje tego przebiegu są
rozstrzygnięte w dokumencie źródłowym (rozdz. 8.3 podaje kształt, 8.10 kolejność, 14 numer zadania
i jego granice). Założenia przyjęte samodzielnie, wypisane, żeby dało się je zakwestionować:

- **Zespół pozostaje źródłem prawdy, przestrzeń jest jego lustrem.** Odwrotny kierunek oznaczałby
  przełączenie odczytów, czyli zadanie 11 — poza zakresem. Cena: przez okres przejściowy ta sama
  informacja mieszka w dwóch miejscach, więc rozjazd musi łapać test (AC-8), a nie czujność.
- **Nadania i zaproszenia powstają teraz, mimo że NIE MAJĄ KONSUMENTA** — pierwszy przyjdzie
  z zadaniami 10 i 12. To jest świadome odstępstwo od zasady „dowozimy razem z konsumentem" (C-35),
  uzasadnione tym, że kształt jest już rozstrzygnięty w rozdz. 8.3, a checklista umieszcza wszystkie
  cztery byty w jednym zadaniu: jedna migracja zamiast dwóch na tych samych tabelach. **Ryzyko
  nazwane wprost:** gdyby zadanie 10 wykazało, że kształt wymaga zmiany, poprawka będzie kosztować
  drugą migrację. Uznajemy to za tańsze niż migracja dokładana do żywych danych.
- **Rodzaj zespołu (zwykły / gospodarstwo domowe) nie przenosi się na rodzaj przestrzeni.** Rozdz. 8.2
  zna dwa rodzaje przestrzeni: osobistą i zespołową. Rozróżnienie wewnątrz zespołu to cecha zespołu
  i zostaje po jego stronie.
- **Backfill jest częścią migracji, nie osobnym skryptem do uruchomienia ręcznie.** Seed nie odpala
  się automatycznie po wdrożeniu, więc niezmiennik wszedłby w życie dopiero, gdyby ktoś pamiętał.
- **Przestrzeń niesie jawne połączenie ze swoim źródłem** (użytkownikiem albo zespołem) — dopisane
  na etapie planu (C-54). Szkic w rozdz. 8.3 tego nie ma, a bez tego trzy kryteria akceptacji są
  niewykonalne: powtórzenie backfillu nie ma na czym się oprzeć (AC-5), zmiana składu zespołu nie
  ma jak odnaleźć jego przestrzeni (AC-7), a „dokładnie jedna przestrzeń osobista" zostaje
  obietnicą zamiast więzu bazy (AC-3). To **doprecyzowanie kształtu, nie zmiana pomysłu**.

## 9. Ryzyka

- **Backfill dotyka wszystkich kont i zespołów** → wyłącznie dokładanie wierszy do **nowych** tabel;
  żaden istniejący wiersz nie jest zmieniany ani kasowany, więc najgorszy skutek błędu to
  niekompletne lustro, nie utrata danych. Wykonanie sprawdzamy na lokalnej bazie **z danymi**, nie
  na pustej.
- **Właściciel zespołu może nie mieć wiersza członkostwa** → AC-4 wymaga wprost, żeby znalazł się
  w przestrzeni mimo to. To najbardziej prawdopodobne źródło cichego błędu w tym przebiegu:
  odwzorowanie „po członkach" wygląda na kompletne i gubi właściciela.
- **Dwa źródła prawdy przez okres przejściowy** → rozjazd wychodzi dopiero przy zadaniu 11, czyli
  najpóźniej jak się da. Dlatego test niezmiennika jest kryterium akceptacji (AC-8) i musi być
  sprawdzony **testem negatywnym** — test, którego nie widziano na czerwono, nie jest dowodem.
- **Tabele bez konsumenta mogą zostać uznane za martwy kod** → nazwane w §8 jako świadome założenie
  wraz z ceną; dziennik ma to powtórzyć, żeby następny czytelnik nie usunął ich „w ramach porządków".
- **Kuszące rozszerzenie zakresu** (skoro są przestrzenie, to może od razu `workspaceId`…) →
  rozdz. 8.10 wprost ostrzega, że to najbardziej ryzykowny krok przebudowy i wymaga czterech etapów.
  Granica jest w §5 i jest twarda.
