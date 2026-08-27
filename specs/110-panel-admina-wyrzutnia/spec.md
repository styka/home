# Spec: Panel administratora jako pogrupowana wyrzutnia

- **ID:** 110-panel-admina-wyrzutnia
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-27
- **Moduł(y):** panel administratora (`/admin`) — powierzchnia powłoki, nie moduł z rejestru `MODULES`

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Właściciel zgłasza o `/admin` dokładnie to, co miesiąc temu zgłosił o `/settings`: „widok ma bardzo
długi […] trzeba przewijać/szukać, gdzie coś jest, żeby do czegoś dojść, i ciężko jest na to trafić".

Stan zastany, odczytany z kodu (nie z opisu zgłoszenia):

- `/admin` to **jedna kolumna**: karta buildu → **jedenaście liczników** z bazy → skrót do
  konfiguracji → **płaska lista dwudziestu jeden narzędzi** → aktywna sesja.
- Lista narzędzi nie ma **żadnych grup**: „Zarządzanie dostępem", „Audyt stanu projektu",
  „Skórki systemowe" i „Testy klikacze" stoją w jednym nierozróżnialnym pasku, jeden pod drugim,
  każde z tą samą ikoną-strzałką po prawej. Nie ma wyszukiwania.
- Nazwy pozycji nie są uporządkowane wedle niczego — sąsiadują ze sobą rzeczy z zupełnie różnych
  światów (moderacja zgłoszeń usług obok galerii komponentów).
- **Dwie trasy panelu nie mają odnośnika w ogóle.** `/admin/llm` — konfiguracja dostawców i modeli
  LLM, jedna z najważniejszych powierzchni administracyjnych — **nie jest podlinkowana z żadnego
  miejsca w aplikacji**; dojście do niej wymaga wpisania adresu z pamięci. `/admin/qa` prowadzi
  wyłącznie z modułu QA, nie z panelu.
- Wejście do panelu **po cokolwiek** wykonuje jedenaście zapytań zliczających do bazy — płaci za nie
  także ten, kto wchodzi tylko po to, żeby kliknąć jedno narzędzie.
- Nagłówek jest rysowany ręcznie, poza kontraktem widoku, więc panel wygląda inaczej niż reszta
  aplikacji.

## 2. Cel i miary sukcesu

- **Cel:** `/admin` przestaje być listą do przewijania, a staje się **miejscem startu**: nazwane grupy
  narzędzi z krótkim opisem każdego, plus wyszukiwarka.
- **Sukces mierzymy:**
  - dojście do dowolnego narzędzia panelu: **jedno kliknięcie** z `/admin` (albo wpisanie frazy
    w wyszukiwarkę), **bez przewijania w poszukiwaniu nazwy**;
  - **każda trasa panelu ma odnośnik** — po zmianie w aplikacji nie ma administracyjnej strony,
    do której da się dojść wyłącznie z pamięci adresu;
  - wejście na `/admin` **nie wykonuje zapytań zliczających** — dane liczbowe ładują się dopiero
    wtedy, gdy ktoś po nie wejdzie;
  - z dowolnego narzędzia panelu widać **drogę powrotną** do panelu.

## 3. Historyjki użytkownika

- Jako administrator chcę **zobaczyć narzędzia w nazwanych grupach**, żeby wiedzieć, gdzie szukać,
  zamiast czytać dwadzieścia jeden podobnych wierszy.
- Jako administrator chcę **wpisać „skorka" albo „kolejka" i trafić prosto do narzędzia**, kiedy nie
  pamiętam, jak dokładnie nazywa się pozycja.
- Jako administrator chcę **dojść z panelu do konfiguracji modeli LLM**, zamiast pamiętać jej adres.
- Jako administrator chcę, żeby **wejście do panelu było natychmiastowe**, bo najczęściej wchodzę tu
  po to, żeby pójść dalej — a nie po statystyki.
- Jako administrator chcę mieć **liczby i informację o buildzie w jednym miejscu**, kiedy faktycznie
  ich potrzebuję.
- Jako administrator chcę **wrócić z narzędzia do panelu jednym kliknięciem**, bez menu bocznego.

## 4. Kryteria akceptacji (testowalne)

### Wyrzutnia

- [ ] **AC-1** — Given administrator, when otworzy `/admin`, then widzi narzędzia rozdzielone na
      **nazwane grupy** (co najmniej pięć), a każda pozycja ma nazwę **i** jednozdaniowy opis mówiący,
      do czego służy.
- [ ] **AC-2** — Given `/admin` na komputerze, when strona się wyświetli, then **żadna pozycja nie
      wymaga przewijania w poszukiwaniu nazwy grupy** — nagłówek grupy jest widoczny razem z jej
      zawartością (grupy są krótkie, nie jedna lista pod jednym nagłówkiem).
- [ ] **AC-3** — Given `/admin`, when policzymy odnośniki do stron panelu, then **każda istniejąca
      trasa `/admin/*` ma dokładnie jeden odnośnik** — w szczególności `/admin/llm` i `/admin/qa`,
      które dziś nie mają go wcale.
- [ ] **AC-4** — Given dowolne narzędzie z panelu, when administrator w nie kliknie, then trafia pod
      jego adres **jednym kliknięciem**, bez ekranu pośredniego.
- [ ] **AC-5** — Given użytkownik **bez** uprawnienia administratora, when wejdzie na `/admin` lub na
      nowy adres przeglądu, then zostaje odesłany tak samo jak dziś (zachowanie bez zmian).

### Wyszukiwarka

- [ ] **AC-6** — Given `/admin`, when administrator wpisze frazę pasującą do nazwy lub opisu
      narzędzia (np. „skorka", „kolejka", „uprawnienia"), then lista zawęża się do pasujących,
      a wybranie wyniku otwiera właściwe narzędzie.
- [ ] **AC-7** — Given fraza bez polskich znaków diakrytycznych („zrodla", „jezyk", „dostep"),
      when lista się filtruje, then pozycje z diakrytykami w nazwie **są znajdowane**.
- [ ] **AC-8** — Given fraza bez trafień, when lista się zawęzi, then administrator widzi **stan
      pusty z wyjaśnieniem**, a nie pustą przestrzeń.

### Przegląd systemu

- [ ] **AC-9** — Given administrator, when otworzy `/admin`, then **nie widzi** karty buildu,
      liczników ani aktywnej sesji — te dane mają własne miejsce, osiągalne z panelu jako pozycja.
- [ ] **AC-10** — Given nowy adres przeglądu, when administrator go otworzy, then widzi **wszystkie
      dane, które dziś są na `/admin`**: branch, commit, wiadomość commitu, datę commitu, datę
      buildu, pięć liczników systemowych (użytkownicy, zespoły, raporty, uprawnienia, aktywność
      7 dni), sześć liczników zawartości (pozycje zakupowe, zadania, notatki, przepisy, zwierzęta,
      pozycje magazynu) oraz e-mail, rolę i identyfikator zalogowanego konta.
- [ ] **AC-11** — Given wejście na `/admin`, when strona się renderuje, then **nie wykonuje zapytań
      zliczających** — obserwowalnie: wejście do panelu nie czeka na policzenie zawartości bazy.

### Powrót i rama

- [ ] **AC-12** — Given dowolna strona panelu (np. skórki, kolejka zadań), when administrator ją
      otworzy, then widzi **odnośnik powrotu do panelu administratora** prowadzący na `/admin`.
- [ ] **AC-13** — Given `/admin` i nowy adres przeglądu, when się wyświetlą, then korzystają ze
      **standardowej ramy widoku** aplikacji (nagłówek rysowany przez ramę, stany brzegowe przez
      ramę), a nie z ręcznie rysowanego nagłówka.
- [ ] **AC-14** — Given dowolna skórka, when administrator otworzy panel, then wszystkie kolory
      pochodzą ze zmiennych motywu (brak zaszytych wartości szesnastkowych w nowym kodzie).
- [ ] **AC-15** — Given telefon (szerokość < 768 px), when administrator otworzy `/admin`, then grupy
      układają się w jedną kolumnę, cele dotyku mają co najmniej 44 px, a treść nie chowa się pod
      dolnym paskiem ani pod obszarem gestów systemu.
- [ ] **AC-16** — Given cały nowy tekst widoczny dla użytkownika, when zostanie wyświetlony, then
      pochodzi ze słownika tłumaczeń (polski jako język źródłowy).

## 5. Zakres

**W zakresie:**

- Przebudowa `/admin` w **pogrupowaną wyrzutnię**: nazwane grupy, pozycja = nazwa + opis + ikona.
- **Wyszukiwarka narzędzi** nad grupami, odporna na brak diakrytyków, ze stanem pustym.
- **Dołożenie brakujących odnośników**: `/admin/llm` i `/admin/qa`.
- **Nowa podstrona „Przegląd systemu"** przejmująca kartę buildu, jedenaście liczników i aktywną
  sesję; `/admin` przestaje je pobierać.
- **Odnośnik powrotu do panelu** na stronach panelu, które go dziś nie mają.
- Wpięcie `/admin` i przeglądu w **standardową ramę widoku**.
- Zachowanie przycisku zgłaszania błędu (tryb „wskaż element"), który dziś siedzi na liście narzędzi.

**Poza zakresem (świadomie):**

- **Zawartość samych narzędzi** — nie zmieniamy ani jednej strony administracyjnej poza dołożeniem
  powrotu; to przeniesienie i uporządkowanie wejść, nie przeprojektowanie panelu RBAC czy skórek.
- **Uprawnienia i role** — kto widzi panel, widzi go tak samo jak dziś; żadna pozycja nie zmienia
  warunku widoczności.
- **Ustawienia użytkownika** (`/settings`) — uporządkowane w przebiegu 109, tu ich nie ruszamy.
- **Paleta poleceń `Ctrl+K`** — dopisanie do niej narzędzi panelu to osobna, sensowna zmiana,
  ale nie ta.
- **Sam moduł QA i moderacja usług** — dostają odnośnik, nic więcej.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Panel i nowa podstrona przeglądu stoją na istniejącym
  `module.admin`, z tym samym sprawdzeniem co dziś. Rozbicie jednej chronionej strony na dwie mnoży
  miejsca do obronienia — nowy adres musi być chroniony **tak samo**, nie „przez sąsiedztwo" (C-22).
- **Własność danych:** brak nowych danych. Liczniki i informacja o buildzie zmieniają miejsce
  wyświetlania, nie źródło ani zakres.
- **Asystent AI:** nie dotyczy — zero nowych `AIAction` i narzędzi odczytu.
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Nic nie jest kasowane.
- **Migracje bazy:** **brak** — cała zmiana jest w warstwie widoku i nawigacji.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — reguła nadrzędna. To zmiana **rozmieszczenia**, nie funkcji: przenosimy
  i grupujemy, nie przepisujemy narzędzi. Wyszukiwarka i mechanizm porównywania fraz **już istnieją**
  po przebiegu 109 — używamy ich, zamiast pisać drugie.
- **C-35 (wspólny komponent z konsumentem)** — jeśli spis narzędzi panelu i spis sekcji ustawień
  okażą się tą samą rzeczą, uogólniamy **jeden** komponent i dowozimy go z **obydwoma** konsumentami;
  jeśli różnią się na tyle, że uogólnienie byłoby naciągane — zostają dwa, a wspólne jest tylko
  porównywanie fraz. Rozstrzygnięcie należy do planu, po przeczytaniu obu.
- **C-33 (widok deklaruje się przez ramę)** — panel przestaje rysować własny nagłówek. Gdyby rama
  nie unosiła tego widoku, poszerzamy ramę, a nie robimy wyjątku w panelu.
- **C-31 (mobile-first)** — grupy w jednej kolumnie na telefonie, cele dotyku ≥ 44 px, respekt dla
  obszaru gestów.
- **C-30 (motyw przez zmienne CSS)** — nowe elementy biorą kolory ze zmiennych.
- **C-32 (teksty przez `t()`)** — nazwy grup, nazwy i opisy narzędzi oraz teksty wyszukiwarki idą do
  słownika.
- **C-22 (RBAC)** — patrz wyżej: nowy adres wymaga własnej kontroli.
- **C-51 (lekcje)** — wszystko nieoczywiste ląduje w dzienniku doświadczeń; w szczególności to,
  co wyjdzie przy uogólnianiu komponentu z 109.
- **C-50 / C-13** — `npm run build` musi przechodzić; nigdy z produkcyjnym połączeniem do bazy.
- **C-54 / C-55** — pytania zadano na tym etapie; dalsze etapy jadą na tych decyzjach.

## 8. Otwarte pytania / decyzje właściciela

Zadane i **rozstrzygnięte** w jednym wywołaniu na tym etapie (C-55):

- [x] **Układ panelu** → *„Pogrupowana wyrzutnia"*. `/admin` staje się miejscem startu: narzędzia
      w nazwanych grupach, każde z krótkim opisem. Narzędzia zachowują swoje dotychczasowe adresy,
      więc nie dokładamy żadnego przeskoku po drodze.
- [x] **Build, liczniki i sesja** → *„Osobny »Przegląd systemu«"*. Własna podstrona; wyrzutnia zostaje
      czysta, a jedenaście zapytań zliczających przestaje się wykonywać przy każdym wejściu do panelu.
- [x] **Wyszukiwarka** → *„Tak"*. Jedno pole nad grupami, ten sam mechanizm co w Ustawieniach.
- [x] **Powrót z narzędzia** → *„Okruszek »Panel administratora«"*. Bez listy bocznej — narzędzia mają
      szerokie tabele i edytory, a sam panel po zmianie jest szybki do przeszukania.

Założenia przyjęte samodzielnie (rozsądny domyślny, C-55) — do odnotowania, nie do pytania:

- **Podział na grupy** (decyzja produktowa, więc zapisana tutaj): *Przegląd* · *Dostęp
  i bezpieczeństwo* (uprawnienia, dziennik zmian) · *Diagnostyka* (stan systemu, metryki, kolejka
  zadań, wywołania modeli) · *AI i konfiguracja* (konfiguracja systemowa, modele LLM, pokrycie akcji
  przez AI, wiedza o użytkownikach) · *Treść i wygląd* (kategorie, skórki, raporty, biblioteka źródeł
  RSS, moderacja usług) · *Dokumentacja projektu* (dokumenty, audyt, podsumowanie audytu,
  architektura docelowa, struktura aplikacji, przewodnik po pipelinie) · *Narzędzia dewelopera*
  (galeria komponentów, testy klikacze, scenariusze QA, zgłoszenie błędu).
- **Kolejność grup** od najczęściej używanych do najrzadszych; *Przegląd* jako pierwsza pozycja.
- **`/admin` bez wpisanego narzędzia pokazuje wszystkie grupy** — panel jest odpowiedzią na „nie wiem,
  gdzie to jest", więc pełna lista musi być widoczna bez żadnego działania.

## 9. Ryzyka

- **Ryzyko: „przenieśliśmy" znaczy „zgubiliśmy".** Przy dwudziestu kilku pozycjach łatwo o cichy
  ubytek. → AC-3 wymaga pokrycia **każdej** istniejącej trasy `/admin/*`, sprawdzanego mechanicznie,
  a nie z listy przepisanej ręcznie; AC-10 wymienia z nazwy wszystkie dane przeglądu.
- **Ryzyko: nowa trasa bez kontroli dostępu.** Jedna chroniona strona zamienia się w dwie; pominięcie
  kontroli nie widać w interfejsie. → AC-5 sprawdza obie.
- **Ryzyko: uogólnienie komponentu z 109 „na siłę".** Wspólny komponent obsługujący dwa różne
  przypadki bywa gorszy od dwóch prostych. → decyzja w planie, po przeczytaniu obu stron; kryterium
  jest liczba warunków `if (wariant)`, a nie sama chęć reużycia (C-35, C-53).
- **Ryzyko: lista narzędzi rozjedzie się z rzeczywistością.** Dziś już się rozjechała — dwie trasy
  bez odnośnika. → AC-3 pilnuje tego automatycznie, więc następna nowa strona panelu bez wpisu
  zostanie wykryta, a nie odkryta po miesiącach.
- **Ryzyko: wyszukiwarka jako druga lista.** Osobny słownik fraz rozjechałby się z listą pozycji. →
  filtr musi czytać **tę samą** definicję, z której powstają grupy.
