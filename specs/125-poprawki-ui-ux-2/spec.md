# Spec: Druga paczka poprawek UI/UX ze zgłoszeń administratora (4 zgłoszenia)

- **ID:** 125-poprawki-ui-ux-2
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-04
- **Moduł(y):** Tasks / Rośliny / asystent (potwierdzenie zgłoszenia)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Administrator przetestował efekty paczki 118 i zgłosił cztery korekty: trzy iteracje na tamtych
zmianach (ustawienia przestrzeni Roślin dalej rozsuwają stronę zamiast otwierać dialog jak reszta
akcji; dialog dodawania zadania nie pokazuje wyboru projektu; scalony wiersz filtra tagów przy
kilku wybranych tagach zasłania/wypycha zakładki statusów) oraz jedno „nadal nie działa" — link
z potwierdzenia zgłoszenia (ścieżka „robaczka" obok magicznej ikony) wciąż prowadzi do samej listy
zadań, bo w 118 naprawiono inną ścieżkę (przez agenta), a robaczek tworzy zgłoszenie bez agenta.

## 2. Cel i miary sukcesu

- Cel: cztery zgłoszenia zamknięte tak, że wskazane zachowania odpowiadają dokładnie regułom
  podanym przez zgłaszającego, bez regresji w miejscach zmienionych w 118.
- Sukces mierzymy:
  - wszystkie akcje nagłówka przestrzeni Roślin (udostępnij, nowe miejsce, nowa roślina,
    ustawienia) działają jednym wzorcem — dialogiem nad treścią;
  - dialog dodawania zadania zawsze pokazuje pole projektu, poprawnie wstępnie ustawione;
  - przy dowolnej liczbie wybranych tagów wiersz zakładek statusów jest w pełni widoczny
    i przewijalny, a filtr tagów nie zajmuje w nim miejsca;
  - link z potwierdzenia zgłoszenia otwiera podgląd nowo utworzonego zadania na KAŻDEJ ścieżce
    zgłaszania (robaczek/inspektor elementów i sekcja zgłoszenia problemu — nie tylko agent).

## 3. Historyjki użytkownika

- Jako użytkownik Roślin chcę, żeby „Ustawienia przestrzeni" otwierały się w dialogu jak
  „Udostępnij", żeby układ strony nie skakał.
- Jako użytkownik Zadań chcę w dialogu dodawania widzieć pole projektu — wstępnie ustawione na
  projekt, którego listę właśnie oglądam — żeby zadanie trafiało tam, gdzie oczekuję, a w razie
  potrzeby móc wybrać inny projekt bez zamykania dialogu.
- Jako użytkownik Zadań w widoku bez kontekstu jednego projektu (Dziś/Nadchodzące/Zaległe/
  Wszystkie/zestawy) chcę sam wskazać projekt w tym samym polu, bo automat nie ma czego zgadywać.
- Jako użytkownik Zadań filtrujący po wielu tagach chcę, żeby filtr mieszkał w górnym pasku akcji
  (obok wyszukiwania) jako przycisk z liczbą wybranych tagów, żeby zakładki statusów nigdy nie
  były zasłonięte.
- Jako administrator zgłaszający usterkę robaczkiem chcę, żeby link w potwierdzeniu otwierał
  podgląd tego zgłoszenia, żeby od razu je zweryfikować.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1 (zgł. 1)** — Given widok przestrzeni w Roślinach, when użytkownik klika „Ustawienia
  przestrzeni" (koło zębate), then ustawienia (lokalizacja pogodowa + usunięcie przestrzeni)
  otwierają się w dialogu nad treścią — jak „Udostępnij" — a treść strony nie rozsuwa się;
  when zamknie dialog, then wraca dokładnie ten sam widok. Usunięcie przestrzeni z wnętrza
  dialogu działa jak dotąd (potwierdzenie, powrót na listę przestrzeni).
- [ ] **AC-2 (zgł. 2)** — Given dialog dodawania zadania otwarty z widoku zadań KONKRETNEGO
  projektu, when się renderuje, then pole wyboru projektu jest widoczne i wstępnie ustawione na
  ten projekt; given widok bez kontekstu jednego projektu (Dziś/Nadchodzące/Zaległe/Wszystkie,
  widok wielu projektów/zestawu), then pole jest widoczne bez wstępnego wyboru konkretnego
  projektu (użytkownik wybiera; brak wyboru = Skrzynka, jak na stronie modułu); when użytkownik
  zmieni projekt i doda zadanie, then zadanie ląduje w wybranym projekcie, a użytkownik ZOSTAJE
  w bieżącym widoku z otwartym panelem podglądu nowego zadania (decyzja właściciela).
- [ ] **AC-3 (zgł. 3)** — Given lista z wybranymi tagami (np. 5 z 17), when strona się renderuje,
  then filtr tagów NIE zajmuje miejsca w wierszu zakładek statusów — jest przyciskiem z liczbą
  wybranych tagów w górnym pasku akcji widoku, obok wyszukiwania (decyzja właściciela); when
  użytkownik go kliknie, then otwiera się dotychczasowy panel wyboru tagów (szukajka,
  multi-select, „Wszystkie"); zakładki statusów pozostają w pełni widoczne/przewijalne przy
  dowolnej liczbie wybranych tagów; semantyka filtru (koniunkcja) bez zmian; stan aktywnego
  filtru jest rozpoznawalny na przycisku (licznik/wyróżnienie).
- [ ] **AC-4 (zgł. 4)** — Given administrator tworzy zgłoszenie ze wskazania elementu (robaczek /
  inspektor) LUB przez sekcję zgłoszenia problemu asystenta (obie ścieżki bez agenta), when
  klika link/przycisk „Otwórz w zadaniach" w potwierdzeniu, then otwiera się lista zadań
  Z PODGLĄDEM nowo utworzonego zadania; przy braku prawa odczytu skrzynki link — jak dotąd —
  nie jest proponowany. Ścieżka przez agenta (naprawiona w 118) działa bez regresji.
- [ ] **AC-5 (regresja)** — Given zmiany w pasku akcji i dialogach, when przechodzimy widoki
  Zadań (lista/kanban/timeline/obszary, widoki wirtualne i zestawy) oraz przestrzeni Roślin,
  then nic się nie rozjeżdża, skróty `a`/`n` działają, a `npm run build` (do `next build`)
  przechodzi.

## 5. Zakres

**W zakresie:**
- Rośliny: sekcja ustawień przestrzeni w dialogu (zgł. 1).
- Zadania: pole projektu w dialogu dodawania — zawsze widoczne, wstępnie ustawione wg kontekstu
  (zgł. 2); filtr tagów jako przycisk z licznikiem w górnym pasku akcji, poza wierszem zakładek
  (zgł. 3).
- Asystent/zgłoszenia: linki potwierdzenia zgłoszenia z podglądem zadania na ścieżkach bez
  agenta (zgł. 4).

**Poza zakresem (świadomie):**
- Zmiany zestawu pól w ustawieniach przestrzeni Roślin (przenosimy istniejącą zawartość).
- Zmiany semantyki filtrowania tagów i zakładek statusów.
- Chipy wybranych tagów w jakimkolwiek pasku (wybór ogląda się i zdejmuje w panelu filtra).
- Strona modułu /tasks (jej dialog już ma wybór projektu — wzorzec do reużycia).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian (`module.tasks`, `module.rosliny`; ścieżka zgłoszeń używa
  istniejącego wyjątku skrzynki).
- **Własność danych:** bez zmian; żadnych nowych zasobów.
- **Asystent AI:** bez nowych akcji — zmiana dotyczy wyłącznie treści linków w istniejących
  potwierdzeniach (C-23 nie wymaga egzekutora).
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-01** — praca w `worldofmag/`; **C-53** — edycje punktowe, zero nowych zależności.
- **C-30/C-31** — zmienne CSS; dialogi jako arkusze dolne na telefonie z safe-area; cele dotyku.
- **C-32** — nowe teksty przez `t()` w `pl.json`.
- **C-33** — akcje i filtr w strefach ramy `ModuleView` (pasek akcji), bez wyjątków w module;
  ustawienia modułu pozostają w slocie `settings` — zmienia się sposób PREZENTACJI (dialog),
  nie miejsce wejścia.
- **C-34** — potwierdzenie usunięcia przestrzeni przez `confirmDialog` jak dotąd.
- **C-50/C-52/C-52a** — build jako „gotowe", merge do `develop`, promocja `--ff-only`.
- **C-54** — artefakty 118 pozostają prawdziwe historycznie; nowe decyzje żyją w tym specu.

## 8. Otwarte pytania / decyzje właściciela

Decyzje zebrane w jedynym momencie pytań (2026-09-04):

- **Filtr tagów (zgł. 3), własna instrukcja właściciela:** zabrać filtr z wiersza zakładek;
  dodać go do górnego paska akcji obok lupy wyszukiwania jako przycisk z liczbą wybranych
  tagów; klik otwiera dotychczasowy dropdown wyboru tagów. Bez chipów.
- **Po dodaniu zadania do innego projektu:** zostań w bieżącym widoku + otwórz panel podglądu
  (zalecane, wybrane).

Założenia przyjęte samodzielnie (domyślne, minimalne):
- Zgł. 1: dialog ustawień przenosi obecną zawartość sekcji bez zmian merytorycznych.
- Zgł. 2: „brak kontekstu jednego projektu" = widoki wirtualne, widok wielu projektów i zestawy;
  w nich pole startuje bez wybranego projektu (puste = Skrzynka — spójnie ze stroną modułu).
- Zgł. 4: naprawa u źródła na wszystkich ścieżkach generujących link potwierdzenia (robaczek
  i sekcja zgłoszenia problemu), z zachowaniem warunku prawa odczytu.

## 9. Ryzyka

- **Wiersz zakładek bez filtra a Kanban** (zakładki ukryte, dotąd filtr stał tam sam) → filtr
  w pasku akcji jest niezależny od zakładek, więc Kanban po prostu nie renderuje pustego wiersza.
- **Pasek akcji Zadań jest gęsty (przewijany na wąskich ekranach)** → przycisk filtra jako
  kompaktowa ikona z licznikiem, spójna z sąsiednimi ikonami; stan aktywny wyróżniony kolorem.
- **Dialog ustawień Roślin zawiera akcję niszczącą** → usunięcie zostaje za `confirmDialog`
  z jawnym `destructive`, dialog zamyka się przed nawigacją na listę.
- **Trzy miejsca generujące link zgłoszenia** → poprawka we wszystkich + szybki grep kontrolny,
  żeby nie ostało się czwarte.
