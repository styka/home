# Spec: Naprawa przepełnienia paska akcji w nagłówku Zadań na iPhone

- **ID:** 003-tasks-header-mobile-overflow
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-15
- **Moduł(y):** Tasks (`/tasks`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba
Na iPhone (wąski ekran) pasek akcji w nagłówku działu Zadania przepełnia się w poziomie: część
przycisków — w tym administracyjny „Kopiuj prompt dla Claude Code" oraz akcje leżące za nim —
wychodzi poza widoczny obszar ekranu i staje się nieklikalna. Użytkownik nie ma jak dosięgnąć tych
akcji na telefonie, co łamie zasadę mobile-first Omnii (C-31).

## 2. Cel i miary sukcesu
- Cel: wszystkie akcje w nagłówku Zadań są dostępne (widoczne i klikalne) na wąskim ekranie iPhone,
  we wszystkich układach (Lista / Kanban / Timeline) i widokach (pojedynczy projekt, „wiele
  projektów", widoki wirtualne).
- Sukces mierzymy: na szerokości viewportu ~375px żadna akcja nagłówka nie jest ucięta poza kadrem —
  do każdej da się dotrzeć (widoczna od razu lub po przewinięciu paska akcji w poziomie), a treść
  strony pod nagłówkiem nie przewija się poziomo (brak „rozjazdu" całego layoutu).

## 3. Historyjki użytkownika
- Jako administrator na iPhonie chcę dosięgnąć przycisku „Kopiuj prompt dla Claude Code", żeby móc
  uruchomić pipeline z zadaniami z bieżącej zakładki bez sięgania po komputer.
- Jako użytkownik na telefonie chcę móc skorzystać z każdej akcji nagłówka Zadań (szukaj,
  powiadomienia, przełącznik widoku, akcje projektu), żeby obsłużyć listę zadań w pełni z telefonu.

## 4. Kryteria akceptacji (testowalne)
Format Given/When/Then.
- [ ] **AC-1** — Given dział Zadania otwarty na wąskim ekranie (~375px), when nagłówek zawiera więcej
  akcji niż mieści się w jednym rzędzie, then wszystkie akcje pozostają dostępne (bezpośrednio
  widoczne albo osiągalne przez przewinięcie paska akcji w poziomie) i żadna nie jest trwale ucięta
  poza ekranem.
- [ ] **AC-2** — Given administrator na wąskim ekranie, when otwiera listę projektu z widocznym
  przyciskiem „Kopiuj prompt dla Claude Code", then przycisk ten jest osiągalny i klikalny.
- [ ] **AC-3** — Given wąski ekran, when nagłówek Zadań się renderuje, then jego wysokość i układ
  reszty strony nie zmieniają się w sposób psujący layout (nagłówek nie „rozlewa się" na kilka rzędów
  rozpychających treść), a strona główna nie przewija się w poziomie.
- [ ] **AC-4** — Given szeroki ekran (desktop, ≥ breakpoint `md`), when nagłówek się renderuje, then
  wygląd i zachowanie pozostają bez zmian względem obecnego stanu (regres zerowy na desktopie).
- [ ] **AC-5** — Given którykolwiek układ (Lista / Kanban / Timeline) i widok (projekt / „wiele
  projektów" / widoki wirtualne), when nagłówek renderuje właściwy dla niego zestaw akcji, then
  zasada z AC-1 obowiązuje w każdym z tych przypadków.

## 5. Zakres
**W zakresie:**
- Responsywność **rzędu akcji w nagłówku działu Zadania** na wąskich ekranach: umożliwienie
  przewijania paska akcji w poziomie tak, by żadna akcja nie wypadała poza kadr.
- Zachowanie obecnego wyglądu na desktopie (≥ `md`).

**Poza zakresem (świadomie):**
- Przeprojektowanie nagłówka, chowanie akcji w menu „…"/kebab, zmiana ikon lub kolejności akcji.
- Zmiany w innych działach niż Zadania (nawet jeśli mają podobny wzorzec nagłówka) — ten spec
  dotyczy zgłoszonego miejsca; ewentualne ujednolicenie to osobne zadanie.
- Zmiana logiki samego przycisku „Kopiuj prompt dla Claude Code" i jego widoczności (nadal
  admin-only).

## 6. Wpływ na Omnia
- **Uprawnienie / RBAC:** bez zmian — istniejący `module.tasks`; przycisk klipboardu pozostaje
  admin-only. Brak nowego slug-a (C-22 nie dotyczy).
- **Własność danych:** nie dotyczy — zmiana czysto prezentacyjna, brak nowych modeli/kolumn (C-10,
  C-21 nie dotyczą).
- **Asystent AI:** nie dotyczy — brak nowej `AIAction` / read-toola (C-23 nie dotyczy).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją
- **C-31 (mobile-first)** — kluczowa: to jej naruszenie naprawiamy; poprawka musi respektować wzorzec
  mobilny i `env(safe-area-inset-bottom)` tam, gdzie relevantne, oraz nie tworzyć drugiego sidebara.
- **C-30 (motyw przez zmienne CSS)** — ewentualne style trzymamy na zmiennych CSS, bez hardcodowanych
  hexów.
- **C-32 (teksty po polsku)** — brak nowych tekstów; jeśli jakieś dojdą, po polsku.
- **C-53 (minimalizm)** — najmniejsza możliwa zmiana, bez nowych zależności i „przy okazji"
  refaktorów; wybrany wariant (poziomy scroll) jest najmniej inwazyjny.
- **C-50 (definicja „gotowe")** — `npm run build` (do kroku `next build`) przechodzi.

## 8. Otwarte pytania / decyzje właściciela
- [x] Wariant naprawy przepełnienia — **rozstrzygnięty przez właściciela: poziomy scroll paska akcji**
  (overflow-x-auto, ukryty scrollbar). Nic nie chowamy w menu; wszystkie ikony zostają w rzędzie,
  osiągalne przez przewinięcie na wąskich ekranach. Odrzucone alternatywy: menu „…"/kebab (więcej
  kodu, nowy komponent) oraz zawijanie rzędu (zmienia wysokość nagłówka, rozpycha layout).

## 9. Ryzyka
- **Ryzyko:** poziomy scroll może początkowo chować część ikon poza kadrem, przez co użytkownik nie
  domyśli się, że trzeba przewinąć. → Ograniczamy: zostawiamy subtelną wskazówkę afordancji (np.
  brak twardego przycięcia/„fade" lub naturalne wystawanie kolejnej ikony), a najważniejsze akcje
  pozostają po lewej stronie rzędu; szczegóły rozstrzyga `plan.md`.
- **Ryzyko:** regres na desktopie. → Zmiana warunkowana breakpointem/utrzymaniem obecnego zachowania
  od `md` w górę (AC-4).
- **Ryzyko:** poziomy scroll paska akcji nie może powodować poziomego scrolla całej strony. →
  Izolujemy przewijanie do samego kontenera akcji (AC-3).
