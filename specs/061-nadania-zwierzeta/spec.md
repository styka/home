# Spec: udostępnienia Zwierząt jako nadania — domknięcie zadania 12, etap 1

- **ID:** 061-nadania-zwierzeta · **Data:** 2026-08-13
- **Moduł(y):** Zwierzęta + `platform/sharing`

## 1. Problem / potrzeba

059 przeniosło na `ResourceGrant` dwie z trzech tabel udostępnień zadania 12. `PetShare` musiał
poczekać: nadanie dla typu `pets.pet` nic nie daje, dopóki `resolveRole` tego typu nie zna, więc
migracja bez deklaracji zasobu **odebrałaby** działające udostępnianie zamiast je przenieść.
Deklarację dołożyło 060 — blokada zniknęła.

## 2. Kryteria akceptacji

- [ ] **AC-1** — Given istniejące udostępnienia zwierząt, when wykona się migracja, then każde ma
      odpowiadające nadanie; powtórzenie nic nie zmienia.
- [ ] **AC-2** — Given nowe udostępnienie (osobie albo zespołowi), then nadanie powstaje razem
      z nim; zmiana roli **obniża** nadanie, a nie zostawia starego.
- [ ] **AC-3** — Given cofnięcie udostępnienia, then nadanie znika.
- [ ] **AC-4** — Given odczyty, then **nic** się nie zmienia — dostęp nadal rozstrzyga
      `extraGrants` czytające `PetShare`.
- [ ] **AC-5** — Given nowa ścieżka zapisu mutująca `PetShare` bez nadania, then **build pada**.
- [ ] **AC-6** — Given komplet bramek i build, then przechodzą; liczniki bez spadku.
- [ ] **AC-7** — Given dziennik, then odnotowane domknięcie etapu 1 zadania 12 dla wszystkich
      trzech tabel.

## 3. Zakres

**W zakresie:** migracja `PetShare` → `ResourceGrant`; lustro dla zwierząt; rozszerzenie bramki.

**Poza zakresem:** przełączenie odczytów (etap 2 — wspólny dla wszystkich trzech tabel, z tabelą
prawdy); usunięcie starych tabel (etap 3); `ServiceStaff` (rozdz. 8.10: **zostaje**, to rola
w firmie, nie dostęp do zasobu).

## 4. Zgodność z konstytucją

**C-10, C-11, C-14**, **C-16** (wzorzec lustra), **C-17** (odczyty nietknięte), **C-50**, **C-53**.

## 5. Ryzyka

- **Nadanie przeżywa źródło** → AC-3 plus asercja w teście lustra.
- **Zwierzę bez przestrzeni** → nadanie nie powstaje, zapis się udaje; ta sama reguła co w 059.
