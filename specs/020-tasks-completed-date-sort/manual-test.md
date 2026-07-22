# Manualny scenariusz testowy — 020: data wykonania + sort „Zrobione"

Środowisko: **test** (`develop` → https://worldofmag.onrender.com) lub produkcja po wdrożeniu.
Moduł: **Zadania** (`/tasks`). Uwaga: sekcja „Zrobione" pokazuje się przy filtrze statusu **„Wszystkie"**.

---

## Przygotowanie
1. Wejdź w dowolny projekt zadań (`/tasks/<projekt>`) i upewnij się, że filtr statusu jest ustawiony na
   **„Wszystkie"**.
2. Miej w projekcie **co najmniej 3 zadania** i oznacz je jako zrobione (status **Zrobione/DONE**) w
   **różnych momentach** (np. odhacz jedno teraz, drugie za chwilę, trzecie później) — tak, by miały
   różne daty/godziny wykonania.

## Test 1 — widoczne daty i sortowanie sekcji „Zrobione" (AC-1, AC-3)
1. Rozwiń sekcję **„✓ Zrobione / Anulowane"** na dole listy.
   - **Oczekiwane:** przy każdym zrobionym zadaniu widać dyskretny znacznik **„✓ <data>"** (np. „✓ 22 lip").
2. Kliknij ikonę **„Sortuj zrobione po dacie wykonania"** (w pasku narzędzi listy).
   - **Oczekiwane:**
     - sekcja „Zrobione" **rozwija się automatycznie** (jeśli była zwinięta),
     - jej nagłówek zmienia się na **„✓ Zrobione / Anulowane — wg daty wykonania"**,
     - zadania są ułożone **od najnowszego do najstarszego** wykonania (najświeższa data na górze),
     - ikona przycisku jest **podświetlona** (aktywny sort).

## Test 2 — powrót do domyślnej kolejności (AC-2)
1. Kliknij ikonę sortowania **ponownie**.
   - **Oczekiwane:** kolejność wraca do domyślnej (sprzed sortu), nagłówek wraca do „✓ Zrobione /
     Anulowane", a podświetlenie przycisku znika.

## Test 3 — zadanie cykliczne pokazuje datę ostatniego wykonania (AC-4, AC-5)
1. Utwórz **nowe zadanie cykliczne** (np. „Podlać kwiaty", powtarzanie co 1 dzień) z terminem na dziś.
2. Oznacz je jako **zrobione** — powstaje kolejne (aktywne) wystąpienie na następny termin.
3. Spójrz na to **aktywne** (jeszcze niezrobione) kolejne wystąpienie.
   - **Oczekiwane:** przy aktywnym zadaniu cyklicznym widać znacznik **„✓ <data>"** = data, w której
     wykonano **poprzednie** wystąpienie (czyli „ostatnio zrobione"). Mimo że zadanie nie jest zrobione,
     ma datę poprzedniego wykonania.
4. Odśwież stronę.
   - **Oczekiwane:** data ostatniego wykonania **nie znika** (jest zapamiętana w bazie).

## Test 4 — brak regresji (AC-6)
1. Spójrz na zwykłe, **aktywne niecykliczne** zadania (nigdy niezrobione).
   - **Oczekiwane:** **brak** znacznika „✓ data" (nie zaśmieca widoku).
2. Sprawdź inne widoki (Dziś / Nadchodzące / Priorytety) i wygląd na telefonie.
   - **Oczekiwane:** układ bez zmian; znacznik „✓ data" pojawia się tylko tam, gdzie zadanie ma datę
     wykonania (zrobione lub aktywne cykliczne po wcześniejszym wykonaniu).

## Znane ograniczenie (świadome, poza zakresem)
- **Stare** zadania cykliczne utworzone **przed** tą zmianą nie mają zapamiętanej daty ostatniego
  wykonania — pojawi się ona dopiero od **następnego** wykonania. Nowe i kolejno przetaczane
  wystąpienia mają ją od razu.
