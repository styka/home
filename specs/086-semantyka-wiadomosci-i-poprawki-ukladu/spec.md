# Spec: Semantyka akcji w Wiadomościach, świeże gorące tematy i poprawki układu

- **ID:** 086-semantyka-wiadomosci-i-poprawki-ukladu
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-24
- **Moduł(y):** Wiadomości, Pogoda, powłoka (chrom konta, potwierdzenia), asystent AI

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Jedenaście zgłoszeń z testów 085 układa się w trzy bóle o bardzo różnym ciężarze.

**Interfejs Wiadomości kłamie o tym, co robi.** Dwa przyciski na karcie wiadomości — „Odrzuć"
i „Przeczytane" — mają **identyczny skutek**: wiadomość znika z listy. Różnica istnieje wyłącznie
w bazie (`DISMISSED` kontra `ACKNOWLEDGED`) i **nigdzie nie jest odczytywana**: nic jej nie liczy,
nie pokazuje ani nie filtruje. Użytkownik stoi więc przed wyborem, który nie jest wyborem. Do tego
pytanie „oznaczyć wszystkie jako przeczytane?" zamyka się czerwonym przyciskiem **„Usuń"** — bo tak
brzmi domyślna etykieta wspólnego okna potwierdzeń, używana dziś w 34 miejscach niezależnie od tego,
czy cokolwiek jest usuwane. Trzeci element tej samej układanki: zakładka „Gorące tematy" pokazuje
listę sprzed ostatniego pobrania materiałów, bo powstaje wyłącznie na jawne kliknięcie.

**Tryb administratora z 085 trafił w dwie rzeczy odwrotnie, niż powinien.** Powiadomienia o koszcie
AI schowały się razem z resztą dodatków, a właściciel chce je widzieć **zawsze** — to jego kontrola
nad wydatkami, a nie ozdoba. Odwrotnie z technicznym logiem rozumowania asystenta: ten **ma** się
chować, bo jest surowym zrzutem dla administratora. Do tego powiadomienie o koszcie nadal wypada za
blisko wcięcia aparatu iPhone'a.

**Sześć drobiazgów układu i nazewnictwa** — brak odstępu nad chipsami w Pomysłach, zła kolejność
w pasku obserwatorów, długa nazwa lokalizacji przycinająca tytuł modułu na telefonie, rząd ikon
w niewygodnym miejscu menu, nagłówki tematów przyklejające się za nisko i kontrolka „Tematy"
w zakładce „Tematy".

## 2. Cel i miary sukcesu

- **Cel:** każda akcja w Wiadomościach robi dokładnie to, co obiecuje jej nazwa; gorące tematy są
  świeże bez klikania; tryb administratora chowa to, co techniczne, i nie chowa tego, co służy
  kontroli kosztów; sześć poprawek układu domkniętych.
- **Sukces mierzymy:**
  - **zero** par kontrolek o identycznym skutku na karcie wiadomości (dziś: jedna para),
  - **zero** okien potwierdzenia proponujących „Usuń" dla operacji, która niczego nie usuwa,
  - lista gorących tematów odzwierciedla ostatnie pobranie materiałów **bez** dodatkowego kliknięcia,
  - powiadomienie o koszcie widoczne dla administratora przy **obu** stanach przełącznika,
  - przyklejony nagłówek tematu styka się z paskiem nad nim (odstęp ≤ 4 px, dziś wyraźnie większy),
  - tytuł modułu Pogoda czytelny przy 360 px niezależnie od długości nazwy lokalizacji.

## 3. Historyjki użytkownika

- Jako czytelnik Wiadomości chcę mieć **jedną** jednoznaczną akcję zamykającą wiadomość, żeby nie
  zgadywać, którą wybrać.
- Jako użytkownik chcę, żeby okno potwierdzenia mówiło, co się stanie — a czerwony przycisk „Usuń"
  pojawiał się wtedy, gdy naprawdę coś ginie.
- Jako czytelnik chcę, żeby po pobraniu nowych materiałów gorące tematy były już przeliczone.
- Jako administrator chcę widzieć koszt każdej operacji AI **niezależnie** od tego, czy oglądam
  aplikację oczami użytkownika — to moja kontrola nad wydatkami.
- Jako administrator chcę, żeby techniczny log rozumowania asystenta chował się razem z pozostałymi
  dodatkami dla administratora.
- Jako użytkownik Pogody chcę widzieć nazwę modułu na telefonie, nawet gdy moja lokalizacja ma długą
  nazwę.
- Jako użytkownik chcę mieć ikony konta tam, gdzie na nie patrzę — u góry menu, pod nazwą aplikacji.

## 4. Kryteria akceptacji (testowalne)

### A. Semantyka akcji w Wiadomościach

- [x] **AC-1** — Given karta wiadomości, when patrzę na jej akcje, then jest **jedna** akcja
  zamykająca wiadomość (nie dwie o tym samym skutku), a jej nazwa mówi, co się stanie.
- [x] **AC-2** — Given wiadomość zamknięta tą akcją, when wracam na listę, then wiadomości nie ma
  wśród nowych, a jej treść **nie zostaje usunięta** ze źródła ani z linii czasu tematu.
- [x] **AC-3** — Given karta wiadomości, when najeżdżam na akcję zamykającą, then podpowiedź mówi
  wprost, że dotyczy **mojej listy**, a nie kasowania czegokolwiek.
- [x] **AC-4** — Given moduł Wiadomości, when szukam akcji „Odrzuć", then jej nie ma — ani na karcie,
  ani nigdzie indziej w module.

### B. Potwierdzenia w całej aplikacji

- [x] **AC-5** — Given operacja, która **niczego nie usuwa** (np. oznaczenie wszystkich wiadomości
  jako przeczytanych), when pojawia się okno potwierdzenia, then przycisk potwierdzający jest
  neutralny i nie brzmi „Usuń".
- [x] **AC-6** — Given operacja, która **usuwa dane** (np. usunięcie tematu, listy, obserwatora),
  when pojawia się okno potwierdzenia, then przycisk nadal jest czerwony i brzmi „Usuń".
- [x] **AC-7** — Given przegląd wszystkich miejsc wywołujących potwierdzenie, when sprawdzam ich
  etykiety, then każde ma świadomie dobraną wersję — żadne nie polega na przypadkowym domyślnym.

### C. Świeże gorące tematy

- [x] **AC-8** — Given zakończone pobieranie nowych materiałów, when otwieram zakładkę „Gorące
  tematy", then lista jest przeliczona z materiałów z tego pobrania, bez klikania czegokolwiek.
- [x] **AC-9** — Given przebieg pobierania, when kończy się bez nowych materiałów, then gorące tematy
  **nie są** przeliczane — nie płacimy za analizę tej samej puli drugi raz.
- [x] **AC-10** — Given przeliczenie w tle, when patrzę na zakładkę, then widzę, kiedy lista powstała,
  a ręczne przeliczenie nadal jest dostępne.
- [x] **AC-11** — Given nieudane przeliczenie gorących tematów, when przebieg pobierania się kończy,
  then **pobrane wiadomości i tak są zapisane** — awaria dodatkowego etapu nie może zabrać
  użytkownikowi tego, co już się udało.

### D. Tryb administratora — dwie korekty

- [x] **AC-12** — Given konto administratora z **wyłączonym** trybem administratora, when kończy się
  operacja AI, then powiadomienie o jej koszcie **pojawia się**.
- [x] **AC-13** — Given konto **bez** uprawnień administratora, when kończy się operacja AI, then
  żadne powiadomienie o koszcie się nie pojawia (bez zmian wobec stanu obecnego).
- [x] **AC-14** — Given konto administratora z wyłączonym trybem administratora, when otwieram
  odpowiedź asystenta, then **nie ma** wejścia do technicznego logu rozumowania; log opisany po
  ludzku (dla wszystkich) zostaje.
- [x] **AC-15** — Given telefon z wcięciem na aparat, when pojawia się powiadomienie o koszcie, then
  jest wyraźnie poniżej wcięcia — z zapasem większym niż dotychczasowy.

### E. Układ i nazewnictwo

- [x] **AC-16** — Given widok Pomysłów, when patrzę na chipsy filtrujące, then są wyraźnie oddzielone
  od opisu modułu nad nimi.
- [x] **AC-17** — Given sekcja obserwatorów, when patrzę na pasek sterowania, then informacja
  o odświeżaniu jest **nad** ikonami wyboru układu, a nie obok nich.
- [x] **AC-18** — Given telefon 360 px i lokalizacja o długiej nazwie, when otwieram Pogodę, then
  tytuł modułu jest w całości czytelny, a nazwa lokalizacji nie rozpycha ani nie przycina nagłówka.
- [x] **AC-19** — Given panel boczny na komputerze, when patrzę pod nazwę aplikacji, then rząd ikon
  konta stoi tam, **przed** pozycją „Strona główna", i wszystkie ikony działają jak dotąd.
- [x] **AC-20** — Given lista wiadomości, when nad paskiem nawigacji modułu pojawia się dodatkowy
  element (np. pasek stanu odświeżania), then przyklejone nagłówki tematów **nie zsuwają się niżej** —
  zasłona zostaje na wysokości obu pasków. *(Kryterium doprecyzowane po pomiarze: pierwotne brzmienie
  „styka się bez przerwy" jest prawdziwe także przy błędnej mierze, więc nie dało się nim niczego
  rozstrzygnąć.)*
- [x] **AC-21** — Given zakładka „Tematy", when patrzę na kontrolkę wyboru tematu, then jej nazwa
  mówi, że służy do **przejścia** do tematu, a nie powtarza nazwy zakładki.

## 5. Zakres

**W zakresie:** wszystkie jedenaście zgłoszeń — semantyka akcji w Wiadomościach (8), domyślna
etykieta potwierdzeń w całej aplikacji (9), przeliczanie gorących tematów w przebiegu pobierania
(10), dwie korekty trybu administratora (6, 11), wcięcie aparatu (11), oraz sześć poprawek układu
i nazewnictwa (1, 2, 3, 4, 5, 7).

**Poza zakresem (świadomie):**
- **Uczenie się preferencji z odrzuceń** — wariant, w którym „Odrzuć" wpływałby na dopasowywanie
  wiadomości do tematów. Właściciel wybrał usunięcie akcji, nie nadanie jej nowego znaczenia.
- **Kosz / przywracanie zamkniętych wiadomości** — zamknięcie nie usuwa danych, więc nie ma czego
  przywracać; pełny kosz dla wiadomości to osobna funkcja.
- **Dokładanie nowych ikon do rzędu chromu** — miejsce zostaje przygotowane, ikony dodamy, gdy
  pojawi się konkretna potrzeba (C-53).
- **Próg „przeliczaj tylko przy dużej liczbie nowych"** — odrzucony jako kolejna liczba do zgadywania.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian. Widoczność kosztu dla administratora pozostaje decyzją serwera;
  przełącznik trybu steruje wyłącznie rysowaniem.
- **Własność danych:** bez zmian. Zamknięcie wiadomości dotyczy pozycji w przestrzeni właściciela;
  wycofywany status przestaje być zapisywany, co nie odbiera nikomu dostępu.
- **Asystent AI:** brak nowych akcji i narzędzi odczytu. Zmienia się widoczność technicznego logu
  rozumowania oraz moment, w którym powstają gorące tematy (dodatkowy etap istniejącego zadania
  w tle, a nie nowe zadanie).
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Powiadomienia o koszcie świadomie **nie**
  trafiają do dzwonka (decyzja z 083 zostaje).

## 7. Zgodność z konstytucją

- **C-34 (potwierdzenia)** — sedno zgłoszenia 9. Wspólne okno potwierdzeń istnieje po to, żeby
  pokazać, CO się stanie; domyślna etykieta „Usuń" dla operacji nieusuwających działa przeciw temu.
- **C-53 (minimalizm)** — usuwamy akcję, która nic nie wnosi, zamiast dopisywać jej znaczenie; nie
  dokładamy ikon na zapas; nie wprowadzamy progu liczby materiałów.
- **C-12** — status wiadomości pozostaje tekstem z zawężeniem w typach; wycofywana wartość znika
  z użycia, nie zmieniamy mechanizmu.
- **C-31 (mobile)** — zgłoszenia 3, 5 i 15 są wprost o telefonie: czytelny tytuł przy 360 px,
  przyklejenie bez przerwy, obszar bezpieczny ekranu.
- **C-30, C-32** — kolory tokenami, teksty po polsku przez wspólny mechanizm.
- **C-20/C-21** — zmiany akcji serwerowych zachowują guardy i odświeżanie ścieżek.
- **C-51** — wnioski trafiają do dziennika doświadczeń.
- **C-54/C-55** — decyzje właściciela zebrane w jednym momencie; ten spec **odwraca** dwie decyzje
  z 085 (powiadomienia o koszcie pod przełącznikiem, rząd chromu w stopce) i mówi o tym wprost.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jednym pytaniu na starcie; właściciel wybrał **wszystkie warianty zalecane**:

- [x] **„Odrzuć" i „Przeczytane" → jedna akcja.** Zostaje zamknięcie wiadomości; „Odrzuć" znika, bo
  dziś nie robi nic innego. Odrzucony wariant „dwie akcje z realną różnicą" (odrzucenie wpływające na
  dopasowywanie) — to nowa funkcja, nie naprawa nazewnictwa.
- [x] **Domyślna etykieta potwierdzenia → neutralna, w całej aplikacji.** Usuwanie deklaruje się
  jawnie. Uzasadnienie właściciela zapisane wprost: czerwony przycisk, który jest wszędzie, przestaje
  ostrzegać. Koszt: przegląd 34 wywołań.
- [x] **Gorące tematy → przeliczane w przebiegu pobierania.** Świadomy koszt: jedno wywołanie modelu
  na przebieg odświeżania. Ograniczony przez AC-9 (brak nowych materiałów = brak przeliczania).
- [x] **Rząd ikon → pod nazwę aplikacji, przed „Stroną główną", bez dokładania nowych ikon.**

**Założenia przyjęte samodzielnie** (do korekty w każdej chwili):

- **Powiadomienie o koszcie wychodzi spod przełącznika trybu administratora**, ale wskaźnik kosztu
  **przy treści** zostaje pod nim. To rozróżnienie jest sednem zgłoszenia 11: powiadomienie jest
  ulotne i niczego nie zabiera z ekranu, a wskaźnik zajmuje miejsce w treści na stałe.
- **Zamknięcie wiadomości zostaje nieodwracalne z poziomu ekranu**, tak jak dziś — właściciel nie
  prosił o cofanie, a wiadomość i tak nie znika z linii czasu tematu.

## 9. Ryzyka

- **Zmiana domyślnej etykiety potwierdzeń dotyka 34 miejsc naraz.** Ryzyko: operacja naprawdę
  usuwająca dostanie neutralny przycisk i przestanie ostrzegać. Ograniczamy: przegląd **każdego**
  wywołania z osobna i jawne oznaczenie usuwających (AC-6, AC-7) — nie licząc na to, że „większość
  jest nieusuwająca".
- **Przeliczanie gorących tematów w tle to nowy koszt na każdym przebiegu.** Ograniczamy: warunek
  „tylko gdy przyszły nowe materiały" i utrzymanie ręcznego przeliczania jako drogi wyjścia.
- **Etap dodany do zadania w tle może wywrócić cały przebieg.** Ograniczamy: awaria przeliczania
  gorących tematów nie może cofnąć zapisanych wiadomości (AC-11) — to jest ta sama lekcja, co
  z partiami streszczeń w 084.
- **Przyklejenie nagłówków to trzecia zmiana tej samej mechaniki w trzech przebiegach** (083, 085,
  teraz). Ograniczamy: pomiar odstępu w przeglądarce jako kryterium, nie ocena wzrokowa.
