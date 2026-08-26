# Spec: Moduł Zadania — UX tworzenia i przeglądania zadań

- **ID:** 105-zadania-ux-tworzenia-i-widoku
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-26
- **Moduł(y):** Tasks (Zadania)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Właściciel zgłosił pięć uwag do modułu Zadania i wszystkie mówią o tym samym: **moduł, w którym
najczęściej się COŚ DODAJE i COŚ CZYTA, utrudnia jedno i drugie.** Wejście w moduł z menu nie daje
żadnego sposobu na dodanie zadania (jest tylko „Nowy projekt"); pole dodawania w projekcie jest
jednolinijkowe, więc przy dłuższym tekście użytkownik nie widzi tego, co pisze; szczegóły zadania na
komputerze mieszczą się w wąskim pasku przy prawej krawędzi okna; okno potwierdzenia usunięcia
zadania jest w środku puste; a tryb wielozaznaczania wyłącza się po każdej akcji masowej, więc
kolejną trzeba zaczynać od nowa.

Żadna z tych rzeczy nie jest awarią — i dokładnie dlatego trwają. Razem składają się na to, że
najintensywniej używany moduł jest najbardziej męczący.

## 2. Cel i miary sukcesu

- **Cel:** dodanie zadania i przeczytanie zadania w module Zadania mają być czynnością krótką
  i wygodną — z każdego miejsca modułu, na telefonie i na komputerze.
- **Sukces mierzymy:**
  - z ekranu startowego modułu (`/tasks`) da się utworzyć zadanie **bez wchodzenia w projekt**
    i bez opuszczania strony;
  - pisząc opis zadania użytkownik **widzi cały wpisany tekst** (pole rośnie, nie przewija się w bok);
  - szczegóły zadania na komputerze można oglądać w obszarze **co najmniej dwukrotnie szerszym**
    niż dzisiejszy panel, a docelowo na całej przestrzeni modułu;
  - okno potwierdzenia usunięcia **mówi, co zostanie usunięte** — nie ma w nim pustego miejsca;
  - po akcji masowej można wykonać **następną akcję masową bez ponownego włączania trybu**
    zaznaczania.

## 3. Historyjki użytkownika

- Jako użytkownik wchodzący w moduł Zadania z menu chcę **od razu dodać zadanie**, wskazując
  projekt i priorytet, żeby myśl nie uciekła zanim znajdę właściwy projekt.
- Jako użytkownik opisujący zadanie chcę **widzieć cały tekst, który piszę**, i wiedzieć, że
  tytuł powstanie z opisu (oraz móc go poprawić), żeby nie pisać na ślepo w jednolinijkowym polu.
- Jako użytkownik czytający zadanie na komputerze chcę **rozwinąć je na dużą przestrzeń**, żeby
  opis, podzadania i komentarze nie tłoczyły się w wąskim pasku przy krawędzi ekranu.
- Jako użytkownik dopasowujący układ pracy chcę **ustawić szerokość panelu szczegółów** i żeby
  aplikacja ją zapamiętała.
- Jako użytkownik usuwający zadanie chcę, żeby pytanie o potwierdzenie **powiedziało mi, co
  usuwam i gdzie to trafi**, zamiast pokazywać puste okno.
- Jako użytkownik porządkujący listę chcę po akcji masowej **dalej zaznaczać kolejne zadania**,
  żeby zrobić serię operacji jednym ciągiem.

## 4. Kryteria akceptacji (testowalne)

**Szybkie dodawanie na stronie modułu (zgłoszenie 1)**
- [ ] **AC-1** — Given jestem na stronie startowej modułu Zadania, when patrzę na górę strony,
      then widzę widget dodawania zadania z polem treści, wyborem projektu, priorytetem i terminem —
      bez wchodzenia w jakikolwiek projekt.
- [ ] **AC-2** — Given wypełniłem treść zadania w widgecie i nie zmieniałem wyboru projektu,
      when zapisuję, then zadanie trafia do **ostatnio używanego projektu** (a gdy takiego nie ma —
      do domyślnej skrzynki), co widget pokazuje przed zapisem.
- [ ] **AC-3** — Given zapisałem zadanie z widgetu, when zapis się powiedzie, then trafiam do widoku
      projektu tego zadania z **otwartymi szczegółami nowo utworzonego zadania**, gotowymi do
      uzupełnienia.
- [ ] **AC-4** — Given nie mam ani jednego projektu, when używam widgetu, then zadanie i tak da się
      utworzyć (trafia do domyślnej skrzynki), a widget nie pokazuje pustej listy wyboru bez wyjścia.

**Formularz dodawania w projekcie (zgłoszenie 4a)**
- [ ] **AC-5** — Given jestem w widoku projektu, when wpisuję tekst dłuższy niż jeden wiersz,
      then pole rośnie i **widzę cały wpisany tekst** — nie przewija się on w poziomie.
- [ ] **AC-6** — Given zacząłem pisać w polu dodawania, when pole się rozwinie, then widzę formularz
      z **opisem w polu aktywnym (focus)**, osobnym polem tytułu oraz czytelną informacją, że tytuł
      zostanie wygenerowany z opisu; pole tytułu mogę wypełnić samodzielnie i wtedy nic nie jest
      generowane.
- [ ] **AC-7** — Given wpisałem krótkie, jednowierszowe zadanie, when naciskam Enter,
      then zadanie zostaje dodane od razu, bez konieczności rozwijania i zamykania formularza
      (szybkie przechwytywanie klawiaturą zostaje zachowane).
- [ ] **AC-8** — Given rozwinąłem formularz, when naciskam Esc lub anuluję, then formularz się
      zwija, a wpisany tekst nie znika bez ostrzeżenia (zwinięty stan nadal pokazuje, że coś jest
      wpisane) — albo jest jawnie porzucony na moje żądanie.

**Widok szczegółów zadania na komputerze (zgłoszenia 4b i 5)**
- [ ] **AC-9** — Given otwieram zadanie na komputerze, when panel szczegółów się pojawi,
      then jest **wyraźnie szerszy niż dzisiejszy** i pozostawia listę zadań widoczną obok.
- [ ] **AC-10** — Given panel szczegółów jest otwarty, when przeciągam jego krawędź,
      then zmieniam jego szerokość w rozsądnych granicach, a **ustawiona szerokość wraca
      po ponownym wejściu** do modułu (także po przeładowaniu strony).
- [ ] **AC-11** — Given panel szczegółów jest otwarty, when używam przełącznika „rozwiń",
      then zadanie zajmuje **całą przestrzeń roboczą modułu** (lista ustępuje miejsca), a treść
      rozkłada się na tej szerokości zamiast pozostawać wąską kolumną.
- [ ] **AC-12** — Given zadanie jest w trybie pełnym, when używam przełącznika ponownie, naciskam
      Esc lub zamykam zadanie, then wracam do widoku listy z panelem, a wybrany tryb **jest
      zapamiętany** na kolejne otwarcia.
- [ ] **AC-13** — Given jestem na telefonie, when otwieram zadanie, then nadal dostaję dotychczasowy
      widok pełnoekranowy — zmiana nie pogarsza układu mobilnego i **nie pokazuje dwóch paneli obok
      siebie**.
- [ ] **AC-14** — Given przeskakuję po liście klawiaturą, when zadanie jest otwarte,
      then skróty nawigacji po liście działają jak dotąd w trybie panelu.

**Puste okno potwierdzenia (zgłoszenie 2)**
- [ ] **AC-15** — Given usuwam zadanie z jego szczegółów, when pojawia się pytanie o potwierdzenie,
      then okno zawiera **treść mówiącą, które zadanie usuwam i że trafi do Kosza** — nie ma w nim
      pustego obszaru między nagłówkiem a przyciskami.
- [ ] **AC-16** — Given dowolne potwierdzenie w aplikacji nie ma treści opisowej, when się pojawi,
      then okno **nie rezerwuje miejsca na nieistniejącą treść** (brak pustej luki), niezależnie od
      modułu, który je wywołał.

**Tryb wielozaznaczania (zgłoszenie 3)**
- [ ] **AC-17** — Given zaznaczyłem kilka zadań i wykonałem akcję masową, when akcja się zakończy,
      then **tryb zaznaczania pozostaje włączony**, zaznaczenie jest wyczyszczone, a komunikat mówi,
      ilu zadań dotyczyła operacja.
- [ ] **AC-18** — Given tryb zaznaczania jest włączony i nic nie jest zaznaczone, when zaznaczam
      kolejne zadania, then mogę od razu wykonać następną akcję masową — bez ponownego włączania
      trybu.
- [ ] **AC-19** — Given tryb zaznaczania jest włączony, when naciskam Esc, używam jawnego wyjścia
      („Gotowe") albo opuszczam widok listy, then tryb się wyłącza — i **tylko wtedy**.
- [ ] **AC-20** — Given usunąłem zaznaczone zadania, when operacja się zakończy, then licznik
      zaznaczenia pokazuje zero i **nie liczy zadań, których już nie ma** na liście.

## 5. Zakres

**W zakresie:**
- Widget szybkiego dodania zadania na stronie startowej modułu Zadania (projekt, priorytet, termin,
  treść) z przejściem do utworzonego zadania.
- Przebudowa formularza dodawania w widoku projektu: pole wielolinijkowe rosnące z tekstem,
  rozwinięcie do formularza z opisem w focusie i osobnym, edytowalnym tytułem + informacją
  o generowaniu tytułu; zachowanie dodawania jednym Enterem.
- Widok szczegółów zadania na komputerze: szerszy panel, zmiana szerokości przeciąganiem
  z zapamiętaniem, przełącznik trybu pełnego (zadanie na całej przestrzeni modułu) z zapamiętaniem
  wyboru; układ treści dopasowany do szerokości.
- Treść okna potwierdzenia przy usuwaniu zadania oraz usunięcie pustej luki w oknie potwierdzenia
  bez treści (poprawka wspólna dla całej aplikacji).
- Trwałość trybu wielozaznaczania po akcjach masowych i jawne sposoby jego wyłączenia.
- Teksty po polsku przez warstwę tłumaczeń; wpis do dziennika doświadczeń dla naprawionych błędów.

**Poza zakresem (świadomie):**
- Cofanie („Undo") operacji masowych — właściciel wybrał wariant bez cofania; to osobna zmiana.
- Osobna trasa/adres dla pojedynczego zadania (link do zadania, ulubione zadanie) — odrzucone
  na rzecz trybu pełnego wewnątrz widoku listy.
- Zmiany w widoku Kanban i Osi czasu poza tym, co wymusza wspólny panel szczegółów.
- Nowe pola danych zadania, zmiany w powtarzalności, podzadaniach, komentarzach i tagach.
- Zmiany w asystencie AI ponad to, co już potrafi (tworzenie i edycja zadań).
- Przebudowa dodawania w innych modułach, choć wzorzec formularza jest z nich zapożyczony.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — istniejący slug `module.tasks`. Nie powstaje nowy moduł ani
  nowa trasa wymagająca bramkowania; strona startowa modułu i widok projektu są już bramkowane.
- **Własność danych:** bez zmian w modelu własności zadań (przestrzeń zasobu). Nowe są wyłącznie
  **preferencje widoku użytkownika** (szerokość panelu, tryb pełny, ostatnio używany projekt) —
  należą do konkretnej osoby, nie do przestrzeni, i mają dzielić los istniejących preferencji
  interfejsu modułu.
- **Asystent AI:** nie dotyczy — nie powstaje nowa akcja ani narzędzie odczytu. Tworzenie zadania
  przez asystenta korzysta z tej samej ścieżki zapisu co widget i nie zmienia zachowania.
- **Kalendarz / powiadomienia / trash:** bez zmian. Usuwanie zadania nadal trafia do Kosza — a
  poprawka okna potwierdzenia ma to użytkownikowi **powiedzieć wprost**, co dziś przemilcza.

## 7. Zgodność z konstytucją

- **C-33 (widok deklaruje się przez `ModuleView`)** — tryb pełny i szerszy panel muszą powstać
  w ramach kontraktu widoku; gdy rama nie pasuje, **poszerzamy ramę**, nie robimy wyjątku w module.
  To najważniejsza reguła tego feature'a i główne ryzyko techniczne.
- **C-34 (potwierdzenia przez `confirmDialog`, domyślnie neutralne)** — zgłoszenie 2 dotyczy
  dokładnie tego mechanizmu: okno ma mieć treść mówiącą, co się stanie, a usuwanie pozostaje
  zadeklarowane jawnie jako niszczące.
- **C-31 (mobile-first i keyboard-first)** — zmiana układu na komputerze nie może pogorszyć
  telefonu (nigdy dwa panele obok siebie), a rozwijany formularz nie może odebrać dodawania
  jednym Enterem ani skrótów nawigacji po liście.
- **C-30 (motyw przez zmienne CSS)** — nowy widget, formularz, uchwyt zmiany szerokości i tryb
  pełny korzystają wyłącznie ze zmiennych motywu; żadnych zaszytych kolorów.
- **C-32 (teksty przez warstwę tłumaczeń, polski jako źródło)** — wszystkie nowe napisy, w tym
  treść okna potwierdzenia i informacja o generowanym tytule.
- **C-20 (mutacje jako Server Actions z odświeżeniem ścieżki)** — tworzenie zadania z widgetu
  i zapis preferencji widoku idą istniejącą drogą zapisu.
- **C-53 (minimalizm)** — reguła rozstrzygająca przy każdym kuszącym „przy okazji": nie
  przepisujemy modułu, tylko usuwamy pięć konkretnych bólów; wspólne komponenty poprawiamy
  w miejscu, a nie mnożymy nowe warianty.
- **C-35 (nowy wspólny komponent dowozimy z pierwszym konsumentem)** — jeśli formularz dodawania
  albo uchwyt zmiany szerokości wyjdą poza moduł, muszą być od razu wpięte, a nie „gotowe do użycia".
- **C-51 (dziennik doświadczeń)** — zgłoszenia 2 i 3 to naprawione błędy; wpis idzie razem z fixem.
- **C-50 (definicja „gotowe" = zielony build)** oraz **C-52/C-52a (merge do `develop`, promocja
  `--ff-only` z tagiem)** — domknięcie przebiegu.

## 8. Otwarte pytania / decyzje właściciela

Wszystkie pytania zadano w jednym momencie na etapie `/specify`; właściciel wybrał **wariant
zalecany w każdym z czterech**:

- [x] **Widok szczegółów na komputerze → „Panel szeroki + tryb pełny".** Panel boczny zostaje,
      jest szerszy i zmienia szerokość przeciąganiem (zapamiętane per użytkownik), a przełącznik
      „rozwiń" przenosi zadanie na całą przestrzeń modułu. Odrzucono osobną trasę pełnoekranową
      (koszt: nowa trasa + wpis w kontrakcie widoku) i szerokie okno modalne (traci pracę
      „lista + szczegóły" równolegle).
- [x] **Formularz dodawania → „Pasek rozwija się w formularz".** Pole rośnie z tekstem i rozwija
      się w formularz z opisem w focusie oraz edytowalnym tytułem z adnotacją o generowaniu;
      Enter nadal dodaje jednolinijkowe zadanie od ręki. Odrzucono wariant „przycisk zamiast
      paska" (każde szybkie zadanie kosztowałoby klik więcej) i okno modalne.
- [x] **Tryb wielozaznaczania → „Tryb zostaje, zaznaczenie znika".** Wyłączenie wyłącznie jawne
      (Esc / „Gotowe" / opuszczenie listy). Odrzucono utrzymywanie zaznaczenia po akcji (licznik
      wprowadzałby w błąd, gdy część zadań wypadnie z widoku) i wariant z „Cofnij" (najdroższy —
      wymaga pamiętania stanu sprzed zmiany; zapisany jako „poza zakresem").
- [x] **Widget na stronie modułu → „U góry strony, z projektem i priorytetem".** Nad kaflami,
      z domyślnym ostatnio używanym projektem i przejściem do utworzonego zadania.

**Założenia przyjęte samodzielnie** (nie były przedmiotem pytań, rozstrzygnięte wzorcem sąsiednich
modułów i regułą C-53):
- Zadanie bez wskazanego projektu trafia tam, gdzie trafia dziś w widokach wirtualnych — do
  domyślnej skrzynki; widget nie wymyśla nowej reguły.
- Preferencje widoku (szerokość panelu, tryb pełny, ostatni projekt) należą do użytkownika i
  jadą tam, gdzie moduł trzyma swoje dotychczasowe preferencje interfejsu — bez nowego mechanizmu.
- Widok mobilny zadania pozostaje pełnoekranowy i nie dostaje przełącznika trybu (nie ma czego
  przełączać).
- Poprawka pustego okna potwierdzenia jest robiona **w dwóch miejscach naraz**: treść dla usuwania
  zadania oraz wspólne okno przestaje rezerwować miejsce na brakującą treść — inaczej ten sam pusty
  obszar zostałby w kilkudziesięciu innych wywołaniach w aplikacji.

## 9. Ryzyka

- **Tryb pełny kontra kontrakt widoku (C-33).** Zadanie na całej przestrzeni modułu może nie
  mieścić się w dzisiejszej ramie. Ograniczenie: poszerzamy ramę wariantem układu, nie robimy
  wyjątku w module — wyjątek w module to dług w dwudziestu miejscach.
- **Regresja na telefonie.** Zmiana panelu na komputerze łatwo psuje widok mobilny (dwa panele,
  panel pod paskiem kciuka). Ograniczenie: osobne kryterium akceptacji (AC-13) i sprawdzenie na
  wąskim ekranie.
- **Utrata szybkiego przechwytywania.** Rozwijany formularz kusi, by porzucić dodawanie jednym
  Enterem — a to najczęstszy sposób użycia. Ograniczenie: AC-7 jest kryterium blokującym.
- **Mylący licznik zaznaczenia.** Trwały tryb zaznaczania grozi tym, że w zaznaczeniu zostaną
  zadania usunięte albo odfiltrowane. Ograniczenie: AC-20 i czyszczenie zaznaczenia po akcji.
- **Zapamiętane preferencje jako nowy nośnik stanu.** Szerokość i tryb łatwo zdublować w kilku
  miejscach (adres, pamięć przeglądarki, baza). Ograniczenie: jeden nośnik na daną preferencję,
  wybrany w planie, bez drugiego „na wszelki wypadek".
- **Rozlanie się zakresu.** Moduł Zadania ma dużo miejsc kuszących do poprawek „przy okazji".
  Ograniczenie: C-53 i lista „poza zakresem" powyżej.
