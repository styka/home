# Spec: Ergonomia nawigacji — paski filtrów i pasek kciuka

- **ID:** 100-ergonomia-nawigacji-i-pasek-kciuka
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-25
- **Moduł(y):** Wiadomości, Zadania, powłoka (`AppShell` — dolny pasek, pływające przyciski, ulubione), Ustawienia

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

---

## 1. Problem / potrzeba

Trzy zgłoszenia właściciela dotyczą tego samego: **chromu nawigacyjnego — pasków, w których wybiera
się listy, filtry i moduły**. Każdy z nich zabiera dziś miejsce albo ukrywa stan wyboru:

1. **Wiadomości** — dwie listy („Monitorowane", „Odrzucone") schowały się pod ikoną ⋮, a gdy któraś
   jest otwarta, **nie widać po niczym, że jest wybrana**. Menu miało oszczędzić wiersz przy 360 px,
   ale kosztem tego, że użytkownik nie wie ani co jest dostępne, ani w jakim stanie jest widok.
2. **Zadania** — pasek filtrów-tagów rośnie **liniowo z liczbą etykiet**. Przy kilkunastu tagach
   (a tyle jest normą) to długi, przewijany w bok pas, w którym trzeba szukać etykiety wzrokiem.
3. **Dolny pasek na telefonie** — równe sloty rozłożone na całą szerokość ignorują to, jak trzyma się
   telefon: najważniejsze pozycje bywają po przeciwnej stronie niż kciuk. Osoba leworęczna nie ma
   żadnego sposobu, żeby to odwrócić — dotyczy to także gwiazdki ulubionych, pływającej magicznej
   ikony asystenta i ikony „robaczka" (wskazywanie elementu / zgłoszenie błędu). Do tego magiczna
   ikona nie ma stałego, rozpoznawalnego miejsca — jest kolejnym pływającym przyciskiem w rogu,
   który raz stoi wyżej, raz niżej, zależnie od tego, co jeszcze pływa obok.

Wspólny mianownik: **pasek nawigacji ma pokazywać, co jest dostępne i co jest wybrane, mieścić się
w stałej wysokości i być w zasięgu kciuka.** Dziś żaden z trzech nie spełnia wszystkich trzech
warunków naraz.

## 2. Cel i miary sukcesu

- **Cel:** paski wyboru w Omnii mają **stałą wysokość niezależną od liczby pozycji**, **widoczny stan
  wyboru**, a na telefonie — **układ dopasowany do dominującej ręki**, z magiczną ikoną w jednym,
  stałym, wyeksponowanym miejscu i szybkim gestem nawigacji bez celowania w małe ikony.
- **Sukces mierzymy:**
  - W Wiadomościach każda z trzech list („Proponowane", „Monitorowane", „Odrzucone") jest osiągalna
    **jednym dotknięciem, bez otwierania menu**, a wybrana jest rozpoznawalna bez czytania treści.
  - W Zadaniach wysokość paska filtrów **nie zmienia się** przy 3 i przy 18 tagach (pomiar w px).
  - Na telefonie użytkownik ustawia rękę **raz**, a wszystkie cztery elementy chromu (pasek, gwiazdka,
    magiczna ikona, robaczek) układają się po tej stronie; wybór modułu z paska da się wykonać
    **jednym gestem kciuka** (przytrzymaj → przeciągnij → puść), bez trafiania w 20-pikselową ikonę.
  - Ta sama czynność wyuczona na telefonie działa na komputerze (ten sam gest, ta sama ikona, to samo
    znaczenie) — użytkownik nie uczy się aplikacji dwa razy.

## 3. Historyjki użytkownika

- Jako czytelnik Wiadomości chcę **widzieć wszystkie trzy listy tematów i wiedzieć, którą oglądam**,
  żeby nie zgadywać, czy patrzę na propozycje, czy na odrzucone.
- Jako użytkownik Zadań z kilkunastoma tagami chcę **wybierać etykiety z krótkiej, wyszukiwalnej
  listy**, a nie przewijać długi pas chipsów, i chcę **widzieć, które są wybrane**.
- Jako osoba trzymająca telefon w jednej ręce chcę, żeby **najważniejsze rzeczy były pod kciukiem** —
  i żebym mógł to **odwrócić**, jeśli jestem leworęczny.
- Jako użytkownik chcę **jednego gestu nawigacji** (przytrzymaj pasek → wachlarz podpowiedzi →
  przeciągnij → puść), zamiast celowania w małą ikonę.
- Jako użytkownik chcę, żeby **magiczna ikona asystenta miała jedno, stałe, wyraźne miejsce** — żebym
  nigdy jej nie szukał.
- Jako użytkownik komputera chcę, żeby **to samo działało tak samo** — bez uczenia się drugiego
  układu.

## 4. Kryteria akceptacji (testowalne)

### A. Wiadomości — przełącznik segmentowy zamiast ⋮

- [ ] **AC-1** — Given jestem na zakładce gorących tematów w Wiadomościach i mam co najmniej jeden
      temat monitorowany oraz jeden odrzucony, when widok się rysuje, then w nagłówku sekcji widzę
      **trzy segmenty w jednym wierszu** — „Proponowane", „Monitorowane", „Odrzucone" — każdy
      z własnym licznikiem, **bez otwierania jakiegokolwiek menu**.
- [ ] **AC-2** — Given wybieram segment „Odrzucone", when patrzę na pasek, then ten segment jest
      **wizualnie wyróżniony** (inne tło/kolor niż pozostałe) **i** niesie stan wybrania dla czytnika
      ekranu, a treść pod paskiem pokazuje listę odrzuconych tematów.
- [ ] **AC-3** — Given przełącznik segmentowy istnieje, when szukam menu ⋮ w tej sekcji, then **go nie
      ma** — nie istnieją dwie drogi do tych samych list.
- [ ] **AC-4** — Given nie mam żadnego tematu odrzuconego (licznik 0), when patrzę na pasek, then
      segment „Odrzucone" **jest widoczny, ale nieaktywny** (wyszarzony, nieklikalny) — pasek nie
      zmienia kształtu, gdy licznik urośnie z 0 do 1, a użytkownik wie, że taka lista istnieje.
- [ ] **AC-5** — Given szerokość ekranu 360 px, when rysuje się nagłówek sekcji, then przełącznik
      **mieści się w jednym wierszu** (nie zawija się, nie zwiększa wysokości przyklejonego paska
      względem stanu sprzed zmiany o więcej niż wysokość jednego wiersza tekstu).

### B. Zadania — filtr tagów o stałej wysokości

- [ ] **AC-6** — Given lista zadań z 18 tagami, when otwieram widok, then filtr tagów to **jeden
      element o stałej wysokości** (przycisk z licznikiem), a **zmierzona wysokość paska filtrów jest
      taka sama** jak przy 3 tagach.
- [ ] **AC-7** — Given otwieram panel wyboru tagów, when wpisuję fragment nazwy, then lista zawęża się
      do pasujących; when klikam kilka pozycji, then **wybór jest wielokrotny**, a lista zadań filtruje
      się dokładnie tak samo jak przed zmianą (ta sama semantyka filtru — bez zmiany zachowania).
- [ ] **AC-8** — Given wybrałem 3 z 18 tagów i zamknąłem panel, when patrzę na pasek, then przycisk
      pokazuje **„3 z 18"**, a wybrane tagi widać obok jako **usuwalne chipy**; kliknięcie „×" na chipie
      zdejmuje **ten jeden** tag.
- [ ] **AC-9** — Given odznaczę ostatni wybrany tag, when patrzę na listę, then widzę **wszystkie
      zadania** (pusty wybór = wszystkie), a nie pusty ekran.
- [ ] **AC-10** — Given pasek filtrów zadań, when przeglądam jego style, then **nie ma w nim
      zahardkodowanego koloru** — tekst na aktywnym liczniku bierze zmienną motywu (C-30).

### C. Telefon — pasek kciuka, ręka, magiczna ikona i gest

- [ ] **AC-11** — Given jestem w ustawieniach wyglądu, when szukam ustawienia ręki, then mogę wybrać
      **prawa / lewa**, ustawienie jest **per użytkownik**, domyślnie **prawa**, i przeżywa
      przeładowanie strony oraz zalogowanie na innym urządzeniu.
- [ ] **AC-12** — Given ustawiłem rękę na **lewą**, when patrzę na ekran telefonu, then **gwiazdka
      ulubionych** i **pływająca ikona robaczka** są po **lewej** stronie; given ustawiłem **prawą** —
      po prawej. Zmiana działa **bez ponownego logowania**.
- [ ] **AC-13** — Given jestem na dowolnej trasie na telefonie, when patrzę na dolny pasek, then
      **magiczna ikona asystenta stoi dokładnie na jego środku**, jest **wyeksponowana** (większa niż
      pozostałe pozycje i wystaje ponad górną krawędź paska), i jest to **jej jedyne miejsce** — nie ma
      już drugiego, pływającego przycisku asystenta w rogu ekranu.
- [ ] **AC-14** — Given ustawiłem rękę, when patrzę na rozkład pozycji dolnego paska, then kolejność
      pozycji jest **lustrzana** względem ustawienia, pozycje **bliżej dominującego kciuka mają większe
      cele dotyku**, a **żaden cel dotyku nie jest mniejszy niż 44 px** (C-31).
- [ ] **AC-15** — Given przytrzymuję palec (lub wciśnięty przycisk myszy) na pozycji dolnego paska,
      when minie próg przytrzymania, then **nad paskiem rozwija się wachlarz podpowiedzi nawigacji**;
      when przeciągam palec na jedną z nich i puszczam, then **przechodzę pod ten adres**; when
      zatrzymam się na podpowiedzi, która ma dalszy poziom, then **pojawia się kolejny wachlarz** i mogę
      wejść głębiej **bez puszczania palca**.
- [ ] **AC-16** — Given wachlarz jest otwarty, when puszczę palec **poza** podpowiedzią albo wcisnę
      `Esc`, then wachlarz **znika bez nawigacji** i nic się nie zmienia.
- [ ] **AC-17** — Given **krótkie** tapnięcie w pozycję paska (bez przytrzymania), when puszczam, then
      **nawiguję wprost** pod jej adres — dotychczasowe zachowanie **nie ulega regresji**.
- [ ] **AC-18** — Given mam włączone systemowe ograniczenie animacji (`prefers-reduced-motion`), when
      otwieram wachlarz, then podpowiedzi pojawiają się **bez animacji**, a gest działa tak samo.
- [ ] **AC-19** — Given wyeksponowana magiczna ikona wystaje ponad pasek, when przewijam treść do
      samego dołu, then **nie zasłania ostatniego elementu listy** ani nie chowa się pod obszarem
      gestów systemowych (`env(safe-area-inset-bottom)` respektowane).

### D. Komputer — ta sama czynność, ten sam kształt

- [ ] **AC-20** — Given jestem na komputerze, when patrzę na magiczną ikonę asystenta, then ma
      **ten sam kształt, kolor i sposób wyeksponowania** co na telefonie oraz **jedno stałe miejsce**,
      ustawione po **stronie dominującej ręki** z AC-11.
- [ ] **AC-21** — Given jestem na komputerze, when przytrzymuję przycisk myszy na pozycji nawigacji,
      then dostaję **ten sam wachlarz podpowiedzi** co na telefonie (AC-15/AC-16) — ta sama czynność,
      ten sam wynik.
- [ ] **AC-22** — Given przechodzę z telefonu na komputer, when szukam wejścia do ulubionych i do
      asystenta, then oba są **w tej samej relacji do dominującej ręki** i mają te same ikony — nie ma
      dwóch układów do nauczenia.

### E. Zgodność ogólna

- [ ] **AC-23** — Given cała zmiana, when uruchomię `npm run build` do kroku `next build`, then
      **przechodzi**, w tym bramki `check:i18n`, `check:ui-contract`, `check:client-safe`,
      `check:tailwind` i `check:logs`.
- [ ] **AC-24** — Given nowe teksty widoczne dla użytkownika, when przeglądam kod komponentów, then
      **żaden nie jest literałem w JSX** — wszystkie idą przez `t()` z polskiego pliku komunikatów (C-32).

## 5. Zakres

**W zakresie:**

- Wiadomości: zamiana menu ⋮ sekcji propozycji na **przełącznik segmentowy trzech list** z licznikami
  i widocznym stanem wyboru.
- Zadania: zamiana pasa chipsów-tagów na **jeden przycisk filtra z licznikiem + panel wielokrotnego
  wyboru z wyszukiwarką**, plus **usuwalne chipy wybranych** przy przycisku.
- Nowe **ustawienie „dominująca ręka"** (prawa/lewa) per użytkownik, dostępne w ustawieniach wyglądu.
- **Dolny pasek na telefonie**: układ lustrzany wg ręki, zróżnicowane cele dotyku (większe bliżej
  kciuka), **magiczna ikona na stałe na środku i wyeksponowana**, likwidacja dotychczasowego
  pływającego przycisku asystenta na telefonie.
- **Gest przytrzymania → wachlarz podpowiedzi → przeciągnięcie → puszczenie**, z drugim poziomem
  podpowiedzi tam, gdzie pozycja ma pod-nawigację; działa dotykiem i myszą.
- Strona ręki dla **gwiazdki ulubionych** i **pływającej ikony robaczka**.
- Odpowiednik na komputerze: to samo umiejscowienie względem ręki, ten sam gest, ta sama ikona.
- Wpis do `doświadczenia.md` (C-51) i aktualizacja `CLAUDE.md` tam, gdzie opis chromu przestaje być
  prawdziwy.

**Poza zakresem (świadomie):**

- **Adaptacyjny slot** podstawiający „ostatnio używany moduł" pod kciuk — właściciel wybrał wariant
  przewidywalny; pasek zmieniający się pod palcem niszczy pamięć mięśniową.
- Zmiana **zawartości i kolejności** dolnego paska jako konfiguracji — to już istnieje (personalizacja
  menu) i nie jest przedmiotem zgłoszeń.
- Przeprojektowanie **bocznej nawigacji komputera** jako całości — dotykamy jej tylko na tyle, na ile
  wymaga tego wspólny gest i miejsce magicznej ikony.
- Zmiana **semantyki filtrowania** zadań po tagach (AND/OR) — filtr ma działać tak jak dziś, zmienia
  się wyłącznie sposób wybierania.
- Ustawienie ręki jako preferencji **przestrzeni** (zespołu) — ręka należy do osoby, nie do zasobu.
- Wersje lustrzane **ikon** (grafik) — lustrzana jest **pozycja**, nie rysunek ikony.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** brak nowego sluga. Wiadomości i Zadania korzystają z istniejących
  `module.news` / `module.tasks`; ustawienie ręki jest dostępne dla każdego zalogowanego (jak reszta
  personalizacji wyglądu). C-22 bez zmian.
- **Własność danych:** ustawienie ręki jest **per użytkownik** (nie per przestrzeń) — opisuje osobę
  i sposób trzymania urządzenia, a nie zasób. Dołącza do istniejącej rodziny preferencji personalizacji
  powłoki, żeby nie dokładać osobnego zapytania na każdej stronie.
- **Asystent AI:** nie dotyczy — żadnej nowej `AIAction` ani read-toola (C-23). Zmienia się wyłącznie
  **miejsce i wygląd** wejścia do asystenta, nie jego działanie.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — kluczowa dla zadań 1 i 2: oba mają w Omnii **istniejący wzorzec**
  (przycisk-filtr z licznikiem + warstwa kotwiczona, znany z filtra portali w Wiadomościach; menu
  kotwiczone znane z tematów). Nie wprowadzamy nowych bibliotek ani nowej mechaniki warstw.
- **C-35 (komponent razem z konsumentem)** — jeśli filtr tagów zasługuje na wspólny komponent, dowozimy
  go **wpięty** w Zadania, a nie jako pozycję w galerii bez konsumenta.
- **C-30 (motyw przez zmienne CSS)** — wszystkie nowe stany (wybrany segment, wyeksponowana ikona,
  wachlarz) muszą brać kolory ze zmiennych; na kolorowym tle tekst to `var(--on-accent)`. Dotyczy to
  także **usunięcia** istniejącego `#fff` w pasku filtrów zadań (AC-10).
- **C-31 (mobile-first, cele dotyku, `safe-area`)** — sedno zadania 3: minimalny cel 44 px, obszar
  gestów systemowych respektowany, **nigdy dwa sidebary na telefonie**.
- **C-33 (widok deklaruje się przez `ModuleView`)** — zmiany w Wiadomościach i Zadaniach nie mogą
  rozjechać przyklejonych pasków ani zasłony liczonej w CSS; jeśli rama nie pasuje — **poszerzamy ramę**,
  nie robimy wyjątku w module.
- **C-32 (teksty przez `t()`)** — wszystkie nowe napisy do pliku komunikatów, polski jako źródło.
- **C-20 (mutacje = Server Actions z `revalidatePath`)** — zapis ustawienia ręki idzie tą drogą.
- **C-10..C-12 (migracje)** — nowa preferencja wymaga **ręcznie napisanego pliku migracji** z kolejnym
  wolnym numerem; **żadnych enumów Prisma** (prawa/lewa to `String` + union w TypeScripcie).
- **C-13** — nigdy build ani migracja przeciw produkcyjnej bazie.
- **C-50/C-51/C-52/C-52a** — „gotowe" = zielony build; lekcja do `doświadczenia.md`; merge do
  `develop`, promocja `develop → master` fast-forwardem z tagiem.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w **jednym** momencie pytań (C-55). Odpowiedzi właściciela:

- [x] **Wiadomości** → **przełącznik segmentowy** („Proponowane | Monitorowane | Odrzucone"
      z licznikami). Menu ⋮ tej sekcji znika.
- [x] **Zadania** → **jeden przycisk „Tagi" z licznikiem + panel wielokrotnego wyboru z wyszukiwarką**,
      wzorem filtra portali z Wiadomości; wybrane tagi widoczne jako usuwalne chipy.
- [x] **Dolny pasek** → wariant zalecany (**ergonomia kciuka + przełącznik ręki**) **plus** rozszerzenia
      dopisane przez właściciela wprost:
      - **gest nawigacyjny**: przytrzymanie → wachlarz podpowiedzi → przeciągnięcie palca/kursora na
        podpowiedź → kolejny poziom podpowiedzi; „w efektowny sposób",
      - **magiczna ikona na środku dolnego paska**, wyeksponowana (wystająca poza obrys paska lub inny
        efekt) — **od teraz to jej stałe miejsce na telefonie**,
      - **na komputerze** magiczna ikona i funkcje dolnego paska mają zostać przemyślane tak, żeby
        użytkownik „i na mobile, i na komputerze nie czuł się pogubiony" — czyli **ta sama ikona, ten
        sam gest, to samo miejsce względem ręki**.

Założenia przyjęte samodzielnie (bez pytania, wg C-55 i wzorca sąsiedniego modułu):

- Domyślna ręka: **prawa** (tak stoi aplikacja dzisiaj — zmiana domyślnej byłaby cichą zmianą układu
  dla wszystkich).
- Segment z licznikiem **0** zostaje widoczny, ale **nieaktywny** — zamiast znikać. Znikanie zmieniałoby
  szerokość paska w trakcie pracy i ukrywało istnienie listy (to jest dokładnie ta wada, którą
  naprawiamy).
- Pusty wybór tagów znaczy **„wszystkie"**, nie „nic" — jak w filtrze portali.
- Ręka jest **jednym** ustawieniem dla wszystkich elementów chromu; osobne przełączniki dla paska,
  gwiazdki i robaczka byłyby trzema odpowiedziami na jedno pytanie „którą ręką trzymasz telefon".
- Gest przytrzymania **nie zastępuje** tapnięcia — tapnięcie nadal nawiguje wprost (AC-17).

## 9. Ryzyka

- **Gest przytrzymania koliduje z natywnymi gestami przeglądarki** (menu kontekstowe, zaznaczanie
  tekstu, „przeciągnij link"). → Traktujemy to jako wymaganie, nie detal: pozycje paska muszą mieć
  wyłączone zaznaczanie i natywne menu kontekstowe w obszarze gestu, a próg przytrzymania nie może być
  tak krótki, żeby zwykłe tapnięcie go wywoływało. `/verify` sprawdza AC-17 osobno właśnie po to.
- **Wyeksponowana ikona zasłania treść** — wystający element to trwały ubytek miejsca na dole każdej
  strony. → AC-19 wymaga sprawdzenia ostatniego elementu długiej listy, nie tylko wyglądu pustej strony.
- **Rozjazd przyklejonych pasków w Wiadomościach** — nagłówek sekcji zatrzymuje się pod paskiem
  nawigacji, a jego wysokość jest częścią wyliczanej zasłony. Przełącznik segmentowy zmienia zawartość
  tego nagłówka. → Zasłonę wyraża CSS, nie liczba przeliczana w efekcie (C-33, lekcja z 086/087);
  weryfikacja mierzy pozycję nagłówka przy 360 px.
- **„Efektowny" gest a wydajność i dostępność** — animowany wachlarz na słabszym telefonie potrafi
  zaciąć nawigację, a osobom z ograniczeniem ruchu przeszkadza. → AC-18 wymusza wariant bez animacji;
  animacja jest ozdobą gestu, nigdy jego warunkiem.
- **Zmiana miejsca asystenta zaskoczy użytkownika** — magiczna ikona wędruje z rogu na środek paska.
  → Świadomy koszt, wprost polecony przez właściciela; ryzyko ograniczamy tym, że ikona zostaje **ta
  sama** (kształt, kolor, symbol) i staje się **bardziej**, a nie mniej widoczna.
- **Regresja filtrowania po tagach** — zmieniamy sposób wybierania, nie semantykę. → AC-7 wymaga
  porównania zachowania filtru przed i po zmianie.
