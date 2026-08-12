# Spec: `workspaceId` na modelach — etap 1 z czterech (kolumna + backfill)

- **ID:** 054-workspaceid-etap-1 · **Data:** 2026-08-12
- **Moduł(y):** wszystkie modele z własnością — to zdolność danych, nie funkcja modułu

## 1. Problem / potrzeba

Zadanie 11 z checklisty: własność zasobu ma przestać być parą `ownerId`/`ownerTeamId`, a stać się
jednym `workspaceId`. Rozdz. 8.2 nazywa tę kolumnę **jedynym elementem Progu C, który musi być
w modelu danych już teraz**, a rozdz. 8.10 — **najbardziej ryzykownym krokiem całej przebudowy**,
z wyraźnym wskazaniem: *(a) dodać nullable, (b) wypełnić migracją, (c) przełączyć zapytania,
(d) dopiero potem uczynić wymaganym. **Nigdy w jednym kroku.***

**Ten przebieg robi wyłącznie (a) i (b).** Odczyty zostają na `ownerId`/`ownerTeamId`.

## 2. Cel i miary sukcesu

- **Cel:** każdy rekord z własnością ma wypełnione `workspaceId`, a aplikacja tego nie zauważa.
- **Sukces:** zero rekordów z własnością i pustym `workspaceId`; zero przełączonych odczytów;
  backfill idempotentny; `check:schema-drift` zielony.

## 3. Historyjki użytkownika

- Jako **właściciel systemu** chcę, żeby najgroźniejszy krok przebudowy szedł etapami, z których
  każdy da się osobno sprawdzić i osobno wycofać.
- Jako **użytkownik** nie chcę zauważyć niczego.

## 4. Kryteria akceptacji

- [ ] **AC-1** — Given modele z własnością, when patrzę na schemat, then mają `workspaceId`
      **nullable** z indeksem; żadna istniejąca kolumna nie znika i nie zmienia znaczenia.
- [ ] **AC-2** — Given baza z danymi, when backfill się wykona, then **zero** rekordów
      z właścicielem i pustym `workspaceId`, w **każdej** objętej tabeli.
- [ ] **AC-3** — Given wykonany backfill, when uruchomię go ponownie, then nic się nie zmienia.
- [ ] **AC-4** — Given aplikacja, when z niej korzystam, then **nic** — zero odczytów przez
      `workspaceId` i zero zmian widocznych dla użytkownika.
      *(Skorygowane w trakcie przebiegu, C-54: pierwotne brzmienie żądało też „zera zmian sygnatur",
      co okazało się nieosiągalne. Kolumna dołożona do modelu Prismy wchodzi do wygenerowanego typu,
      więc komponent typowany na **cały** model przestaje się kompilować, gdy ktoś podaje mu literał.
      Kryterium mierzy więc zachowanie aplikacji, a nie nietykalność typów — poprawki czysto
      typowe są dozwolone i wymienione w `verify.md`.)*
- [ ] **AC-5** — Given `check:schema-drift`, when go uruchamiam, then zielony (schemat = migracje).
- [ ] **AC-6** — Given komplet bramek i build, then przechodzą; liczniki 160/551/35/35 bez spadku.
- [ ] **AC-7** — Given dziennik, then etap 1 odnotowany wraz z **jawną listą pozostałych trzech
      etapów** i tym, co każdy z nich obejmuje.

## 5. Zakres

**W zakresie:** kolumna `workspaceId` (nullable + indeks) na modelach mających `ownerId` lub
`ownerTeamId`; backfill z przestrzeni osobistych i zespołowych zbudowanych w 051; test kompletności.

**Poza zakresem:** przełączanie odczytów (etap 3), `NOT NULL` (etap 4), utrzymywanie kolumny
w przód dla nowych rekordów (etap 2 — świadomie osobno), migracja nadań (zadanie 12), UI.

## 6. Wpływ na Omnia

RBAC bez zmian. Własność: **dokładana obok, nie zastępowana** (C-21). AI/kalendarz/kosz: bez zmian.
Baza: **migracja jest sednem** — wyłącznie `ADD COLUMN` + `UPDATE` nowej kolumny.

## 7. Zgodność z konstytucją

**C-10, C-11, C-14** (ręczna migracja, numer z `next:migration`, idempotencja), **C-15** (wyjścia
`migrate diff` nie dopisujemy bez czytania — w 051 ten sam mechanizm skasował indeksy trigramowe),
**C-13** (tylko lokalny Postgres), **C-21**, **C-53**.

## 8. Decyzje właściciela

Właściciel zlecił kontynuację automatyczną. Przyjęte: **etapy 1 i 2 rozdzielone**. Wypełnienie
kolumny dla rekordów istniejących i utrzymywanie jej dla nowych to dwie różne zmiany ryzyka —
pierwsza jest jednorazowa i odwracalna, druga dotyka każdej ścieżki zapisu w aplikacji.

## 9. Ryzyka

- **Migracja dotyka kilkudziesięciu tabel** → wyłącznie dokładanie kolumny i wypełnianie **nowej**
  kolumny; żaden istniejący wiersz nie traci danych. Wycofanie = `DROP COLUMN`.
- **Rekord bez przestrzeni** (np. właściciel usunięty) → zostaje `NULL`; test **zlicza** takie
  przypadki zamiast je przemilczeć, bo etap 4 (`NOT NULL`) musi wiedzieć, ile ich jest.
- **`migrate diff` dopisze rzeczy, których nie zamawiam** → C-15: DDL czytany w całości,
  `grep -E "^(DROP|ALTER)"` przed commitem.
