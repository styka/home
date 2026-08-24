# Spec: Chrom widoku przy koncie, przyklejone akcje strony i porządki w Wiadomościach i Pogodzie

- **ID:** 085-chrom-widoku-i-porzadki-modulow
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-24
- **Moduł(y):** Powłoka (pasek widoku, chrom konta), Wiadomości, Pogoda

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Dziewięć zgłoszeń z testów właściciela układa się w trzy bóle, nie w dziewięć drobiazgów.

**Chrom widoku stoi w złym miejscu i częściowo nic nie znaczy.** Gwiazdka „zapisz widok" i wskaźnik
„ostatnie odświeżenie" siedzą w pasku widoku, gdzie odbierają miejsce zakładkom modułu — a wskaźnik
w dodatku mierzy co innego, niż sugeruje: moment, w którym powłoka automatycznie przeładowała stronę,
a nie świeżość danych modułu. Do tego **główne akcje strony odjeżdżają przy przewijaniu**, więc przy
długiej liście „Nowy temat" i „Odśwież" są poza zasięgiem.

**Tryb administratora jest połowiczny.** Przełącznik ukrywa koszty AI, ale nie pozostałe dodatki
widoczne wyłącznie dla administratora — więc admin nie ma jak zobaczyć aplikacji tak, jak widzi ją
użytkownik. Powiadomienia o koszcie pojawiają się przy tym pod wcięciem aparatu iPhone'a i wyglądają
jak dymek podpowiedzi, a nie jak ulotne powiadomienie.

**Dwa moduły mają układ, który każe szukać.** W Wiadomościach tematy bez nowych materiałów zajmują
miejsce pustymi ramkami, a ustawienie długości streszczeń mieszka w zakładce „Źródła". W Pogodzie
informacja o (nie)aktualności oceny obserwatorów i wejście do jej ponowienia stoją na samym DOLE, pod
całą ścianą obserwatorów, drobnym drukiem; nad listą stoi za to rząd chipsów filtra, którego nikt nie
chciał, a link do zapisanych pomysłów jest tak niepozorny, że nie widać, iż jest wybór.

## 2. Cel i miary sukcesu

- **Cel:** chrom konta stoi w jednym miejscu i nie kradnie miejsca treści; akcje strony są w zasięgu
  przez cały czas; administrator jednym przełącznikiem ogląda aplikację oczami użytkownika; obie
  wskazane sekcje pokazują najpierw to, co ważne.
- **Sukces mierzymy:**
  - **jedno** wejście do zapisu widoku w całej aplikacji (dziś dwa miejsca zależnie od kontekstu),
  - po przewinięciu strony w dół akcje i zakładki modułu **nadal widoczne** (dziś: 0 widocznych),
  - z wyłączonym trybem administratora liczba elementów widocznych wyłącznie dla administratora
    w zwykłych widokach = **0**,
  - pasek sterowania obserwatorami mieści się w **jednym wierszu** przy szerokości 360 px (dziś dwa
    wiersze plus osobny blok na dole),
  - powiadomienie o koszcie w całości poniżej wcięcia aparatu (dziś częściowo zasłonięte).

## 3. Historyjki użytkownika

- Jako użytkownik chcę mieć gwiazdkę „zapisz to miejsce" zawsze w tym samym miejscu — przy dzwonku
  powiadomień — żeby nie zastanawiać się, gdzie jej szukać na danym ekranie.
- Jako użytkownik przeglądający długą listę chcę móc kliknąć „Nowy temat" bez przewijania z powrotem
  na górę.
- Jako administrator chcę jednym przełącznikiem zobaczyć aplikację dokładnie tak, jak widzi ją zwykły
  użytkownik — żeby ocenić, czy interfejs jest dla niego czytelny.
- Jako administrator chcę, żeby powiadomienia o koszcie AI zachowywały się jak powiadomienia i były
  w całości widoczne na telefonie.
- Jako czytelnik Wiadomości chcę widzieć tematy, w których COŚ jest — puste mają mi nie zabierać ekranu,
  ale chcę móc je pokazać, gdy sprawdzam, czy temat w ogóle działa.
- Jako użytkownik Wiadomości chcę znaleźć ustawienia modułu tam, gdzie się ich spodziewam — w
  ustawieniach, a nie w zakładce ze źródłami.
- Jako użytkownik Pogody chcę od razu wiedzieć, czy ocena obserwatorów jest aktualna, i móc ją
  odświeżyć bez schodzenia na dół strony.
- Jako użytkownik Pogody chcę od razu widzieć, że mam do wyboru nowe propozycje albo zapisane pomysły.

## 4. Kryteria akceptacji (testowalne)

### A. Chrom konta i akcje strony *(zgłoszenia 2, 3)*

- [ ] **AC-1** — Given dowolny widok modułu, when patrzę na chrom konta (na telefonie: górny pasek
  z dzwonkiem; na komputerze: rząd chromu w panelu bocznym), then jest tam gwiazdka „zapisz to
  miejsce w ulubionych" i działa tak samo jak dotąd (zapis pod nazwą, odznaczenie).
- [ ] **AC-2** — Given dowolny widok modułu, when szukam gwiazdki w pasku widoku, then jej tam nie ma:
  w całej aplikacji istnieje **dokładnie jedno** wejście do zapisu widoku.
- [ ] **AC-3** — Given trasa bez ramy modułu (np. panel administracyjny), when chcę zapisać to miejsce
  w ulubionych, then gwiazdka jest dostępna tak samo jak wszędzie indziej.
- [ ] **AC-4** — Given widok z zawartością dłuższą niż ekran, when przewijam treść w dół, then tytuł,
  zakładki i akcje strony pozostają widoczne u góry obszaru treści — na telefonie i na komputerze.
- [ ] **AC-5** — Given telefon o szerokości 360 px, when otwieram widok z przyklejonym paskiem, then
  strona nie przewija się w poziomie, nagłówek nie dubluje się, a treść nie chowa się pod paskiem.

### B. Wskaźnik świeżości *(zgłoszenie 2)*

- [ ] **AC-6** — Given dowolny widok, when patrzę na pasek widoku, then nie ma tam wskaźnika
  „ostatnie odświeżenie danych" ani zbiorczego menu chromu — a informacja o świeżości, którą moduł
  realnie posiada (ostatnie odświeżanie Wiadomości, „wygenerowano / nieaktualne" w sekcjach AI),
  zostaje nietknięta.
- [ ] **AC-7** — Given komputer, when chcę otworzyć ściągawkę skrótów klawiszowych, then mam do niej
  wejście w chromie konta oraz skrót „?" — funkcja nie ginie razem z menu.

### C. Tryb administratora *(zgłoszenia 7, 9)*

- [ ] **AC-8** — Given konto administratora z **wyłączonym** trybem administratora, when przeglądam
  zwykłe widoki aplikacji, then nie widzę żadnego elementu przeznaczonego wyłącznie dla administratora:
  ani kosztów AI i danych o modelu/tokenach, ani powiadomień o koszcie, ani pływającego przycisku
  zgłaszania błędów, ani administracyjnego eksportu listy zadań.
- [ ] **AC-9** — Given konto administratora z wyłączonym trybem administratora, when szukam sposobu,
  by go włączyć, then sam przełącznik oraz nawigacja do panelu administracyjnego są nadal widoczne.
- [ ] **AC-10** — Given konto administratora, when włączam tryb administratora, then wszystkie
  powyższe elementy wracają, a przełącznik jest opisany jako tryb administratora, nie jako sam koszt.
- [ ] **AC-11** — Given konto BEZ uprawnień administratora, when przeglądam aplikację, then nic się
  dla mnie nie zmienia — ani przełącznika, ani żadnego z tych elementów nie widzę (jak dotąd).
- [ ] **AC-12** — Given telefon z wcięciem na aparat, when pojawia się powiadomienie o koszcie AI,
  then jest w całości poniżej wcięcia i czytelne.
- [ ] **AC-13** — Given operacja AI, when kończy się i pojawia się powiadomienie o koszcie, then
  zachowuje się jak powiadomienie (płynnie się pojawia, samo znika, można je odsunąć), a nie jak
  dymek podpowiedzi przyklejony do krawędzi.

### D. Wiadomości *(zgłoszenia 1, 8)*

- [ ] **AC-14** — Given temat bez nowych wiadomości, when otwieram listę tematów, then tego tematu
  domyślnie nie widać — ani w treści, ani na liście skoku do tematów.
- [ ] **AC-15** — Given ukryte puste tematy, when włączę pokazywanie pustych tematów, then wracają
  wraz z dotychczasową informacją „Brak nowych wiadomości w tym temacie", a wybór jest zapamiętany
  dla mojego konta między wizytami.
- [ ] **AC-16** — Given wszystkie tematy puste, when otwieram moduł, then dostaję zrozumiały komunikat
  („nic nowego, odśwież"), a nie pustą stronę wyglądającą jak usterka.
- [ ] **AC-17** — Given moduł Wiadomości, when szukam ustawień modułu, then są w zakładce
  z ustawieniami (domyślna długość streszczeń, pokazywanie pustych tematów), a zakładka „Źródła"
  zawiera wyłącznie źródła.

### E. Pogoda *(zgłoszenia 4, 5, 6)*

- [ ] **AC-18** — Given sekcja obserwatorów, when ją otwieram, then **nad** listą stoi jeden pasek
  zawierający: wybór układu listy, informację kiedy ocena powstała i czy jest nieaktualna, wejście do
  ponownej oceny, ustawienie trybu odświeżania oraz koszt (gdy tryb administratora włączony).
- [ ] **AC-19** — Given ten pasek, when porównuję go z poprzednim stanem, then **żadna funkcja nie
  zginęła**: wszystko, co dawało się zrobić w bloku na dole i w rzędzie nad listą, daje się zrobić tutaj.
- [ ] **AC-20** — Given ocena obserwatorów, when patrzę na wejście do jej ponowienia, then jego nazwa
  mówi, co się stanie („Oceń ponownie" zastąpione zrozumiałym określeniem ponownej analizy pogody).
- [ ] **AC-21** — Given telefon o szerokości 360 px, when patrzę na sekcję obserwatorów, then pasek
  sterowania mieści się w jednym wierszu i nie łamie się na kolejne.
- [ ] **AC-22** — Given sekcja obserwatorów, when jej używam, then nie ma już chipsów filtra statusów
  („Spełnione 0", „Częściowo 3"…) — liczby stanów pozostają dostępne w układzie z sekcjami.
- [ ] **AC-23** — Given sekcja „Co robić?", when ją otwieram, then od razu widać, że mam do wyboru
  nowe propozycje albo zapisane pomysły, a przejście do zapisanych jest równorzędnym, widocznym
  wejściem, nie drobnym odnośnikiem na dole.

## 5. Zakres

**W zakresie:**
- Przeniesienie gwiazdki ulubionych do chromu konta i usunięcie wstrzykiwania chromu powłoki do paska
  widoku (wraz ze zbiorczym menu chromu, które przestaje mieć zawartość).
- Przyklejenie paska widoku u góry obszaru treści — jednym mechanizmem dla telefonu i komputera.
- Usunięcie wskaźnika świeżości danych powłoki; zachowanie wejścia do ściągawki skrótów.
- Rozszerzenie przełącznika administratora na wszystkie dodatki widoczne wyłącznie dla administratora
  w zwykłych widokach + zmiana jego nazwy.
- Poprawki powiadomień o koszcie: obszar bezpieczny ekranu i zachowanie powiadomienia.
- Wiadomości: domyślne ukrycie pustych tematów z przełącznikiem, wydzielenie ustawień modułu z zakładki
  „Źródła".
- Pogoda: jeden pasek sterowania nad listą obserwatorów, usunięcie chipsów filtra, uwidocznienie
  wyboru „nowe propozycje / zapisane pomysły".

**Poza zakresem (świadomie):**
- **Globalny górny pasek aplikacji na komputerze** (wariant „drugi wiersz górnego paska"). Odrzucony
  świadomie: na komputerze takiego paska nie ma i dorabianie go dotknęłoby 21 modułów naraz.
- **Świeżość danych per moduł** — uczciwy wskaźnik wymagałby, żeby każdy moduł zgłaszał moment pobrania
  własnych danych; to praca w 21 modułach, nie w tym przebiegu.
- **Zastąpienie odpytywania w tle kanałem zdarzeń** (Faza 4 przebudowy) — nietykane.
- **Nowe ustawienia modułu Wiadomości ponad te dwa** („może moduł mógłby mieć więcej ustawień" —
  zakładka powstaje, ale nie wymyślamy do niej treści na zapas, C-53).
- **Przywrócenie filtra statusów obserwatorów w innej formie** — właściciel powiedział wprost, że
  takiego filtra nie chce.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian. Tryb administratora steruje wyłącznie **rysowaniem** tego, co
  konto administratora i tak już otrzymuje; decyzja „czy w ogóle dostajesz te dane" zostaje po stronie
  serwera i pozostaje nietknięta. Konto bez uprawnień administratora nie może przez ten przełącznik
  zobaczyć niczego nowego.
- **Własność danych:** preferencja „pokazuj puste tematy" należy do użytkownika (jego przestrzeni
  osobistej), tak jak pozostałe preferencje modułu Wiadomości. Preferencja trybu administratora
  zostaje tam, gdzie jest dziś — jest sposobem oglądania aplikacji na jednym urządzeniu, nie danymi
  konta. Preferencja filtra statusów obserwatorów przestaje być potrzebna.
- **Asystent AI:** nie dotyczy — brak nowych akcji i narzędzi odczytu. Zmienia się wyłącznie to, komu
  i kiedy pokazujemy koszt już liczonych wywołań.
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Powiadomienia o koszcie świadomie **nie** trafiają
  do dzwonka ani do bazy (decyzja z 083 zostaje w mocy).

## 7. Zgodność z konstytucją

- **C-31 (mobile-first)** — sedno zgłoszeń 2, 4, 5 i 9: przyklejony pasek nie może dołożyć poziomego
  przewijania ani zasłonić treści, pasek obserwatorów ma mieścić się w jednym wierszu przy 360 px,
  a powiadomienie o koszcie musi respektować obszar bezpieczny ekranu (wcięcie aparatu).
- **C-33 (kontrakt widoku)** — zmiana dotyka ramy, więc idzie **przez poszerzenie ramy**, nie przez
  wyjątek w module. Rama traci wstrzykiwany chrom powłoki (nie ma już czego wstrzykiwać) i zyskuje
  przyklejanie; moduły nie zmieniają swoich deklaracji.
- **C-35 (komponent z konsumentem)** — odwrotnie niż zwykle: mechanizm bez zawartości ma zniknąć.
  Wstrzykiwanie chromu do paska bez ani jednego elementu byłoby martwym API w miejscu wspólnym
  (lekcja z 084).
- **C-53 (minimalizm)** — nie dorabiamy globalnego paska na komputerze, nie wymyślamy ustawień
  Wiadomości na zapas, nie zastępujemy usuniętego filtra innym filtrem.
- **C-30 (kolory zmiennymi CSS)**, **C-32 (teksty przez `t()`, polski źródłowy)**, **C-34
  (potwierdzenia przez wspólne okno)** — obowiązują we wszystkich zmianach UI.
- **C-20/C-21** — zmiana preferencji użytkownika idzie akcją serwerową z odświeżeniem ścieżki i pod
  guardem własności.
- **C-10..C-13** — jeżeli preferencja „pokazuj puste tematy" wymaga kolumny, powstaje **ręczny** plik
  migracji z numerem z narzędzia; statusy pozostają tekstem, nie typem wyliczeniowym; weryfikacja
  wyłącznie na lokalnej bazie.
- **C-51** — wnioski z tego przebiegu trafiają do dziennika doświadczeń.
- **C-54/C-55** — decyzje właściciela zebrane w jednym momencie (poniżej); dalsze etapy jadą na nich.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jednym pytaniu na starcie; właściciel wybrał **wszystkie cztery warianty zalecane**:

- [x] **Gwiazdka ulubionych → chrom konta, jedno miejsce.** Na telefonie w górnym pasku obok dzwonka,
  na komputerze w rzędzie chromu panelu bocznego. Świadomy koszt: na komputerze gwiazdka jest dalej od
  treści, której dotyczy — w zamian znika dwuznaczność „dwa wejścia do jednej akcji". Odwraca to część
  decyzji z 083 i przywraca dostępność zapisu widoku na trasach bez ramy modułu (AC-3).
- [x] **Akcje strony → przyklejony pasek widoku.** Odrzucony wariant „drugi wiersz globalnego paska":
  na komputerze takiego paska nie ma, więc trzeba by go dorobić dla wszystkich modułów naraz.
- [x] **Wskaźnik świeżości → usunąć całkiem.** Powód merytoryczny, nie estetyczny: mierzy moment
  automatycznego przeładowania strony przez powłokę, a nie świeżość danych modułu, więc jego treść
  wprowadza w błąd. Realną świeżość moduły pokazują u siebie i to zostaje.
- [x] **Tryb administratora → obejmuje wszystko, co widzi tylko administrator w zwykłych widokach.**
  Koszty i dane o modelu, powiadomienia o koszcie, pływający przycisk zgłaszania błędów, administracyjny
  eksport listy zadań. Sam przełącznik i nawigacja do panelu administracyjnego zostają zawsze.

**Założenia przyjęte samodzielnie** (nie starczyło miejsca na piąte pytanie; do korekty przez
właściciela w każdej chwili):

- **Puste tematy: domyślnie ukryte + przełącznik**, a nie ukryte na stałe. Powód: właściciel prosi
  o „domyślnie", co zakłada możliwość zmiany, a bez przełącznika nie dałoby się sprawdzić, czy świeżo
  dodany temat w ogóle działa.
- **Przełącznik pustych tematów mieszka w nowej zakładce ustawień modułu**, razem z długością
  streszczeń — dzięki temu zgłoszenia 1 i 8 dają jedną, spójną zmianę zamiast dwóch osobnych.
- **Ściągawka skrótów zostaje na komputerze** (chrom konta + skrót „?"), a znika z telefonu, gdzie
  skróty klawiszowe i tak nie mają zastosowania.
- **Liczniki stanów obserwatorów** przestają być chipsami, ale pozostają widoczne w układzie
  z sekcjami — usuwamy filtr, nie informację.

## 9. Ryzyka

- **Przyklejony pasek zasłania treść albo dubluje nagłówek.** To najczęstszy błąd tej zmiany i dotyczy
  wszystkich modułów naraz. Ograniczamy: jeden mechanizm dla obu szerokości ekranu, pomiar w
  przeglądarce przy 360 px i na komputerze, sprawdzenie modułów o nietypowym układzie (wielopanelowe,
  wirtualizowane listy, gęste paski narzędzi) — nie tylko jednego widoku.
- **Usuwamy mechanizm wstrzykiwania chromu, który jest sercem kontraktu widoku z 045.** Ryzyko
  regresji w bramce kontraktu widoku i w widokach osadzonych (galeria komponentów). Ograniczamy:
  bramka zostaje, zmienia się wyłącznie treść chromu; rama nadal jest jedynym miejscem, gdzie widok
  deklaruje tytuł, filtry, akcje i stany brzegowe.
- **Rozszerzenie trybu administratora może ukryć coś, czego administrator potrzebuje do pracy.**
  Ograniczamy: przełącznik i wejście do panelu administracyjnego są jawnie wyłączone spod tej reguły
  (AC-9), a lista objętych elementów jest skończona i wypisana w kryteriach.
- **Ukrycie pustych tematów może wyglądać jak utrata danych.** Ograniczamy: komunikat, gdy ukryte
  zostało wszystko (AC-16), i widoczny przełącznik w ustawieniach.
- **„Nie pomiń żadnych funkcji" przy scalaniu paska obserwatorów.** Ograniczamy: AC-19 wymaga
  porównania funkcja po funkcji ze stanem sprzed zmiany, a nie oceny „wygląda kompletnie".
