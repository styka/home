# Spec: okno konfliktu — zadanie 16

- **ID:** 066-conflict-dialog · **Data:** 2026-08-13

## 1. Problem / potrzeba

062 sprawił, że zapis oparty na nieaktualnym odczycie **nie przechodzi**. To rozwiązało
poprawność i **nie rozwiązało użytkownika**: dostaje surowy błąd i traci to, co napisał.

Rozdz. 8.5.2 stawia zasadę: *„konflikt nigdy nie kończy się utratą pracy użytkownika bez jego
świadomej decyzji"*, i wymienia wyjścia: zobacz różnice, nadpisz, odrzuć, scal ręcznie. Wersja
odrzucona **trafia do kosza jako robocza**.

## 2. Kryteria akceptacji

- [ ] **AC-1** — Given konflikt, then użytkownik dostaje **wybór**, nie komunikat; żadne wyjście
      nie jest domyślne i żadne nie wykonuje się samo.
- [ ] **AC-2** — Given „odrzuć moje zmiany", then odrzucona wersja trafia **do kosza** jako
      robocza, rozpoznawalna wśród usuniętych rekordów.
- [ ] **AC-3** — Given komponent użyty **bez** powłoki (test, playground, nowe miejsce), then
      **nie wybiera za użytkownika** — degraduje do „wróć do edycji".
- [ ] **AC-4** — Given okno, then jest skinowalne (zmienne CSS, C-30) i po polsku (C-32).
- [ ] **AC-5** — Given komplet bramek i build, then przechodzą; liczniki bez spadku.

## 3. Zakres

**W zakresie:** `ConflictProvider` w powłoce (wzorzec `ConfirmProvider`); trzy wyjścia; zapis
odrzuconej wersji do kosza.

**Poza zakresem — z powodem:** **widok różnic i scalanie ręczne**. Jedno i drugie wymaga
porównywania **pól konkretnego modułu**; okno platformy nie wie, czym jest „termin" ani „status",
a udawanie, że wie, skończyłoby się mapą pól na typ zasobu **wewnątrz platformy** — dokładnie tego
zakazuje C-36. Zamiast tego okno przyjmuje gotowy opis zmian (`podsumowanieZmian`) od modułu,
który zechce go podać. Pełne różnice wracają jako osobne zadanie, gdy pierwszy moduł będzie ich
naprawdę potrzebował (C-35: dowozimy z konsumentem).

## 4. Zgodność z konstytucją

**C-30** (zmienne CSS), **C-32** (polski), **C-34** (wzorzec okien aplikacji zamiast natywnych),
**C-35** (bez widoku różnic bez konsumenta), **C-36**, **C-50**, **C-53**.
