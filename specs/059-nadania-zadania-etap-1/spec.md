# Spec: udostępnienia Zadań jako nadania — zadanie 12, etap 1 z trzech

- **ID:** 059-nadania-zadania-etap-1 · **Data:** 2026-08-13
- **Moduł(y):** Zadania + `platform/sharing`

## 1. Problem / potrzeba

Rozdz. 8.10 wypisuje **pięć mechanizmów udostępniania**, które mają zniknąć na rzecz jednego
`ResourceGrant`. Zadanie 12 dotyczy trzech z nich: `TaskProjectMember`, `TaskShare`, `PetShare`.

Dziś `ResourceGrant` **istnieje i jest czytany** (od 052), ale jest **pusty**: żaden mechanizm nic
do niego nie zapisuje. Dostęp członka projektu przechodzi obok — przez `extraGrants`, czyli furtkę
w deklaracji modułu, opisaną tam jako „dostępy, których nie da się wyrazić własnością ani nadaniem".
To zdanie przestaje być prawdą w chwili, gdy nadania zaczną istnieć.

**Dlaczego tylko Zadania, a nie trzy tabele naraz.** `PetShare` wymaga, żeby Zwierzęta miały
**deklarację zasobu** — inaczej `resolveRole` nie zna typu `pets.pet`, więc nadanie dla niego nie
daje nic, a migracja **zabrałaby** działające udostępnianie. To jest zadanie 13, nie 12; checklista
tej zależności nie pokazuje, ale ona istnieje. Zadania mają deklarację od 052 i są pilotem.

**Dlaczego etap 1 z trzech.** Ta sama kolejność, którą przeszło zadanie 11 i która się sprawdziła:
(1) **zapisywać** nadania obok istniejących tabel, (2) **przełączyć odczyty** z tabelą prawdy,
(3) **usunąć** stare tabele. Nigdy w jednym kroku.

## 2. Cel i miary sukcesu

- **Cel:** każde dzisiejsze członkostwo w projekcie i udostępnienie zadania ma **odpowiadające
  nadanie**, utrzymywane w przód — przy **zerowej** zmianie zachowania.
- **Sukces:** zero rozjazdu między tabelami a nadaniami; bramka nie pozwala dodać ścieżki zapisu,
  która o nadaniu zapomni; odczyty **nietknięte**; build zielony.

## 3. Kryteria akceptacji

- [ ] **AC-1** — Given istniejące członkostwa i udostępnienia, when wykona się migracja, then
      **każde** ma odpowiadające nadanie; ponowne uruchomienie nic nie zmienia.
- [ ] **AC-2** — Given nowe członkostwo albo udostępnienie utworzone w aplikacji, then nadanie
      powstaje **razem z nim**, bez udziału autora akcji tam, gdzie to możliwe.
- [ ] **AC-3** — Given usunięcie członkostwa albo udostępnienia, then odpowiadające nadanie
      **znika** — nadanie, które przeżyło swoje źródło, jest cichym przyznaniem dostępu.
- [ ] **AC-4** — Given odwzorowanie ról, then `MEMBER → editor`, `ADMIN|OWNER → manager`,
      `VIEWER → viewer`, `EDITOR → editor` — zgodnie z tabelą z rozdz. 8.10, a odwzorowanie żyje
      w **jednym** miejscu wspólnym dla migracji i kodu.
- [ ] **AC-5** — Given odczyty, then **nic** się nie zmienia: dostęp nadal rozstrzygają
      `extraGrants` i dzisiejsze guardy. Nadania są zapisywane i **nieczytane**.
- [ ] **AC-6** — Given nowa ścieżka zapisu mutująca członkostwo lub udostępnienie **bez** nadania,
      when uruchamiam build, then **build pada** albo wymaga jawnego, uzasadnionego wyjątku.
- [ ] **AC-7** — Given komplet bramek i build, then przechodzą; liczniki **160 / 551 / 35 / 35**
      bez spadku; zero zmian widocznych dla użytkownika.
- [ ] **AC-8** — Given dziennik, then etap 1 odnotowany wraz z zakresem etapów 2 i 3 oraz
      zależnością `PetShare` → zadanie 13.

## 4. Zakres

**W zakresie:** odwzorowanie ról w jednym miejscu; migracja danych (`TaskProjectMember`,
`TaskShare` → `ResourceGrant`); utrzymywanie nadań przy tworzeniu i usuwaniu; bramka; test
kompletności i test lustra.

**Poza zakresem:** przełączenie odczytów na nadania (etap 2); usunięcie starych tabel (etap 3);
`PetShare` (wymaga zadania 13 dla Zwierząt); `ServiceStaff` — rozdz. 8.10 mówi wprost, że **zostaje**,
bo to rola w firmie, nie dostęp do zasobu; UI udostępniania (zadanie 14).

## 5. Wpływ na Omnia

**RBAC:** bez zmian. **Baza:** migracja **danych**, bez zmian w kształcie (`ResourceGrant` istnieje
od 051). **Dostęp:** bez zmian — nadania zapisywane, nieczytane. **Kosz:** nadanie znika razem
ze źródłem, nie trafia do kosza (to nie jest zasób użytkownika).

## 6. Zgodność z konstytucją

**C-10, C-11, C-14** (ręczna migracja, numer z `next:migration`, idempotencja), **C-16** (wzorzec:
przez okres przejściowy źródło prawdy i jego lustro muszą być uzgadniane przez każdego, kto mutuje),
**C-17** (odczyty nietknięte — zmiana reguły dostępu przyjdzie w etapie 2 z tabelą prawdy),
**C-20/C-21**, **C-50**, **C-51**, **C-53**.

## 7. Decyzje właściciela

Przebieg automatyczny. Przyjęte: **trzy etapy, jak w zadaniu 11**, i **tylko Zadania w tym
przebiegu** — `PetShare` bez deklaracji zasobu Zwierząt oznaczałby migrację, która odbiera
działającą funkcję.

## 8. Ryzyka

- **Nadanie przeżywa swoje źródło** → AC-3; usuwanie idzie tą samą ścieżką co tworzenie, a test
  lustra sprawdza obie strony.
- **Nadanie zapisane, ale nieczytane, więc rozjazd niewidoczny** → dokładnie sytuacja z 051;
  odpowiedź ta sama: bramka + test lustra, bo objawi się dopiero w etapie 2.
- **Dwa odwzorowania ról** (jedno w migracji SQL, drugie w kodzie) → AC-4 wymaga jednego miejsca;
  rozjazd między nimi dawałby inne role rekordom starym i nowym.
