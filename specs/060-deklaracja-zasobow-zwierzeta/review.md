# Recenzja: deklaracja zasobów Zwierząt — zadanie 13, moduł 2 z 19

Zakres: `git diff` względem produkcji (`3cb26295`): deklaracja, guard modułu, cienka nakładka
w akcji, wpięcie w korzeń kompozycji, tabela prawdy z punktem odniesienia, dziennik.

## Ustalenia

### 1. Odwzorowanie własności zespołowej — jedyne miejsce, gdzie łatwo o cichą regresję
*`src/modules/pets/sharing.ts:34`* · **correctness** · **rozstrzygnięte poprawnie, odnotowane**

`teamOwnership: { member: "manager" }` wygląda na zbyt hojne i pierwszym odruchem jest `editor`.
Byłby to błąd: dzisiejszy guard przy `ownerTeamId` wraca **bez sprawdzania `needEdit`**.

*Scenariusz przy `editor`:* nic się nie psuje **dziś** (dwie operacje, obie ≤ editor), więc zmiana
przechodzi. Ktoś dokłada za pół roku `pet.delete: "manager"` — i członkowie zespołu tracą prawo,
które mieli od zawsze, bez śladu w historii, że ktokolwiek tak zdecydował.

Tabela prawdy ma na to osobny wiersz. To jest dokładnie ten rodzaj rzeczy, dla którego 052 kazało
robić moduł na przebieg zamiast dziewiętnastu naraz.

### 2. Dwie zmienione komórki — spec poprawiony przed, nie po
*`specs/060-…/spec.md` §3a* · **process** · **naprawione**

Pomiar pokazał różnicę, której spec nie przewidział. Kolejność ma znaczenie: **najpierw nazwanie
zmiany w specu, potem przyjęcie nowego punktu odniesienia**. Odwrotna kolejność zamienia dowód
w usprawiedliwienie — punkt odniesienia zaakceptowany bez zapisanego powodu przestaje cokolwiek
znaczyć przy następnej zmianie.

Sama zmiana nie jest nowa: to komórka nazwana w 056, ujawniona w drugim module.

### 3. Guard zachowuje rozróżnienie, którego platforma nie robi
*`src/modules/pets/actions/pets.ts:19`* · **simplification (świadomie odrzucona)** · **bez zmian**

Kusiło, żeby oddać wszystko platformie i mieć jeden komunikat. Odrzucone: dawny guard rozróżniał
„zwierzę nie istnieje" od „brak dostępu", a `requireAccess` na oba odpowiada odmową (i słusznie —
nieistnienie zasobu nie powinno wyciekać obcemu). Rozróżnienie **niosło informację dla
właściciela** i zniknęłoby po cichu przy przenosinach, więc guard robi jedno dodatkowe zapytanie
o samo istnienie.

*Koszt:* jedno `findUnique` po kluczu głównym na sprawdzenie. *Zysk:* użytkownik nie dostaje
„brak dostępu" na zwierzę, które sam skasował.

### 4. `extraGrants` rozwija udostępnienie zespołowe na członków
*`src/modules/pets/sharing.ts:57`* · **correctness (przejściowe)** · **odnotowane**

Pole mówi językiem „userId → rola", więc udostępnienie dla zespołu trzeba rozwinąć — N zapytań przy
N udostępnieniach zespołowych. Akceptowalne, bo przejściowe: po migracji `PetShare` na nadania
robi to `subjectType: "workspace"` **jednym** dopasowaniem, a ta funkcja znika.

Gdyby to pole **pominąć**, przełączenie guardu odebrałoby działające udostępnianie zwierząt — czyli
najgorszy możliwy wynik „refaktoru bez zmiany zachowania".

## Rzeczy sprawdzone, w których nie ma ustalenia

- **C-36** — moduł woła platformę z **własnym** katalogiem (import względny), nie przez korzeń
  kompozycji; ten sam wzorzec i to samo uzasadnienie, co w Zadaniach.
- **Wpięcie w obie strony** — `check:module-registry` przechodzi; niewpięta deklaracja objawiłaby
  się **odmową dostępu**, czyli najbardziej mylącym objawem.
- **Operacje płytkie** — deklaracja ma dwie, dokładnie tyle, ile rozróżnia dzisiejsze API.
  Dołożenie `pet.delete: "manager"` byłoby zaostrzeniem reguły przy okazji przenosin.

## Werdykt

**APPROVE Z UWAGAMI.** Moduł 2 z 19 zamknięty. Wzorzec dla pozostałych siedemnastu jest teraz
opisany dwoma przykładami, a nie jednym — i drugi pokazał rzecz, której pierwszy nie mógł:
**odwzorowanie ról trzeba czytać z kodu guardu, nie z jego nazwy**.
