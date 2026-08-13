# Spec: zakresy list idą po przestrzeniach — etap 3B krok 2 z dwóch

- **ID:** 058-zakres-po-przestrzeniach · **Data:** 2026-08-13
- **Moduł(y):** `platform/auth` (helper) + wszystkie moduły z własnością (miejsca wywołań)

## 1. Problem / potrzeba

057 przeniosło warunek „zasoby, które widzę" do **jednego helpera** (`ownedWhere`/`ownedOr`),
używanego w **75 miejscach**. Sam warunek został niezmieniony: nadal jest to para
`ownerId`/`ownerTeamId`.

Ten przebieg go **przełącza** — to jest właściwa treść etapu 3B i realizacja zdania z rozdz. 8.2:
*„Po zmianie: `where: { workspaceId: { in: mySpaces } }`."* Po nim **odczyty i rozstrzyganie
dostępu mówią jednym językiem**: 056 przełączyło rozstrzyganie, 058 dokłada listy.

## 2. Cel i miary sukcesu

- **Cel:** zakres list wynika z przestrzeni, nie z pary kolumn — przy **identycznym** zbiorze
  widocznych rekordów dla wszystkich dzisiejszych przypadków.
- **Sukces:** tabela prawdy bez ruchu poza komórkami nazwanymi w §4; zbiory rekordów porównane
  **przed i po** na tym samym fixture; liczba zapytań nie rośnie; build zielony.

## 3. Kryteria akceptacji

- [ ] **AC-1** — Given moje zasoby osobiste, when pobieram listę, then widzę **dokładnie te same**
      rekordy co przed zmianą.
- [ ] **AC-2** — Given zasoby zespołu, którego jestem członkiem, then widzę je tak jak dotąd.
- [ ] **AC-3** — Given **sierota** (rekord bez przestrzeni, np. sprzed backfillu), then jego
      właściciel **nadal go widzi** — zakres musi mieć gałąź awaryjną, dopóki kolumna jest
      nullowalna.
- [ ] **AC-4** — Given zbiory rekordów policzone starym i nowym zakresem na tym samym fixture,
      then są **identyczne**; dowód porównuje **zbiory**, nie liczbę zapytań ani typy.
- [ ] **AC-5** — Given liczba zapytań na żądanie, then **nie rośnie** — kontekst dostępu jest
      liczony raz na żądanie (istniejący cache z 052).
- [ ] **AC-6** — Given komplet bramek i build, then przechodzą; liczniki **160 / 551 / 35 / 35**
      bez spadku; zero zmian widocznych dla użytkownika.
- [ ] **AC-7** — Given dziennik, then etap 3B odnotowany jako domknięty, wraz z zakresem etapu 4.

## 4. Świadoma zmiana zachowania

Ta sama, którą nazwało 056 i tam już rozstrzygnięta: **właściciel zespołu bez wiersza `TeamMember`**
zaczyna widzieć zasoby zespołu także na **listach** pozostałych modułów (w Zadaniach zrobiło to już
056/recenzja). Poza tym **nic** się nie zmienia.

Nazwane tu wprost, bo inaczej byłoby to poszerzenie dostępu ukryte w zmianie mechanicznej (C-17).

## 5. Zakres

**W zakresie:** przełączenie helpera na `workspaceId`; dostosowanie miejsc wywołań do nowego
źródła zakresu; gałąź awaryjna dla rekordów bez przestrzeni; dowód równości zbiorów.

**Poza zakresem:** `NOT NULL`, los sierot, usunięcie `ownerId`/`ownerTeamId`, zdjęcie wyzwalacza
z 055 i cichych wariantów lustra z 051 (**etap 4**); migracja `PetShare`/`TaskShare`/
`TaskProjectMember` na nadania (zadanie 12); trzy świadome wyjątki z manifestu 057.

## 6. Wpływ na Omnia

**RBAC:** bez zmian. **Baza:** bez migracji. **AI:** read-toole korzystają z tych samych zapytań,
więc obejmuje je ta sama zmiana — i to jest właściwe.

## 7. Zgodność z konstytucją

**C-17** (zmiana reguły dostępu wymaga porównania przed/po; zakaz poszerzania „przy okazji" —
stąd §4), **C-21**, **C-36**, **C-50**, **C-51**, **C-53**.

## 8. Decyzje właściciela

Przebieg automatyczny. Przyjęte: **gałąź awaryjna zostaje do etapu 4**. Rekord bez przestrzeni musi
być widoczny dla właściciela, dopóki kolumna jest nullowalna — inaczej sieroty znikną
użytkownikom, a to zmiana widoczna, której spec nie zamawia.

## 9. Ryzyka

- **Cicha utrata widoczności** (rekord przestaje być widoczny) → dowód porównuje **zbiory
  identyfikatorów** przed i po, na tym samym fixture.
- **Rozjazd lustra przestrzeni** → użytkownik z `TeamMember`, ale bez `WorkspaceMember`, straciłby
  widoczność. Pilnuje tego `check:workspace-mirror` i `reconcileWorkspaces`; ryzyko znika
  w etapie 4. To ta sama, świadomie przyjęta cena, co w 056.
- **Wzrost liczby zapytań** → kontekst dostępu jest już liczony raz na żądanie.
