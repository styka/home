# Spec: `workspaceId` utrzymywany dla nowych rekordów — etap 2 z czterech

- **ID:** 055-workspaceid-etap-2 · **Data:** 2026-08-12
- **Moduł(y):** wszystkie modele z własnością — zdolność warstwy danych, nie funkcja modułu

## 1. Problem / potrzeba

Etap 1 (054) dołożył `workspaceId` do 45 modeli i wypełnił kolumnę backfillem migracji 0227.
Kolumna jest **kompletna wobec danych z chwili migracji i niekompletna wobec przyszłych**: rekord
utworzony po 0227 dostaje `NULL`, bo nic tej kolumny nie ustawia.

**To jest dług, który rośnie sam.** Każdy dzień na produkcji to kolejne rekordy, które etap 4
(`NOT NULL`) będzie musiał posprzątać — a etap 3 (przełączenie odczytów) po prostu **ich nie
zobaczy**: zasób z pustą przestrzenią zniknie właścicielowi z listy. Kolejność z rozdz. 8.10 jest
wiążąca — *(a) kolumna nullable + backfill, (b) utrzymywanie dla nowych, (c) przełączenie odczytów,
(d) `NOT NULL`* — a ten przebieg to **(b)** i nic ponadto.

**Dlaczego to nie jest „dopisz jedno pole w kilku miejscach".** Własność ustawia dziś **każda**
ścieżka zapisu tworząca zasób: w `src/actions` i `src/modules` jest **224** wywołań
`create`/`createMany`/`upsert`, a `ownerId` pojawia się w **75 plikach**. Ręczne dopisanie
`workspaceId` w każdym z nich miałoby jedno sprawdzenie — kompilator — a **kompilator nie widzi
BRAKU pola opcjonalnego**. Pominięcie w jednym miejscu nie objawiłoby się niczym aż do etapu 3.
To dokładnie kształt błędu z lekcji „opcjonalny identyfikator w guardzie = ciche wracanie do starej
reguły" i przypadek reguły, którą Omnia stosuje wszędzie indziej: **jeśli pominięcie czegoś nie
objawia się niczym, potrzebna jest bramka, nie dobra wola.**

## 2. Cel i miary sukcesu

- **Cel:** nowy rekord w objętej tabeli ma wypełnioną przestrzeń **bez udziału autora akcji** —
  a nowa ścieżka zapisu, która by ją pominęła, **nie przechodzi builda**.
- **Sukces:**
  - zero nowych rekordów z właścicielem i pustym `workspaceId` (sprawdzane zachowaniem, nie deklaracją);
  - istnieje bramka pilnująca kompletności mechanizmu, z **jawnym wyjątkiem i uzasadnieniem** tam,
    gdzie coś świadomie zostaje poza nim;
  - nadal **zero** odczytów przez `workspaceId`;
  - zero zmian widocznych dla użytkownika.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby najgroźniejszy krok przebudowy nie wymagał ode mnie
  pamiętania o nowej kolumnie w każdej przyszłej akcji.
- Jako **osoba dopisująca nowy moduł** chcę, żeby system **powiedział mi**, że pominąłem przestrzeń,
  zamiast pozwolić mi wdrożyć rekordy, których etap 3 nie zobaczy.
- Jako **użytkownik** nie chcę zauważyć niczego.

## 4. Kryteria akceptacji

- [ ] **AC-1** — Given zalogowany użytkownik, when tworzy zasób w dowolnym z objętych modułów,
      then rekord ma `workspaceId` wskazujący jego **przestrzeń osobistą**, a autor akcji nie
      musiał o tym wiedzieć.
- [ ] **AC-2** — Given zasób tworzony na rzecz **zespołu** (`ownerTeamId`), then `workspaceId`
      wskazuje **przestrzeń tego zespołu**.
- [ ] **AC-3** — Given rekord z **obiema** kolumnami własności, then wygrywa przestrzeń
      **osobista** — tak samo, jak rozstrzyga kontrola dostępu i jak rozstrzygnął backfill 054.
      Reguła jest wyrażona **w jednym miejscu**, wspólnym dla obu ścieżek, a nie powtórzona.
- [ ] **AC-4** — Given właściciel **bez** przestrzeni (np. konto w trakcie usuwania), when rekord
      powstaje, then `workspaceId` zostaje `NULL`, a zapis **przechodzi normalnie** — mechanizm
      nigdy nie wywraca operacji użytkownika z powodu brakującej przestrzeni.
- [ ] **AC-5** — Given nowa ścieżka zapisu tworząca rekord w objętym modelu **bez** ustawienia
      przestrzeni, when uruchamiam build, then **build pada** i wskazuje, czego brakuje; świadome
      wyłączenie wymaga **jawnego wpisu z uzasadnieniem**, a wpis martwy (dotyczący nieistniejącego
      już miejsca) też jest błędem.
- [ ] **AC-6** — Given cała aplikacja, when jej używam, then **zero** odczytów przez `workspaceId`
      i zero zmian widocznych dla użytkownika.
- [ ] **AC-7** — Given komplet bramek i build, then przechodzą; liczniki **160 / 551 / 35 / 35**
      bez spadku.
- [ ] **AC-8** — Given dziennik (rozdz. 15), then etap 2 odnotowany wraz z tym, co zostaje
      na etapy 3 i 4.

## 5. Zakres

**W zakresie:** ustawianie przestrzeni przy tworzeniu rekordu w 45 modelach objętych migracją 0227;
jedno miejsce wyprowadzania reguły „właściciel → przestrzeń", wspólne z regułą backfillu; bramka
kompletności; dowód zachowania (rekord faktycznie powstaje z wypełnioną przestrzenią).

**Poza zakresem:** przełączanie odczytów (etap 3); `NOT NULL` i los sierot (etap 4) — w tym
rekordy z `NULL` powstałe **przed** tym przebiegiem; usunięcie cichych wariantów lustra z 051
(dopiero etap 4); migracja `TaskProjectMember`/`TaskShare`/`PetShare` na nadania (zadanie 12);
deklaracje zasobów pozostałych 18 modułów (zadanie 13); UI udostępniania (zadanie 14);
**zmiana przestrzeni przy zmianie właściciela istniejącego rekordu** — przeniesienie zasobu między
przestrzeniami to operacja etapu 3, gdy kolumna zacznie cokolwiek znaczyć.

## 6. Wpływ na Omnia

**RBAC:** bez zmian — kolumna nadal nieczytana. **Własność:** dokładana obok, nie zastępowana
(C-21). **AI / kalendarz / powiadomienia / kosz:** bez zmian. **Baza:** bez migracji — kolumna już
istnieje; ten przebieg dotyka **ścieżek zapisu**, nie kształtu bazy.

**Ryzyko, które trzeba nazwać wprost:** mechanizm siada na **ścieżce zapisu każdego modułu**. Błąd
w nim nie objawia się brakującym polem, tylko **odrzuconym zapisem użytkownika** — dlatego AC-4
wymaga, żeby brak przestrzeni był obsłużony jako `NULL`, a nie jako błąd.

## 7. Zgodność z konstytucją

**C-13** (tylko lokalny Postgres), **C-20** (`revalidatePath` w akcjach — nietykany), **C-21**
(własność i guardy), **C-50** (komplet bramek), **C-51** (lekcja przy nieoczywistym problemie),
**C-53** (minimalizm — mechanizm ma być jeden, nie 45 poprawek). Migracji nie ma, więc C-10/C-11
nie mają zastosowania; gdyby plan jednak jej wymagał, obowiązuje też **C-15**.

## 8. Decyzje właściciela

Właściciel zlecił przebieg **w pełni automatyczny** („kontynuuj automatycznie wszystko i zatrzymaj
się dopiero, jak wszystko będzie gotowe"), więc pytań nie zadaję. Przyjęte założenia:

1. **Mechanizm jeden, nie 45 poprawek.** Rozstrzygnięcie *gdzie* go umieścić należy do `/plan`;
   spec wymaga tylko, żeby autor akcji nie musiał o kolumnie pamiętać (AC-1) i żeby pominięcie
   było wykrywalne statycznie (AC-5).
2. **Pierwszeństwo własności osobistej** — zgodne z `resolveRole` i z backfillem 054 (AC-3).
3. **Brak przestrzeni nie blokuje zapisu** (AC-4). Zapis użytkownika jest ważniejszy niż
   kompletność kolumny, której nikt jeszcze nie czyta.
4. **Rekordy z `NULL` sprzed tego przebiegu zostają.** Ich sprzątanie to etap 4, który i tak musi
   policzyć sieroty.

## 9. Ryzyka

- **Mechanizm na ścieżce zapisu całej aplikacji** → AC-4 (brak przestrzeni = `NULL`, nie błąd)
  plus wymóg, żeby dowód obejmował **zachowanie**, nie samą deklarację.
- **Bramka zbyt szeroka** → zostanie obejściem („dopisz wyjątek i jedź"). Dlatego wyjątek ma być
  **jawny, uzasadniony i sprawdzany w obie strony** — martwy wpis również jest błędem (wzorzec
  `mirror-coverage.json` z 051).
- **Dodatkowe zapytanie na każdy zapis** → reguła musi umieć wyprowadzić przestrzeń tanio;
  jeśli plan wprowadzi odczyt, ma go pokazać i uzasadnić.
