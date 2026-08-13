# Spec: odwołanie dostępu działa natychmiast — zadanie 17

- **ID:** 063-test-odwolania-dostepu · **Data:** 2026-08-13

## 1. Problem / potrzeba

Rozdz. 12.2 wymienia trzy testy bezpieczeństwa i o tym pisze wprost: **„trzeci test jest nowy
i nieoczywisty"**. Powód: cache rozstrzygnięć dostępu (11.5) wprowadza ryzyko, że odebranie
uprawnień zadziała dopiero po wygaśnięciu wpisu — *„dziura bezpieczeństwa wprowadzona przez
optymalizację"*.

**Dlaczego teraz, skoro dziś to działa z definicji.** Cache jest per żądanie (052), więc odwołanie
jest natychmiastowe **bez żadnego wysiłku**. I właśnie dlatego test trzeba napisać **przed**
optymalizacją, a nie po: test pisany po fakcie opisuje istniejące zachowanie, a ten ma zostać
**warunkiem**, który każda przyszła zmiana cache musi spełnić. Zadanie 29 (cache agregatów
i rozstrzygnięć dostępu) wejdzie w Fazie 5 — wtedy będzie za późno na ustalanie wymagania.

## 2. Kryteria akceptacji

- [ ] **AC-1** — Given odebrane członkostwo, when sprawdzę dostęp **bezpośrednio potem**, then
      odmowa — bez czekania, bez czyszczenia cache, bez drugiego żądania.
- [ ] **AC-2** — Given nadanie z **minioną** datą ważności, then nie daje nic.
- [ ] **AC-3** — Given to samo nadanie z datą **przyszłą**, then działa. (Kontrola mocy AC-2:
      bez tego odmowa mogłaby brać się z czegokolwiek innego niż data.)
- [ ] **AC-4** — Given komplet bramek i build, then przechodzą; liczniki bez spadku.

## 3. Zakres

**Poza zakresem:** część „także przy aktywnym SSE" z rozdz. 12.2. Strumienia zdarzeń nie ma
w aplikacji (Faza 4, zadania 21–23) — test na nieistniejący mechanizm sprawdzałby własną atrapę.
Dopisanie należy do zadania 23.

## 4. Zgodność z konstytucją

**C-17** (dostęp rozstrzyga platforma), **C-50**, **C-53**.
