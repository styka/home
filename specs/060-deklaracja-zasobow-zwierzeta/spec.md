# Spec: deklaracja zasobów Zwierząt — zadanie 13, moduł 2 z 19

- **ID:** 060-deklaracja-zasobow-zwierzeta · **Data:** 2026-08-13
- **Moduł(y):** Zwierzęta + `platform/sharing`

## 1. Problem / potrzeba

Zadanie 13 wymaga, żeby **wszystkie** moduły deklarowały swoje typy zasobów, a dostęp rozstrzygała
platforma. Dziś robi to **jeden** moduł — Zadania, pilot z 052. Osiemnaście pozostałych ma własne
guardy z własnymi słownikami ról.

052 świadomie odłożyło resztę: *„każdy wymaga własnej tabeli prawdy, więc dziewiętnaście naraz
to dziewiętnaście niesprawdzonych zmian w kontroli dostępu"*. Ten przebieg bierze **jeden** —
Zwierzęta.

**Dlaczego akurat Zwierzęta.** Są jedynym modułem poza Zadaniami, który **ma już udostępnianie**
(`PetShare`, role `VIEWER|EDITOR`). Deklaracja od razu ma więc co wyrażać, a nie jest zapisem na
zapas. Odblokowuje też migrację `PetShare` na nadania — brakującą trzecią część zadania 12.

## 2. Cel i miary sukcesu

- **Cel:** dostęp do zwierzęcia rozstrzyga platforma, przy **identycznych** odpowiedziach.
- **Sukces:** tabela prawdy (relacja × operacja) zgodna z punktem odniesienia policzonym **przed**
  przełączeniem, komórka po komórce; build zielony.

## 3. Kryteria akceptacji

- [ ] **AC-1** — Given właściciel zwierzęcia, then ma pełny dostęp, jak dotąd.
- [ ] **AC-2** — Given członek zespołu będącego właścicielem, then ma **pełny** dostęp — tak jak
      dziś; dzisiejszy guard nie różnicuje tu odczytu i edycji, więc odwzorowanie **nie może**
      różnicować.
- [ ] **AC-3** — Given udostępnienie `VIEWER`, then odczyt tak, edycja nie. Given `EDITOR`, then
      odczyt i edycja.
- [ ] **AC-4** — Given udostępnienie dla **zespołu**, then każdy jego członek dostaje tę rolę.
- [ ] **AC-5** — Given osoba obca, then odmowa na każdej operacji.
- [ ] **AC-6** — Given tabela prawdy policzona **przed** i **po** przełączeniu, then jest
      identyczna **poza komórkami wymienionymi w §3a**; punkt odniesienia powstaje przed zmianą,
      nie po.

- [ ] **AC-7** — Given komplet bramek i build, then przechodzą; liczniki **160 / 551 / 35 / 35**
      bez spadku; zero zmian widocznych dla użytkownika.
- [ ] **AC-8** — Given dziennik, then odnotowany moduł 2 z 19 i to, co odblokowuje.

## 3a. Świadoma zmiana zachowania — dwie komórki *(dopisane po pomiarze, C-54)*

Punkt odniesienia pokazał **dwie** różnice, obie w jednym wierszu:

> **Właściciel zespołu bez wiersza `TeamMember`** zyskuje dostęp (odczyt i edycja) do zwierzęcia
> należącego do jego zespołu.

To **ta sama zmiana, którą nazwało 056** dla Zadań, tylko ujawniona w drugim module: rozstrzyganie
czyta przestrzeń, a lustro z 051 celowo wpisuje właściciela zespołu do przestrzeni jako `owner`,
podczas gdy `getUserTeamIds` czyta wyłącznie członkostwa. Spec 060 zakładał „identycznie", bo nie
przewidziałem, że fixture Zwierząt też trafi w ten przypadek — poprawione tutaj, **przed**
przyjęciem nowego punktu odniesienia.

Właściciel zespołu, który nie widzi zwierzęcia swojego zespołu, jest defektem tej samej klasy co
martwe projekty zespołowe naprawione w 053. Pozostałe **22 komórki bez ruchu**.

## 4. Zakres

**W zakresie:** `src/modules/pets/sharing.ts` (deklaracja typu `pets.pet`); wpięcie w korzeń
kompozycji; przełączenie `assertPetAccess` na `requireAccess`; tabela prawdy.

**Poza zakresem:** migracja `PetShare` na nadania (osobny przebieg, po tym); zakresy list Zwierząt
(idą już przez `ownedWhere` z 057/058, a udostępnienia zostają jawnie — decyzja z 057); pozostałe
17 modułów; UI udostępniania (zadanie 14).

## 5. Wpływ na Omnia

**RBAC:** bez zmian. **Baza:** bez migracji. **Dostęp:** zmienia się **mechanizm**, nie wynik.
**AI:** read-toole Zwierząt wołają ten sam guard, więc obejmuje je ta sama zmiana.

## 6. Zgodność z konstytucją

**C-17** (tabela prawdy przed przełączeniem; zakaz poszerzania „przy okazji"), **C-21**, **C-36**
(deklaracja modułu, wpięcie w `src/lib/sharingResources.ts` sprawdzane w obie strony), **C-50**,
**C-51**, **C-53**.

## 7. Decyzje właściciela

Przebieg automatyczny. Przyjęte: **jeden moduł na przebieg** — zgodnie z rozstrzygnięciem z 052.

## 8. Ryzyka

- **Odwzorowanie „na logikę" zamiast „na stan faktyczny"** → np. uznanie, że członek zespołu
  powinien mieć tylko odczyt. Tabela prawdy pilnuje stanu faktycznego; zmiana reguły idzie osobno.
- **Deklaracja niewpięta w korzeń kompozycji** → objawia się **odmową dostępu**; pilnuje
  `check:module-registry` w obie strony.
