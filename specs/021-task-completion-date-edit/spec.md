# Spec: Edytowalna data wykonania zadań + wybór daty przy oznaczaniu jako zrobione (single + bulk)

- **ID:** 021-task-completion-date-edit
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-22
- **Moduł(y):** Tasks (`/tasks` — szczegóły zadania + bulk action)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba
Po feature 020 zadania pokazują datę wykonania, ale jest ona **niekontrolowalna**: ustawia się zawsze
na „teraz" przy oznaczeniu jako zrobione i **nie da się jej zmienić**. W praktyce zadania bywają
odhaczane **po jakimś czasie** od faktycznego wykonania, więc data „teraz" jest wtedy nieprawdziwa i
psuje przegląd „co kiedy zrobiłem" oraz sortowanie po dacie wykonania (020). Właściciel chce móc
**ustawić/poprawić datę wykonania** — pojedynczo i masowo.

## 2. Cel i miary sukcesu
- Cel: użytkownik może ustawić i poprawić datę wykonania zadania (nie tylko „teraz"), także masowo.
- Sukces mierzymy:
  - W szczegółach zrobionego zadania data wykonania jest **edytowalna** i zapis jest trwały.
  - Oznaczając zadanie jako zrobione, użytkownik może **wskazać inną datę** niż bieżąca.
  - Masowe „Zrobione" domyślnie ustawia dziś, ale pozwala **opcjonalnie** podać **jedną wspólną**
    datę wykonania dla wszystkich zaznaczonych.
  - Zmiana daty wykonania jest natychmiast widoczna w znaczniku „✓ <data>" (020) i wpływa na sort.

## 3. Historyjki użytkownika
- Jako użytkownik chcę poprawić datę wykonania zadania w jego szczegółach, żeby odzwierciedlała, kiedy
  naprawdę je zrobiłem (a nie kiedy je odhaczyłem).
- Jako użytkownik chcę, oznaczając zadanie jako zrobione, móc wskazać wcześniejszą datę, gdy odhaczam
  je z opóźnieniem.
- Jako użytkownik zamykający wiele zaległych zadań naraz chcę móc nadać im wszystkim jedną wspólną datę
  wykonania (np. „wczoraj"), bez otwierania każdego z osobna.

## 4. Kryteria akceptacji (testowalne)
- [ ] **AC-1 (edycja w szczegółach)** — Given zrobione zadanie otwarte w szczegółach, when użytkownik
  zmienia datę wykonania na inną, then zmiana zapisuje się trwale, a znacznik „✓ <data>" na liście
  odzwierciedla nową datę.
- [ ] **AC-2 (czyszczenie/spójność ze statusem)** — Given zadanie, when zmieniam status z „Zrobione" na
  aktywny, then data wykonania jest czyszczona jak dotąd; gdy wracam na „Zrobione" bez podania daty →
  ustawia się bieżąca (dotychczasowe zachowanie zachowane).
- [ ] **AC-3 (data przy oznaczaniu pojedynczego)** — Given aktywne zadanie, when użytkownik oznacza je
  jako zrobione **z podaniem daty** (w szczegółach), then zapisuje się wskazana data wykonania zamiast
  bieżącej.
- [ ] **AC-4 (bulk — domyślnie dziś)** — Given zaznaczone zadania, when użytkownik masowo ustawia status
  „Zrobione" **bez** podania daty, then wszystkie dostają datę bieżącą (dotychczasowe zachowanie).
- [ ] **AC-5 (bulk — wspólna data opcjonalnie)** — Given zaznaczone zadania, when użytkownik w panelu
  „Status → Zrobione" **poda** jedną wspólną datę wykonania, then wszystkie zaznaczone dostają tę datę
  jako datę wykonania.
- [ ] **AC-6 (spójność z 020 / cykliczne)** — Given zadanie cykliczne, when jest domykane z podaną datą
  wykonania, then ta data trafia jako data wykonania zamkniętego wystąpienia **oraz** jako „data
  ostatniego wykonania" (`lastCompletedAt`) kolejnego wystąpienia (mechanizm 020 nietknięty).
- [ ] **AC-7 (bez regresji)** — Given szybkie odhaczenie zadania w wierszu (ikona statusu), then nadal
  jest natychmiastowe i ustawia „teraz" (bez pytania o datę). Pozostałe daty (termin/start) i widoki
  bez zmian.

## 5. Zakres
**W zakresie:**
- **Edytowalne** pole daty wykonania w szczegółach zadania (dla zadań, które mają datę wykonania /
  są zrobione).
- Możliwość **ustawienia niebieżącej** daty wykonania przy oznaczaniu pojedynczego zadania jako
  zrobione (w szczegółach).
- **Bulk „Status → Zrobione"**: domyślnie data bieżąca; **opcjonalne** podanie **jednej wspólnej** daty
  wykonania dla wszystkich zaznaczonych (wariant A — decyzja właściciela).
- Spójność z 020: edycja/wybór daty współgra z `completedAt` oraz `lastCompletedAt` (cykliczne).

**Poza zakresem (świadomie):**
- Zmiana modelu cykliczności i logiki liczenia kolejnych terminów.
- Edycja przez bulk innych dat niż data wykonania.
- Przeprojektowanie **szybkiego odhaczania w wierszu** — zostaje „teraz" jako domyślne (AC-7).
- Migracja/schemat — **nie jest potrzebna** (kolumna `completedAt` już istnieje; `lastCompletedAt` z 020).

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — istniejący `module.tasks`; edycja pod istniejącym guardem dostępu
  do zadania (C-21).
- **Własność danych:** bez zmian; działa na istniejących zadaniach użytkownika/zespołu.
- **Zmiana schematu:** **nie** — używamy istniejących kolumn `completedAt`/`lastCompletedAt`.
- **Asystent AI:** nie dotyczy — brak nowej `AIAction`/read-toola.
- **Kalendarz / powiadomienia / trash:** nie dotyczy (data wykonania jest przeszła; nie generuje
  przypomnień).

## 7. Zgodność z konstytucją
- **C-20** — zmiany zapisu (edycja `completedAt`, bulk) w Server Actions z `revalidatePath`; guard
  dostępu C-21.
- **C-30/C-32** — pola daty i teksty: zmienne CSS, po polsku; spójne ze stylem istniejących pól
  dat w szczegółach.
- **C-53** — minimalizm: rozszerzamy istniejące akcje (`updateTask`/`bulkUpdateTasks`) i istniejące UI
  (szczegóły, panel statusu bulk), bez nowych modeli/zależności.
- **C-50/C-51** — build zielony; wpis do `doświadczenia.md` (spójność `completedAt` edytowalny vs
  logika statusowa, żeby edycja nie była nadpisywana przez derivację ze statusu).

## 8. Otwarte pytania / decyzje właściciela
**Zadane i rozstrzygnięte na `/specify` (C-55):**
- „Jak ma działać bulk »Status → Zrobione« wobec daty wykonania?" → **Wariant A**: domyślnie data
  bieżąca, ale panel statusu pozwala **opcjonalnie** podać **jedną wspólną** datę wykonania dla
  wszystkich zaznaczonych (domyślnie dziś).

**Założenia domyślne (C-53):**
- Granularność pola daty wykonania: **dzień** (spójnie ze znacznikiem „✓ <data>" z 020 i z polem
  „Start"); przy zapisie normalizujemy do sensownej godziny dnia. (Doprecyzowanie w `plan.md`.)
- Edycja daty wykonania jest dostępna, gdy zadanie ma datę wykonania (jest zrobione); dla aktywnego
  niecyklicznego zadania pole nie jest pokazywane (brak daty do edycji) — chyba że użytkownik właśnie
  oznacza je jako zrobione.

## 9. Ryzyka
- **Ryzyko:** edycja `completedAt` bywa nadpisywana przez derivację ze statusu (`status→DONE` ⇒ teraz).
  Mitygacja: jawnie podana data wykonania ma **pierwszeństwo** nad wyliczoną ze statusu; ujęte w AC-3
  i planie.
- **Ryzyko:** rozjazd z 020 dla cyklicznych. Mitygacja: przy domykaniu cyklicznych z datą używamy
  istniejącej ścieżki `completionDate` → `lastCompletedAt` (AC-6); nie duplikujemy logiki.
- **Ryzyko:** data w przyszłości / niepoprawna. Mitygacja: dopuszczamy datę przeszłą i dzisiejszą;
  walidacja formatu po stronie pola; ewentualne ograniczenia doprecyzuje `plan.md` (minimalnie).
