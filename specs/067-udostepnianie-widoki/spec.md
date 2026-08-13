# Spec: „Udostępnione mi" i „Co udostępniłem" — zadanie 14, część odczytowa

- **ID:** 067-udostepnianie-widoki · **Data:** 2026-08-13

## 1. Problem / potrzeba

Rozdz. 8.7 mówi o tym widoku rzecz, która jest **sednem całej Fazy 2**:

> *„Widok »Udostępnione mi« jest możliwy tylko dzięki jednolitemu modelowi — przy pięciu
> mechanizmach wymagałby pięciu zapytań i pięciu formatów."*

To jest **wypłata** za 051–066. Przed tą fazą pytanie „co mi udostępniono?" wymagałoby zapytania
do `TaskProjectMember`, `TaskShare`, `PetShare`, sprawdzenia `ownerTeamId` w kilkunastu tabelach
i sklejenia pięciu różnych słowników ról. Dziś to jedno zapytanie do jednej tabeli.

Dopóki tego widoku nie ma, cała praca Fazy 2 jest **niewidoczna dla użytkownika** — poprawna, ale
bez ani jednego ekranu, który by pokazywał, po co była.

## 2. Kryteria akceptacji

- [ ] **AC-1** — Given nadania dla mnie i dla przestrzeni, których jestem członkiem, then widzę je
      w **jednym** miejscu, ze wszystkich modułów, z rolą i obdarowanym.
- [ ] **AC-2** — Given nadania na **moich** zasobach, then widzę, komu je udostępniłem.
- [ ] **AC-3** — Given nadanie z **minioną** datą ważności, then **nie ma go na liście** — pokazanie
      go byłoby obietnicą, której `requireAccess` nie dotrzyma.
- [ ] **AC-4** — Given nazwa typu zasobu, then pochodzi z **deklaracji modułu**, nie z mapy w tym
      widoku; nowy typ zasobu nie wymaga edycji tego pliku.
- [ ] **AC-5** — Given widok, then jest zgodny z kontraktem widoku (`ModuleView` + `state`),
      skinowalny (C-30) i po polsku (C-32).
- [ ] **AC-6** — Given komplet bramek i build, then przechodzą; liczniki bez spadku.

## 3. Zakres

**W zakresie:** dwie listy odczytowe i trasa `/udostepnione`.

**Poza zakresem — z powodem:**
- **Odwoływanie dostępu jednym kliknięciem** (rozdz. 8.7). Dopóki dostęp rozstrzygają dawne tabele
  udostępnień (etap 2 zadania 12 przed nami), usunięcie samego nadania **nic by nie zmieniło** —
  przycisk obiecywałby skutek, którego nie ma. Wchodzi razem z etapem 2.
- **`ShareDialog`** (nadawanie dostępu), **zaproszenia e-mailem**, **linki `subjectType: "link"`**,
  powiadomienia i wpis do `AuditLog` — reszta zadania 14, osobno.

## 4. Zgodność z konstytucją

**C-30**, **C-32**, **C-33** (kontrakt widoku), **C-36** (etykiety z deklaracji modułu, nie z mapy
w warstwie widoku), **C-50**, **C-53**.
