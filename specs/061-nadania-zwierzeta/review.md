# Recenzja: udostępnienia Zwierząt jako nadania

Zakres: migracja 0230, dwie funkcje lustra, rozszerzenie bramki, wpięcie w trzy ścieżki zapisu,
dwie asercje, dziennik.

## Ustalenia

### 1. Rozszerzenie bramki wykonane RAZEM z rozszerzeniem lustra
*`scripts/check-grant-mirror.js`* · **process** · **zrobione poprawnie, odnotowane**

Łatwo było dopisać `mirrorPetShare` i zostawić bramkę pilnującą tylko dwóch tabel — kod działałby,
a **następna** ścieżka zapisu do `PetShare` przeszłaby niezauważona. Bramka poszerzona w tym samym
kroku i od razu wskazała `pets.ts`.

To jest ta sama zasada, co w 057: **bramka musi obejmować dokładnie ten zakres, co mechanizm** —
nie mniejszy, bo wtedy milczy tam, gdzie jest potrzebna.

### 2. `createdById` dla nadania zespołowego bez właściciela zasobu
*`prisma/migrations/0230_…/migration.sql:56`* · **correctness (drobne)** · **odnotowane**

`COALESCE(p."ownerId", tw."id")` — gdy zwierzę należy do zespołu (brak `ownerId`), jako autora
nadania zapisujemy identyfikator przestrzeni. To nie jest identyfikator użytkownika i nikt go tak
nie czyta (`createdById` nie ma klucza obcego i służy audytowi), ale **nie jest to też prawda**.

Zostawione świadomie: alternatywą było `NULL`, którego kolumna nie dopuszcza, albo dołożenie
zapytania o właściciela zespołu w migracji SQL. Nadania historyczne i tak nie mają zapisanego
autora — pole jest tu przybliżeniem, nie faktem. **Etap 3 może je uporządkować**, gdy stare tabele
znikną i będzie wiadomo, czego audyt naprawdę potrzebuje.

## Rzeczy sprawdzone

- **Odwzorowanie ról** — to samo w migracji i w `resourceRoleFromLegacy`; nagłówek migracji nazywa
  tę zależność.
- **Zwierzę bez przestrzeni** — nadanie nie powstaje, zapis się udaje (wspólna funkcja `zapisz`
  z 059, ta sama asercja).
- **`purge.ts`** — kasuje nadania po `subjectId`, więc obejmuje też `pets.pet`; wyjątek
  w manifeście nadal zasadny.
- **C-17** — odczyty nietknięte; tabela prawdy Zwierząt z 060 bez ruchu.

## Werdykt

**APPROVE Z UWAGAMI.** Etap 1 zadania 12 domknięty dla wszystkich trzech tabel.
