# Spec: Dolny pasek na telefonie — inteligentne ikony, gwiazdka, historia, drzewiasty wachlarz

- **ID:** 103-dolny-pasek-inteligentne-ikony
- **Status:** verified
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-26
- **Moduł(y):** powłoka (nawigacja mobilna) + deklaracje wszystkich modułów (szybkie cele)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Dolny pasek na telefonie jest dziś **wyłącznie listą modułów** (plus magiczna ikona na środku). Trzy
rzeczy, o które prosi właściciel, nie mają na nim miejsca:

1. **Gwiazdka ulubionych stoi na GÓRNYM pasku** — czyli poza zasięgiem kciuka, po przeciwnej stronie
   ekranu niż cała reszta nawigacji, i otwiera pełnoekranowy dialog zamiast zachowywać się jak inne
   ikony paska.
2. **Nie ma jak wrócić po własnych śladach.** Systemowy „wstecz" cofa o jeden krok i nie mówi, dokąd;
   po kilku skokach między modułami użytkownik nie wie, gdzie był.
3. **Gest przytrzymania kończy się na module.** Drugi poziom wachlarza pokazuje wyłącznie **zapisane
   widoki użytkownika**, więc u kogoś, kto niczego nie zapisał, drugiego poziomu po prostu nie ma —
   a dojście do „Nowy projekt w Zadaniach" czy „Mapy sklepów" nadal wymaga wejścia do modułu
   i szukania w nim przycisku.

Dodatkowo **nie ma wejścia do ustawień samego paska**: użytkownik widzi ikony, których nie umie
zmienić bez wiedzy, że taki ekran istnieje w `/settings`.

## 2. Cel i miary sukcesu

- **Cel:** dolny pasek przestaje być listą skrótów do modułów, a staje się **jedynym narzędziem
  nawigacji na telefonie**: cztery stałe, przewidywalne kotwice (dom, asystent, ulubione, historia),
  reszta miejsc konfigurowalna, i **jeden gest** (przytrzymaj → przeciągnij → puść) prowadzący
  drzewiasto aż do konkretnej podstrony albo akcji wewnątrz modułu.
- **Sukces mierzymy:**
  - dowolna zapisana pozycja modułu (podstrona lub akcja) jest osiągalna **jednym gestem bez
    puszczania palca** — maks. 3 poziomy, zero ekranów pośrednich;
  - zapisanie/odpisanie bieżącego widoku z ulubionych to **jedno tapnięcie** (dziś: tapnięcie +
    dialog + wybór);
  - powrót do dowolnej z ostatnich odwiedzonych stron to **jeden gest**, z widoczną nazwą celu;
  - pasek mieści się na ekranie **360 px** bez zawijania i bez celu dotyku mniejszego niż 44 × 44 px;
  - **drugi poziom wachlarza istnieje dla każdego modułu od pierwszego dnia** (u konta, które nie
    zapisało ani jednego ulubionego widoku).

## 3. Historyjki użytkownika

- Jako użytkownik telefonu chcę mieć **gwiazdkę w zasięgu kciuka**, żeby zapisać bieżący widok bez
  sięgania do górnej krawędzi ekranu drugą ręką.
- Jako użytkownik chcę **jednym tapnięciem** dodać/usunąć bieżący widok z ulubionych, żeby nie
  przechodzić przez okno dialogowe za każdym razem.
- Jako użytkownik chcę **przytrzymać gwiazdkę** i skoczyć do dowolnego zapisanego widoku, tak samo
  jak przytrzymuję ikonę modułu.
- Jako użytkownik skaczący między modułami chcę **wrócić do strony, na której byłem wcześniej**,
  wybierając ją po nazwie z listy uporządkowanej od najświeższej.
- Jako użytkownik chcę **jednym gestem dojść do podstrony albo akcji wewnątrz modułu** („Nowy
  projekt", „Mapy sklepów", „Plan tygodnia"), zamiast wchodzić do modułu i szukać w nim przycisku.
- Jako użytkownik chcę **dojść do ustawień samego paska** z paska, a nie tylko z ekranu ustawień,
  którego istnienia mogę nie znać.
- Jako osoba leworęczna chcę, żeby cały ten układ **nadal szedł za moją ręką** (poza magiczną ikoną,
  która z założenia stoi na środku).

## 4. Kryteria akceptacji (testowalne)

**Skład paska**

- [ ] **AC-1** — Given telefon (`< md`), when otwieram dowolną stronę aplikacji, then dolny pasek
      zawiera **cztery stałe kotwice**: Stronę główną, magiczną ikonę asystenta (środek), gwiazdkę
      ulubionych i historię odwiedzonych stron — w tej samej kolejności na każdej stronie.
- [ ] **AC-2** — Given pasek z kotwicami, when patrzę na pozostałe miejsca, then są w nich **moduły
      wybrane przez użytkownika** (te same preferencje co dziś), przycięte do liczby, która mieści
      się obok kotwic.
- [ ] **AC-3** — Given ekran szerokości **360 px**, when pasek jest wyrenderowany, then każdy jego
      cel dotyku ma co najmniej **44 × 44 px**, nic się nie zawija i nic nie wychodzi poza ekran.
- [ ] **AC-4** — Given ustawienie ręki `left`, when patrzę na pasek, then kolejność pozycji jest
      lustrzana, a **magiczna ikona nadal stoi na geometrycznym środku** (reguła z run 100).
- [ ] **AC-5** — Given konto bez dostępu do jakiegokolwiek modułu, when otwieram aplikację na
      telefonie, then pasek nadal się rysuje i kotwice (dom, asystent, ulubione, historia) działają.

**Gwiazdka jako inteligentna ikona**

- [ ] **AC-6** — Given widok, którego nie ma w ulubionych, when **krótko tapnę** gwiazdkę, then widok
      zostaje zapisany, gwiazdka natychmiast pokazuje stan „zapisany", a użytkownik dostaje ulotne
      potwierdzenie z nazwą — **bez otwierania okna dialogowego**.
- [ ] **AC-7** — Given widok już zapisany, when **krótko tapnę** gwiazdkę, then zapis zostaje
      usunięty, a gwiazdka wraca do stanu „niezapisany" (ta sama czynność jest odwracalna tym samym
      gestem).
- [ ] **AC-8** — Given co najmniej jeden zapisany widok, when **przytrzymam** gwiazdkę, then otwiera
      się wachlarz zapisanych widoków, a puszczenie palca na pozycji przenosi mnie pod jej adres.
- [ ] **AC-9** — Given adres, którego **nie wolno zapisać** (np. poza aplikacją) lub osiągnięty limit
      ulubionych, when tapnę gwiazdkę, then dostaję czytelny komunikat, a stan ulubionych się nie
      zmienia.
- [ ] **AC-10** — Given telefon, when szukam gwiazdki na **górnym** pasku, then jej tam nie ma —
      pasek dolny jest jej jedynym miejscem na telefonie (na komputerze zostaje bez zmian).

**Historia odwiedzonych stron**

- [ ] **AC-11** — Given kilka odwiedzonych stron w tej sesji, when **przytrzymam** ikonę historii,
      then widzę listę **nazw** odwiedzonych miejsc uporządkowaną chronologicznie: **najbliżej palca
      strona poprzednia, dalej coraz dawniejsze**.
- [ ] **AC-12** — Given otwarty wachlarz historii, when puszczę palec na pozycji, then trafiam
      dokładnie pod ten adres (ze stanem widoku zapisanym w adresie).
- [ ] **AC-13** — Given świeżo otwarta aplikacja (brak historii), when tapnę lub przytrzymam ikonę
      historii, then dostaję czytelną informację, że nie ma dokąd wracać — **nie pustą warstwę i nie
      błąd**.
- [ ] **AC-14** — Given historia, when **krótko tapnę** ikonę historii, then wracam o **jeden krok**
      (do strony poprzedniej).
- [ ] **AC-15** — Given ta sama strona odwiedzona kilka razy pod rząd, when otwieram wachlarz
      historii, then nie widzę powtórzeń tej samej pozycji obok siebie, a lista jest przycięta do
      rozsądnej długości (najświeższe pozycje).
- [ ] **AC-16** — Given wpis w historii prowadzący do miejsca, do którego **straciłem uprawnienie**,
      when otwieram wachlarz, then tego wpisu tam nie ma (ta sama reguła co dla ulubionych).

**Drzewiasty wachlarz: moduł → podstrony i akcje**

- [ ] **AC-17** — Given konto, które **nie zapisało żadnego ulubionego widoku**, when przytrzymam
      pozycję paska i zatrzymam się na module, then drugi poziom wachlarza **istnieje** i zawiera
      najważniejsze miejsca tego modułu.
- [ ] **AC-18** — Given moduł mający zadeklarowane szybkie cele **i** zapisane widoki użytkownika,
      when otwieram jego drugi poziom, then widzę jedne i drugie w jednej liście, bez duplikatów
      adresu.
- [ ] **AC-19** — Given drugi poziom modułu Zadania, when wybieram pozycję „Nowy projekt", then
      trafiam do Zadań **z otwartym formularzem nowego projektu** — czyli gest wywołuje akcję, a nie
      tylko przenosi do modułu.
- [ ] **AC-20** — Given adres wywołujący akcję, when otworzę go **bezpośrednio** (z zakładki, z
      ulubionych, wklejony), then zachowuje się tak samo jak wybrany z wachlarza (stan mieszka
      w adresie).
- [ ] **AC-21** — Given pierwszy poziom wachlarza, when przytrzymam **dowolną** pozycję paska, then
      dostaję **tę samą** listę dostępnych modułów (reguła z run 100 zostaje nienaruszona).
- [ ] **AC-22** — Given moduł, do którego nie mam uprawnienia, when otwieram wachlarz, then nie ma go
      ani na pierwszym poziomie, ani w żadnym drugim.

**Ustawienia paska**

- [ ] **AC-23** — Given otwarty wachlarz pierwszego poziomu, when patrzę na jego pozycje, then
      ostatnią z nich są **„Ustawienia paska"**, prowadzące na ekran, gdzie zmieniam skład paska,
      kolejność i rękę.
- [ ] **AC-24** — Given ekran ustawień menu, when zmienię skład dolnego paska, then zmiana jest
      widoczna na pasku po zapisaniu, a kotwic (dom, asystent, ulubione, historia) **nie da się
      usunąć** — bo są jedynym wejściem do rzeczy, które reprezentują.

**Estetyka i dostępność**

- [ ] **AC-25** — Given dowolna skórka, when patrzę na pasek i wachlarz, then wszystkie kolory
      pochodzą ze zmiennych motywu (żadnego hexa) i tekst na kolorowym tle jest czytelny.
- [ ] **AC-26** — Given włączone ograniczenie ruchu w systemie, when otwieram wachlarz, then
      podpowiedzi pojawiają się bez animacji, a gest działa identycznie.
- [ ] **AC-27** — Given czytnik ekranu, when przechodzę po pasku, then każda pozycja ma nazwę mówiącą
      **co robi**, a pozycja bieżącej strony jest oznaczona jako aktywna.

## 5. Zakres

**W zakresie:**
- Przebudowa składu dolnego paska na telefonie: cztery stałe kotwice + konfigurowalne moduły.
- Przeniesienie gwiazdki ulubionych z górnego paska telefonu na dolny i zamiana jej zachowania na
  „inteligentną ikonę" (tap = zapisz/usuń, przytrzymanie = wachlarz zapisanych).
- Nowa kotwica: **historia odwiedzonych stron** (tap = krok wstecz, przytrzymanie = wachlarz nazw).
- Drugi poziom wachlarza wzbogacony o **szybkie cele deklarowane przez moduł** (podstrony i akcje
  wyrażone adresem), scalone z zapisanymi widokami użytkownika.
- Wejście do **ustawień paska** jako stała pozycja wachlarza + rozszerzenie istniejącego ekranu
  ustawień menu o nowe reguły składu.
- Dopięcie akcji-adresów w modułach, w których szybki cel typu „dodaj" ma sens, tak aby AC-19/AC-20
  były prawdziwe (nie deklaratywne).

**Poza zakresem (świadomie):**
- **Komputer** — pasek boczny, rząd chromu konta i gwiazdka na komputerze zostają bez zmian.
- **Wykonywanie kodu modułu przez powłokę** — akcje idą wyłącznie przez adres (decyzja właściciela),
  więc powłoka nadal tylko nawiguje.
- **Trwała historia między sesjami i między urządzeniami** — historia dotyczy bieżącej sesji
  przeglądarki; „gdzie byłem w zeszłym tygodniu" to inna funkcja (i inna tabela).
- **Przebudowa łańcucha `MobileModuleSubNav`** (`if (id === …)` w menu wysuwanym) — to relikt sprzed
  046; szybkie cele nie są jego następcą i nie rozbudowujemy go (C-36, ustalenie z run 100).
- **Zmiana zachowania gestu na pierwszym poziomie** — lista modułów zostaje ta sama niezależnie od
  punktu startu.
- **Personalizacja szybkich celów przez użytkownika** — użytkownik personalizuje drugi poziom przez
  ulubione widoki; edytor „własnych szybkich akcji" to osobna, późniejsza sprawa.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** brak nowego sluga. Feature konsumuje istniejące uprawnienia modułowe —
  pierwszy poziom wachlarza, drugi poziom, historia i ulubione muszą być filtrowane **tą samą**
  regułą dostępu co reszta powłoki (C-22). Historia jest nowym miejscem, w którym adres może
  przetrwać utratę uprawnienia — musi przechodzić przez ten sam filtr (AC-16).
- **Własność danych:** preferencje paska to dalej **preferencja użytkownika** (ta sama, którą powłoka
  i tak czyta na każdej stronie); historia sesji **nie jest danymi trwałymi** i nie zakłada nowej
  własności. Ulubione widoki bez zmian.
- **Asystent AI:** nie dotyczy — magiczna ikona zachowuje dzisiejsze zachowanie i miejsce.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-36** — moduł rejestruje się **jedną deklaracją**. Szybkie cele muszą trafić do tej samej
  deklaracji co menu/uprawnienie/`sideNav`, a **nie** do nowej równoległej listy w powłoce; powłoka
  nie może sięgać do wnętrza modułu po jego nawigację.
- **C-31** — mobile-first: minimalne cele dotyku, `env(safe-area-inset-bottom)`, nigdy dwa sidebary.
  To jest główna bramka tej zmiany: dokładamy kotwice do paska o skończonej szerokości.
- **C-30** — wszystkie kolory ze zmiennych CSS; tekst na akcencie przez `--on-accent`.
- **C-32** — teksty po polsku przez `t()`, żadnych literałów w komponentach.
- **C-34** — potwierdzenia przez `confirmDialog`; usunięcie ulubionego jednym tapnięciem ma być
  **odwracalne tym samym tapnięciem**, więc nie wymaga potwierdzenia (AC-7) — ale nie wolno tu
  wprowadzić natywnego `window.confirm`.
- **C-35** — nowy wspólny mechanizm dowozimy **razem z konsumentem**: szybkie cele mają być
  zadeklarowane w realnych modułach, a akcje-adresy obsłużone po stronie modułu (AC-19/AC-20), a nie
  „udostępnione na przyszłość".
- **C-53** — minimalizm: budujemy na istniejących `PasekKciuka` / `WachlarzNawigacji` /
  `favoriteViews`, bez nowej biblioteki gestów i bez refaktoru przy okazji.
- **C-20** — jeżeli zmiana dotknie preferencji zapisywanych w bazie, idzie przez Server Action
  z `revalidatePath()`; **C-10/C-11/C-12** — gdyby doszła kolumna, wyłącznie ręczna migracja,
  `String` + union, kolejny wolny numer.
- **C-54/C-55** — pytania zadane raz, na starcie; dalsze etapy jadą autonomicznie i trzymają
  spójność `spec → plan → tasks → kod`.

## 8. Otwarte pytania / decyzje właściciela

Zadane i **rozstrzygnięte** w jednym wywołaniu na starcie (C-55):

- [x] **Skład paska** → właściciel podał wprost: **Strona domowa | magiczna ikona asystenta (środek)
      | ulubione (gwiazdka) | nawigacja po przebytych stronach**. Chronologia historii: „najbliżej do
      wyboru poprzednia strona, coraz dalej dawniejsze".
- [x] **Gwiazdka** → **tap = zapisz/usuń bieżący widok, przytrzymanie = wachlarz zapisanych**
      (opcja zalecana). Pełnoekranowy dialog znika z telefonu.
- [x] **Drugi poziom wachlarza** → nie tylko zapisane widoki: wachlarz ma być **drzewiastym dojściem
      do stron, podstron i akcji modułów** („np. dodawanie nowego projektu w zadaniach"); wachlarz
      gwiazdki pokazuje zapisane widoki użytkownika.
- [x] **Akcje w geście** → **wyrażone adresem** (opcja zalecana): powłoka nawiguje, moduł interpretuje
      stan z adresu.

Założenia przyjęte samodzielnie (do odnotowania, nie wymagają decyzji):
- **Miejsca dla modułów zostają.** Właściciel wymienił kotwice, nie żądał usunięcia ikon modułów —
  usunięcie ich byłoby regresją wobec dzisiejszego paska, więc pozostałe miejsca dostają moduły
  użytkownika (AC-2).
- **Ikona „ustawienia paska" nie zajmuje miejsca w pasku**, tylko jest stałą, ostatnią pozycją
  wachlarza (AC-23). Rzecz używana raz na miesiąc nie może zabierać slotu rzeczy używanej
  kilkadziesiąt razy dziennie — a zgłoszenie („powinna być ikona do ustawień tego dolnego paska")
  jest spełnione: wejście istnieje i jest w tym samym geście.
- **Ustawienia konta nie dostają własnej kotwicy** — są dostępne z menu wysuwanego i z wachlarza;
  właściciel sam był co do nich niepewny („sam nie wiem"), a pasek ma skończoną szerokość.
- **Historia jest sesyjna** (przeżywa odświeżenie strony, nie przeżywa zamknięcia przeglądarki).

## 9. Ryzyka

- **Za ciasny pasek na 360 px.** → Liczba miejsc dla modułów jest **wyliczana z tego, co zostaje po
  kotwicach**, a nie stała; AC-3 jest mierzone, nie deklarowane.
- **Gwiazdka jednym tapnięciem = przypadkowe usunięcie zapisu.** → Ta sama czynność jest natychmiast
  odwracalna tym samym gestem, a potwierdzenie jest ulotne i nazywa widok (AC-6/AC-7). To jest tańsze
  niż dialog przy czynności wykonywanej wielokrotnie dziennie.
- **Szybkie cele rozjadą się z rzeczywistością modułu** (adres przestanie istnieć). → Cele mieszkają
  w deklaracji modułu, obok jego ścieżek — czyli tam, gdzie zmiana trasy i tak jest widoczna; a nie
  w liście po stronie powłoki.
- **Akcja wyrażona adresem może zostać zapisana w ulubionych i „zawiesić" widok w stanie otwartego
  formularza.** → Moduł ma traktować taki stan jak każdy inny stan widoku z adresu: zamknięcie
  formularza czyści go z adresu.
- **Historia może stać się obejściem RBAC** (adres zapamiętany, uprawnienie odebrane). → AC-16:
  ten sam filtr dostępu co dla ulubionych, stosowany przy renderowaniu, nie przy zapisie.
- **Trzy nowe zachowania w jednym geście = ryzyko regresji run 100** (przechwytywanie wskaźnika,
  podwójna nawigacja, odmontowywanie przycisków). → Zmiany trzymamy w istniejących komponentach
  gestu i nie ruszamy reguł opisanych w ich nagłówkach; klikacze pokrywają gest.
