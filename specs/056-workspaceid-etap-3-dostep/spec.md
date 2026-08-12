# Spec: rozstrzyganie dostępu czyta przestrzeń — etap 3 z czterech (część A)

- **ID:** 056-workspaceid-etap-3-dostep · **Data:** 2026-08-12
- **Moduł(y):** `platform/sharing` + deklaracja zasobów Zadań (dziś jedyna)

## 1. Problem / potrzeba

Po 054 i 055 kolumna `workspaceId` jest **kompletna** — wypełniona wstecz i utrzymywana dla nowych
rekordów przez wyzwalacz. I **nadal nikt jej nie czyta**: `resolveRole` rozstrzyga własność z pary
`ownerId`/`ownerTeamId`, dokładnie jak przed całą Fazą 2.

Rozdz. 8.2 podaje, po co ta kolumna powstała: *„Dziś każde zapytanie musi obsłużyć oba przypadki
(`OR: [{ownerId}, {ownerTeamId: {in: teamIds}}]`). Po zmianie: `where: { workspaceId: { in:
mySpaces } }`."* Dopóki odczyty nie przełączą się na przestrzeń, cała Faza 2 jest **kosztem bez
korzyści**: dwa modele własności zamiast jednego, wyzwalacz utrzymujący ten drugi i lustro
przestrzeni, którego nic nie weryfikuje w działaniu.

**Etap 3 jest momentem, w którym kolumna zaczyna cokolwiek znaczyć** — i jedynym z czterech, który
zmienia zachowanie. Dlatego wymaga tabeli prawdy porównanej komórka po komórce (C-17), a nie
samego „kompiluje się".

**Dlaczego część A.** Etap 3 obejmuje dwie rzeczy o różnym ryzyku: (1) **rozstrzyganie dostępu**
(jeden mechanizm, jeden moduł z deklaracją, 25-komórkowa tabela prawdy z 052/053 jako punkt
odniesienia) i (2) **zakresy list** w zapytaniach kilkunastu modułów (dziesiątki miejsc z
`OR: [{ownerId}, {ownerTeamId}]`). Sklejenie ich dałoby zmianę, w której nie da się odróżnić błędu
przenosin od błędu zakresu — ta sama argumentacja, dla której 053 poszło osobno od 052. Ten
przebieg robi **(1)**.

## 2. Cel i miary sukcesu

- **Cel:** własność zasobu rozstrzyga się przez `workspaceId`, a nie przez parę kolumn — przy
  **identycznych** odpowiedziach dla wszystkich dzisiejszych przypadków.
- **Sukces:** tabela prawdy 25 komórek zgodna z punktem odniesienia z 052/053, **poza komórkami
  wypisanymi wprost w §5**; liczba zapytań na rozstrzygnięcie nie rośnie; build zielony.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby najgroźniejszy krok przebudowy zmieniał dostęp
  **wyłącznie tam, gdzie to zapisałem**, i żebym mógł to sprawdzić tabelą, a nie zaufaniem.
- Jako **użytkownik** chcę widzieć i edytować dokładnie to, co dotąd.

## 4. Kryteria akceptacji

- [ ] **AC-1** — Given zasób w mojej przestrzeni osobistej, when pytam o dostęp, then dostaję rolę
      **taką samą** jak dotąd z `ownerId` — bez dodatkowego zapytania do bazy dla tego przypadku
      (to najczęstsza ścieżka, rozdz. 8.9 pkt 4).
- [ ] **AC-2** — Given zasób w przestrzeni zespołu, when moduł **zadeklarował** własność zespołową,
      then rola wynika z mojej roli w tej przestrzeni; when moduł jej **nie zadeklarował**, then
      **odmowa** — tak jak dziś. Sama obecność przestrzeni niczego nie przyznaje.
- [ ] **AC-3** — Given tabela prawdy (relacja × operacja), when policzę ją po zmianie, then jest
      **identyczna** z punktem odniesienia z 052/053 **z wyjątkiem komórek wymienionych w §5**,
      a każda różnica jest w tym specu nazwana **przed** przełączeniem.
- [ ] **AC-4** — Given zasób z pustym `workspaceId` (sierota — właściciel bez przestrzeni),
      when pytam o dostęp, then rozstrzygnięcie **nie wywala się** i nie przyznaje dostępu komuś,
      kto nie miałby go dotąd.
- [ ] **AC-5** — Given liczba zapytań na jedno rozstrzygnięcie, then **nie rośnie** względem stanu
      dzisiejszego (istnieje na to test z 052).
- [ ] **AC-6** — Given komplet bramek i build, then przechodzą; liczniki **160 / 551 / 35 / 35**
      bez spadku; zero zmian widocznych dla użytkownika.
- [ ] **AC-7** — Given dziennik, then etap 3A odnotowany wraz z tym, co zostaje na 3B i etap 4.

## 5. Świadoma zmiana zachowania — jedna komórka

Przełączenie na przestrzeń **zmienia dokładnie jeden przypadek** i nazywam go tutaj, żeby nie był
„poszerzeniem przy okazji" (C-17):

> **Właściciel zespołu bez wiersza `TeamMember`** zyskuje dostęp do zasobów zespołowych.

Dziś go nie ma, bo `getUserTeamIds` czyta **członkostwa**, a nie własność zespołu — 053 odnotowało
to jako znane ograniczenie. Lustro przestrzeni z 051 **celowo** wpisuje właściciela do przestrzeni
jako `owner`, nawet gdy nie ma wiersza członkostwa (jest na to osobny przypadek w teście lustra).
Po przełączeniu odczytu na przestrzeń ta różnica przestaje istnieć.

**To jest naprawa, nie regresja** — właściciel zespołu, który nie widzi zasobów własnego zespołu,
jest defektem tej samej klasy co „martwe projekty zespołowe" naprawione w 053. Zmiana jest
**nazwana z góry**, ma własne kryterium akceptacji i jedną komórkę w tabeli prawdy.

Wszystko poza tą komórką ma zostać **bez ruchu**.

## 6. Zakres

**W zakresie:** `ResourceFacts` niesie `workspaceId`; krok „własność" w rozstrzyganiu czyta
przestrzeń; kontekst dostępu niesie to, co do tego potrzebne, czytane **razem z resztą** (bez
nowego zapytania); tabela prawdy przeliczona i porównana; deklaracja zasobów Zadań dostosowana.

**Poza zakresem:** **zakresy list** — `OR: [{ownerId}, {ownerTeamId}]` w zapytaniach modułów
(etap 3B, osobny przebieg); **przeniesienie zasobu między przestrzeniami** przy zmianie właściciela
(3B); `NOT NULL`, los sierot i usunięcie `ownerId`/`ownerTeamId` (etap 4); usunięcie wyzwalacza
z 055 i cichych wariantów lustra z 051 (etap 4); deklaracje zasobów pozostałych 18 modułów
(zadanie 13); migracja nadań (zadanie 12).

## 7. Wpływ na Omnia

**RBAC:** bez zmian w uprawnieniach `module.*`. **Dostęp do zasobu:** zmienia się **mechanizm**,
nie wynik — poza jedną nazwaną komórką. **Baza:** bez migracji. **AI:** read-toole Zadań chodzą
przez ten sam guard, więc zmiana obejmuje je automatycznie — i to jest właściwe.

## 8. Zgodność z konstytucją

**C-17** (tabela prawdy przed przełączeniem; zakaz poszerzania „przy okazji" — stąd §5),
**C-21** (własność), **C-36** (platforma bierze katalog parametrem), **C-50**, **C-51**, **C-53**.

## 9. Decyzje właściciela

Właściciel zlecił przebieg w pełni automatyczny. Przyjęte: **podział etapu 3 na A (rozstrzyganie)
i B (zakresy list)** — z tego samego powodu, dla którego 053 poszło osobno od 052: przy zmianie
sposobu podejmowania decyzji o dostępie dowód musi być odróżnialny od zmiany zakresu danych.

## 10. Ryzyka

- **Cicha zmiana w cudzą stronę** (ktoś zyskuje dostęp, o którym nie wiem) → tabela prawdy
  porównywana z zapisanym punktem odniesienia; każda różnica psuje test.
- **Sierota z pustą przestrzenią** → AC-4: rozstrzygnięcie nie może ani rzucić, ani przyznać
  dostępu komuś obcemu. Dopóki `ownerId` istnieje, jest z czego skorzystać awaryjnie — i to
  zniknie dopiero w etapie 4.
- **Wzrost liczby zapytań** → AC-5 i istniejący test licznika zapytań.
