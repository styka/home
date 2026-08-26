# Spec: Panel szybkiej nawigacji zamiast łukowego wachlarza

- **ID:** 104-panel-szybkiej-nawigacji
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-26
- **Moduł(y):** powłoka (nawigacja mobilna) — kontynuacja run 103

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Run 103 postawił dolny pasek z kotwicami i podpiął pod **każdą** jego pozycję gest przytrzymania
otwierający łukowy wachlarz. Właściciel zobaczył to na żywo i zgłosił trzy rzeczy naraz:

1. **Ikony modułów nie mają być bramą do nawigacji.** „Te pierwsze 3 ikony są ikonami konkretnych
   modułów i mają możliwość rozwijania wachlarzy a one nie mają mieć wachlarzy". Ikona Zakupów ma
   prowadzić do Zakupów — i nic więcej. Dziś ta sama ikona robi dwie różne rzeczy zależnie od tego,
   jak długo się jej dotyka, co znaczy, że **każde dotknięcie paska jest ryzykiem**: za długo
   przytrzymany palec zamiast przejść do modułu otwiera warstwę na pół ekranu.
2. **Szybka nawigacja nie ma własnego miejsca.** Skoro ikony modułów mają prowadzić wprost, to
   dojście do podstron i akcji („Nowy projekt", „Mapy sklepów") straciło wejście. Właściciel prosi
   o osobną ikonę, „która będzie służyła właśnie do szybkiego nawigowania i nie będzie bezpośrednio
   modułem", między gwiazdką a „wstecz".
3. **Sam wachlarz jest zły.** „Sposób wachlarza jest słaby, chaotyczny". Łuk podpowiedzi rozłożony
   wokół palca ma trzy wady naraz: pozycje zależą od miejsca dotknięcia (więc nie da się ich
   zapamiętać), etykiety są przycięte do ~84 px, a przy większej liczbie pozycji dochodzi drugi
   pierścień, po którym trzeba wodzić palcem. To jest interfejs, którego trzeba się **uczyć**,
   podczas gdy jego zadaniem jest skrócenie drogi.

## 2. Cel i miary sukcesu

- **Cel:** każda ikona dolnego paska robi **jedną, przewidywalną rzecz**, a cała szybka nawigacja
  (moduły → podstrony → akcje → ostatnio odwiedzone) mieszka w **jednym czytelnym panelu**, który
  się czyta, a nie w geście, którego trzeba się nauczyć.
- **Sukces mierzymy:**
  - tapnięcie w ikonę modułu **zawsze** prowadzi do modułu — niezależnie od tego, jak długo trwało;
  - dowolny zadeklarowany cel w dowolnym module jest osiągalny w **dwóch tapnięciach** (panel →
    cel), a znając nazwę — przez wyszukiwarkę tak samo szybko;
  - pozycje w panelu mają **stałe miejsca** (lista, nie łuk wokół palca), więc dają się zapamiętać;
  - nazwy celów są w pełni czytelne, bez przycinania do kilkunastu znaków;
  - pasek mieści **sześć** pozycji na ekranie 360 px, każda ≥ 44 × 44 px;
  - w aplikacji jest **jeden** mechanizm szybkiej nawigacji, nie dwa.

## 3. Historyjki użytkownika

- Jako użytkownik telefonu chcę, żeby tapnięcie w Zakupy **zawsze** otwierało Zakupy, żeby dotknięcie
  paska nie było loterią zależną od czasu przytrzymania.
- Jako użytkownik chcę mieć **osobną ikonę szybkiej nawigacji**, żeby wiedzieć, gdzie szukać drogi
  w głąb modułu, zamiast odkrywać ją przypadkiem.
- Jako użytkownik chcę **przeczytać** listę miejsc zamiast wodzić palcem po łuku, żeby wybór był
  świadomy, a nie wyćwiczony.
- Jako użytkownik znający nazwę miejsca chcę je **wyszukać**, zamiast rozwijać moduł po module.
- Jako użytkownik chcę **wrócić o krok jednym tapnięciem**, bo to najczęstsza czynność nawigacyjna.
- Jako użytkownik chcę znaleźć **ostatnio odwiedzone strony** w tym samym panelu co resztę nawigacji,
  żeby nie pamiętać dwóch różnych miejsc.

## 4. Kryteria akceptacji (testowalne)

**Ikony modułów i domu prowadzą wprost**

- [ ] **AC-1** — Given dolny pasek na telefonie, when tapnę ikonę modułu (Zadania / Zakupy), then
      trafiam do tego modułu.
- [ ] **AC-2** — Given ikona modułu, when **przytrzymam** ją dowolnie długo i puszczę bez ruchu,
      then nadal trafiam do tego modułu i **nie otwiera się żadna warstwa**.
- [ ] **AC-3** — Given ikona Strony głównej, when ją tapnę lub przytrzymam, then trafiam na stronę
      główną i nie otwiera się żadna warstwa.
- [ ] **AC-4** — Given pozycja modułu, when zaczynam na niej przewijanie treści palcem, then strona
      się przewija (pozycja paska nie przechwytuje wskaźnika).

**Skład paska**

- [ ] **AC-5** — Given telefon, when patrzę na pasek, then widzę **sześć** pozycji w kolejności:
      Strona główna, dwa moduły użytkownika, magiczna ikona na środku, ulubione, szybka nawigacja,
      „wstecz" — przy czym magiczna ikona stoi w geometrycznym środku i nie należy do żadnej ze stron.
- [ ] **AC-6** — Given ekran 360 px, when pasek jest wyrenderowany, then każda z sześciu pozycji ma
      co najmniej 44 × 44 px, nic się nie zawija i nic nie wychodzi poza ekran.
- [ ] **AC-7** — Given ustawienie ręki `left`, when patrzę na pasek, then układ jest lustrzany, a
      magiczna ikona nadal stoi w geometrycznym środku.
- [ ] **AC-8** — Given każda pozycja paska, when patrzę na nią, then ma widoczny **podpis** — krótki,
      przycięty do szerokości pozycji, bez zawijania do drugiego wiersza.

**Panel szybkiej nawigacji**

- [ ] **AC-9** — Given pasek, when tapnę ikonę szybkiej nawigacji, then otwiera się panel
      **zakotwiczony nad paskiem**, a nie warstwa wokół palca.
- [ ] **AC-10** — Given otwarty panel, when patrzę na jego zawartość, then widzę **listę dostępnych
      modułów** z pełnymi, nieprzyciętymi nazwami.
- [ ] **AC-11** — Given lista modułów w panelu, when tapnę moduł, then **pod nim** rozwijają się jego
      szybkie cele, bez opuszczania panelu i bez zamiany zawartości na inny ekran.
- [ ] **AC-12** — Given rozwinięty moduł, when tapnę jego cel, then panel się zamyka i trafiam pod
      adres tego celu (także gdy celem jest akcja niesiona adresem, np. „Nowy projekt").
- [ ] **AC-13** — Given otwarty panel, when wpiszę frazę w pole wyszukiwania, then lista filtruje się
      **po modułach i po ich celach naraz**, a wyniki pokazują, do którego modułu należą.
- [ ] **AC-14** — Given panel, when szukam ostatnio odwiedzonych stron, then znajduję je w tym samym
      panelu jako osobną sekcję („Ostatnie"), uporządkowaną od najświeższej.
- [ ] **AC-14a** — Given zapisane ulubione widoki, when otwieram panel, then znajduję je jako osobną
      sekcję („Ulubione") — bo skasowanie łukowego wachlarza zabrało gwiazdce jej dotychczasową
      listę, a lista musi mieć wejście. Gwiazdka zachowuje swoją czynność: tapnięcie zapisuje albo
      odpisuje bieżący widok.
- [ ] **AC-14b** — Given konto bez zapisanych widoków i bez historii, when otwieram panel, then obie
      sekcje są **pominięte** (nie puste nagłówki), a panel od razu pokazuje listę modułów.
- [ ] **AC-15** — Given otwarty panel, when tapnę poza nim albo wcisnę `Esc`, then panel się zamyka
      i nic nie nawiguje.
- [ ] **AC-16** — Given moduł, do którego nie mam uprawnienia, when otwieram panel, then nie ma go
      ani na liście modułów, ani w wynikach wyszukiwania, ani w sekcji „Ostatnie".
- [ ] **AC-17** — Given panel otwarty na telefonie, when patrzę na jego wysokość, then mieści się na
      ekranie nad paskiem, a jego zawartość przewija się wewnątrz panelu (panel nie rośnie w
      nieskończoność wraz z liczbą modułów).

**„Wstecz"**

- [ ] **AC-18** — Given odwiedzone wcześniej strony, when tapnę „wstecz", then wracam o **jeden krok**.
- [ ] **AC-19** — Given świeżo otwarta aplikacja (brak historii), when tapnę „wstecz", then dostaję
      czytelną informację, że nie ma dokąd wracać — nie pustą warstwę i nie błąd.
- [ ] **AC-20** — Given ikona „wstecz", when ją przytrzymam, then **nie otwiera się żaden wachlarz**
      (pełna lista odwiedzonych stron mieszka w panelu szybkiej nawigacji).

**Koniec łukowego wachlarza**

- [ ] **AC-21** — Given dowolne miejsce aplikacji (telefon i komputer), when przytrzymam pozycję
      nawigacji, then **nie pojawia się łukowa warstwa podpowiedzi** — mechanizm zniknął z aplikacji.
- [ ] **AC-22** — Given nawigacja boczna na komputerze, when klikam jej pozycje, then działają jak
      zwykłe odnośniki, bez regresji względem stanu sprzed tej zmiany.

**Ustawienia i dostępność**

- [ ] **AC-23** — Given ekran ustawień menu, when zmieniam skład dolnego paska, then nadal wybieram
      **dwa** miejsca modułowe, a kotwic (dom, asystent, ulubione, szybka nawigacja, wstecz) nie da
      się usunąć.
- [ ] **AC-24** — Given czytnik ekranu, when przechodzę po pasku i po panelu, then każda pozycja ma
      nazwę mówiącą **co robi**, panel jest ogłoszony jako warstwa, a rozwinięty moduł niesie stan
      rozwinięcia.
- [ ] **AC-25** — Given dowolna skórka, when patrzę na pasek i panel, then wszystkie kolory pochodzą
      ze zmiennych motywu, a tekst na kolorowym tle jest czytelny.

## 5. Zakres

**W zakresie:**
- Odebranie gestu przytrzymania ikonom modułów i Stronie głównej — prowadzą wprost.
- Nowa, szósta pozycja paska: **szybka nawigacja** (nie moduł).
- **Panel szybkiej nawigacji** zamiast łukowego wachlarza: lista modułów rozwijana w miejscu,
  wyszukiwarka obejmująca moduły i cele, sekcja „Ostatnie".
- „Wstecz": tapnięcie = krok wstecz; pełna historia przeniesiona do panelu.
- **Lista ulubionych widoków przeniesiona do panelu** (sekcja „Ulubione") — razem z historią, bo
  obie straciły swoje wejście wraz z wachlarzem.
- **Usunięcie łukowego wachlarza z całej aplikacji**, łącznie z nawigacją boczną na komputerze.
- Poprawka błędu o jeden w wyliczeniu sufitu pozycji paska (sześć mieści się, nie pięć).
- Ekran ustawień: opis kotwic zaktualizowany o nową pozycję.

**Poza zakresem (świadomie):**
- **Personalizacja zawartości panelu** — kolejność modułów bierze się z ustawień menu, celów z
  deklaracji modułów; edytor „własnych skrótów" to osobna sprawa.
- **Trwała historia między sesjami i urządzeniami** — bez zmian względem run 103 (sesja przeglądarki).
- **Zmiana zestawu szybkich celów w modułach** — 22 deklaracje z run 103 zostają jak są; ta zmiana
  daje im lepsze wejście, nie inną treść.
- **Gesty przesunięcia (swipe) na pasku** — właściciel prosił o czytelny panel, nie o inny gest.
- **Komputer** poza usunięciem wachlarza: pasek boczny, chrom konta i gwiazdka bez zmian.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** brak nowego sluga. Panel pokazuje moduły, cele i historię — wszystkie trzy
  muszą przechodzić przez **ten sam** filtr dostępu co reszta powłoki (C-22); panel jest nowym
  miejscem, w którym adres mógłby przetrwać utratę uprawnienia (AC-16).
- **Własność danych:** bez zmian — skład paska to preferencja użytkownika, historia jest sesyjna.
- **Asystent AI:** nie dotyczy; magiczna ikona zachowuje miejsce i zachowanie.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-35** — nowy panel dowozimy **z konsumentem** i jednocześnie **usuwamy** to, co zastępuje.
  Zostawienie łukowego wachlarza bez konsumenta byłoby dokładnie tym długiem, który reguła opisuje.
- **C-53 minimalizm** — panel budujemy na istniejącym wzorcu domu (zakotwiczona warstwa używana już
  przez filtry w Zadaniach i Wiadomościach), a nie na nowej bibliotece czy własnym rozwiązaniu.
- **C-31** — sześć pozycji przy 360 px z zachowanym minimum dotyku; panel respektuje bezpieczny
  margines dolny.
- **C-30 / C-32** — kolory ze zmiennych motywu, teksty po polsku przez `t()`.
- **C-22** — trzy powierzchnie panelu filtrowane tą samą regułą dostępu.
- **C-54** — błędne wyliczenie sufitu pozycji z run 103 poprawiamy **w artefakcie i w kodzie**, a nie
  obchodzimy; spec run 103 dostaje przypis, że jego AC-3 zostało zastąpione.

## 8. Otwarte pytania / decyzje właściciela

Zadane i **rozstrzygnięte** w jednym wywołaniu na starcie (C-55) — właściciel wybrał wszystkie cztery
warianty zalecane:

- [x] **„Wstecz"** → **tapnięcie = krok wstecz**, a pełna lista odwiedzonych stron mieszka w panelu
      szybkiej nawigacji jako sekcja „Ostatnie". Jedna ikona = jedna czynność; powrót o krok, jako
      najczęstsza czynność, dostaje najtańszy ruch.
- [x] **Panel** → **lista modułów rozwijana w miejscu + wyszukiwarka**. Znając nazwę docierasz
      w dwóch ruchach, nie znając — przeglądasz drzewo bez opuszczania panelu.
- [x] **Łukowy wachlarz** → **usunięty całkowicie, także z komputera**. Jedno rozwiązanie szybkiej
      nawigacji w całej aplikacji zamiast dwóch różnych.
- [x] **Podpisy pod ikonami** → **zostają**, krótkie i przycinane. Połowa paska to ikony nieoczywiste
      (ulubione, nawigacja, wstecz), więc podpis jest jedyną rzeczą, która mówi, co robią.

Założenia przyjęte samodzielnie (odnotowane, nie wymagają decyzji):
- **Sekcje „Ostatnie" i „Ulubione" znikają, gdy są puste.** Nagłówek nad pustką to informacja o
  niczym; panel ma wtedy od razu pokazać moduły.
- **Panel otwiera się tapnięciem, nie przytrzymaniem.** Skoro gest znika z ikon modułów, zostawienie
  go akurat tutaj oznaczałoby, że jedna ikona w pasku nadal wymaga nauki.
- **Sekcja „Ostatnie" jest w panelu pierwsza**, gdy historia nie jest pusta — to najczęstszy powód
  otwarcia panelu, a lista modułów i tak jest zaraz pod nią.
- **Liczba miejsc modułowych zostaje dwa.** Szósta pozycja jest kotwicą, nie kolejnym slotem na
  moduł: pasek ma dawać jedną drogę do wszystkiego, a nie mieścić więcej skrótów.

## 9. Ryzyka

- **Panel na małym ekranie urośnie ponad wysokość okna** (22 moduły + rozwinięte cele). → AC-17:
  stała, ograniczona wysokość i przewijanie **wewnątrz** panelu; sekcja „Ostatnie" przycięta.
- **Usunięcie wachlarza z komputera to zmiana poza zgłoszeniem właściciela.** → Właściciel
  rozstrzygnął to wprost; ryzyko regresji w nawigacji bocznej pokrywa AC-22.
- **„Wstecz" bez historii** wygląda na zepsute. → AC-19: czytelny komunikat, nie cisza.
- **Podpisy przy 49 px mogą się zawijać** i rozepchnąć wysokość paska. → AC-8: jeden krótki wyraz,
  przycięcie zamiast zawijania; mierzone, nie deklarowane.
- **Regresja gestu przewijania** — dziś pozycje paska ustawiają `touch-action: none`, co przy
  usuwaniu gestu przestaje być potrzebne i **musi** zniknąć, inaczej pasek dalej zjada przewijanie
  rozpoczęte na ikonie (AC-4).
