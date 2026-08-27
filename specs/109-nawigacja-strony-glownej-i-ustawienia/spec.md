# Spec: Nawigacja Strony głównej i podział widoku Ustawień

- **ID:** 109-nawigacja-strony-glownej-i-ustawienia
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-27
- **Moduł(y):** powłoka aplikacji (menu boczne) + Ustawienia konta (`/settings`) — oba są elementami
  powłoki, nie modułami z rejestru `MODULES`

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Dwa zgłoszenia właściciela dotyczą tej samej rzeczy: **orientacji w powłoce aplikacji** — gdzie
jestem, dokąd wracam i jak trafiam do ustawienia, którego szukam.

1. **Wejście na Stronę główną jest zdublowane i nienazwane.** Na komputerze prowadzą tam dwa
   miejsca: nazwa aplikacji u góry panelu i mała ikona domu w rzędzie ikon konta. Żadne z nich nie
   mówi wprost „Strona główna": w nazwę aplikacji trzeba się domyślić kliknąć, a ikona domu stoi
   w rzędzie narzędzi konta (obok gwiazdki ulubionych i ściągawki skrótów), więc czyta się jak
   jedno z narzędzi, a nie jak pierwsza pozycja nawigacji. Właściciel opisał to jako „strona główna
   jest pod jakimś elementem, a nie na samej górze".
2. **`/settings` to jedna bardzo długa strona.** Trzynaście sekcji (profil, zespoły, menu,
   ulubione, Dysk, subskrypcja kalendarza, skórka, język i strefa, plan i zużycie AI, wiedza
   o użytkowniku, pomoc, prywatność, aktywność) leży jedna pod drugą w jednej kolumnie. Żeby dojść
   do czegokolwiek, trzeba przewijać i zgadywać, w którym miejscu to jest; nie da się też
   podlinkować ani zapisać w ulubionych pojedynczego ustawienia.

**Uwaga o stanie zastanym (C-54):** pierwsze zgłoszenie opisuje pozycję „Strona główna" na liście
modułów w menu — ta pozycja **została już usunięta** w przebiegu 087 i zastąpiona ikoną domu
w rzędzie ikon konta. Sedno zgłoszenia zostaje jednak aktualne: wejść wciąż są dwa i żadne nie jest
nazwaną, pierwszą pozycją nawigacji. Ten spec adresuje stan **dzisiejszy**, nie ten z chwili
zgłoszenia.

## 2. Cel i miary sukcesu

- **Cel:** w powłoce jest **jedno, nazwane i najwyżej postawione** wejście na Stronę główną, a
  Ustawienia dzielą się na krótkie, adresowalne sekcje z listą i wyszukiwarką.
- **Sukces mierzymy:**
  - powrót na Stronę główną z dowolnego widoku: **jedno kliknięcie w pozycję opisaną słowami**,
    stojącą jako pierwsza w nawigacji panelu bocznego; w całej powłoce (komputer) istnieje
    **dokładnie jedno** wejście na `/`;
  - dojście do dowolnego ustawienia: **najwyżej dwa kliknięcia** z `/settings` (albo jedno
    wpisanie frazy w wyszukiwarkę) i **bez przewijania** listy sekcji na komputerze;
  - każda sekcja ustawień ma **własny adres**, który da się podlinkować i zapisać w ulubionych.

## 3. Historyjki użytkownika

- Jako użytkownik na komputerze chcę **widzieć nazwane wejście „Strona główna" na samej górze
  nawigacji**, żeby wracać na pulpit bez domyślania się, że nazwa aplikacji jest odnośnikiem.
- Jako użytkownik chcę, żeby **nie było dwóch równorzędnych wejść w to samo miejsce**, bo dwa
  wejścia bez różnicy znaczeń każą się zastanawiać, czym się różnią.
- Jako użytkownik chcę **wejść w Ustawienia i zobaczyć spis sekcji**, żeby od razu wiedzieć, co tam
  w ogóle jest — zamiast przewijać wszystko po kolei.
- Jako użytkownik chcę **wpisać „skórka" albo „Drive" i trafić prosto do właściwej sekcji**, kiedy
  nie pamiętam, jak nazywa się miejsce, którego szukam.
- Jako użytkownik na telefonie chcę, żeby Ustawienia były **krótką listą pozycji**, a nie jednym
  długim zwojem — i żeby z otwartej sekcji był oczywisty powrót do spisu.
- Jako użytkownik chcę **zapisać adres jednej sekcji ustawień** (np. wyglądu), żeby wracać do niej
  jednym kliknięciem z ulubionych.

## 4. Kryteria akceptacji (testowalne)

### Strona główna w powłoce

- [ ] **AC-1** — Given zalogowany użytkownik na komputerze (szerokość ≥ 768 px), when otworzy
      dowolny widok, then w panelu bocznym **pierwszą pozycją nawigacji** jest wiersz opisany
      słowami „Strona główna" (ikona + tekst), stojący **nad wszystkimi modułami** i **nad rzędem
      ikon konta**.
- [ ] **AC-2** — Given ten sam widok, when policzymy w panelu bocznym elementy prowadzące na `/`,
      then jest ich **dokładnie jeden** — nazwa aplikacji nie jest już odnośnikiem, a w rzędzie ikon
      konta nie ma osobnej ikony domu.
- [ ] **AC-3** — Given użytkownik jest na `/`, when patrzy na panel boczny, then pozycja „Strona
      główna" jest wyróżniona jako bieżąca (stan aktywny czytelny także dla czytnika ekranu).
- [ ] **AC-4** — Given użytkownik jest na `/tasks`, when kliknie pozycję „Strona główna”, then
      trafia na `/` (jedno kliknięcie, bez otwierania żadnego panelu pośredniego).
- [ ] **AC-5** — Given telefon (szerokość < 768 px), when użytkownik korzysta z dolnego paska,
      then wejście na Stronę główną **nie zmienia się** względem stanu sprzed tej zmiany (kotwica
      paska kciuka zostaje nietknięta) i nadal jest dokładnie jedno.
- [ ] **AC-6** — Given użytkownik ma odebrane uprawnienie do Strony głównej, when otworzy panel
      boczny, then pozycja „Strona główna" zachowuje się jak każda inna zablokowana pozycja menu
      (wyszarzona/zablokowana), a nie prowadzi na `/`.

### Ustawienia — podział na sekcje

- [ ] **AC-7** — Given zalogowany użytkownik na komputerze, when otworzy `/settings`, then widzi
      **spis sekcji** mieszczący się na ekranie **bez przewijania** (a nie jedną kolumnę ze
      wszystkimi sekcjami po kolei), a po wejściu w sekcję spis **zostaje widoczny obok treści**
      jako lista, z której da się przeskoczyć do innej sekcji bez wracania do spisu.
      *(Uściślone na etapie planu — C-54: `/settings` jest spisem, lista boczna towarzyszy
      widokowi sekcji.)*
- [ ] **AC-8** — Given `/settings` na telefonie, when użytkownik otworzy widok, then widzi
      **wyłącznie listę sekcji** (krótkie pozycje z nazwą i jednozdaniowym opisem), a wejście
      w pozycję otwiera sekcję z **widocznym powrotem** do spisu.
- [ ] **AC-9** — Given dowolna sekcja ustawień, when użytkownik ją otworzy, then adres w pasku
      przeglądarki **wskazuje tę sekcję**, a wejście na ten adres wprost (nowa karta, zakładka,
      ulubione) otwiera od razu tę sekcję.
- [ ] **AC-10** — Given wszystkie sekcje dzisiejszej strony ustawień (profil i wylogowanie,
      zespoły, menu, ulubione widoki, Dysk Google, subskrypcja kalendarza, wygląd/skórka, język
      i strefa czasowa, plan i zużycie AI, wiedza o użytkowniku, pomoc i przewodniki, prywatność
      i dane, aktywność), when przejdziemy po nowych sekcjach, then **każda z nich jest osiągalna
      i działa tak samo jak przed zmianą** — żadna nie ginie i żadna nie traci funkcji.
- [ ] **AC-11** — Given istniejące odnośniki prowadzące dziś w konkretne miejsce ustawień (np.
      kotwica ulubionych widoków używana z innych miejsc aplikacji), when użytkownik w nie kliknie,
      then trafia do właściwej sekcji, a nie na pusty spis ani na błąd.
- [ ] **AC-12** — Given użytkownik otworzy sekcję ustawień, when strona się załaduje, then
      pobierane są dane **tej sekcji**, a nie wszystkich sekcji naraz (obserwowalnie: wejście
      w krótką sekcję nie czeka na najwolniejszą część ustawień).

### Ustawienia — wyszukiwarka

- [ ] **AC-13** — Given `/settings`, when użytkownik wpisze w pole szukania frazę odpowiadającą
      nazwie sekcji lub jej treści (np. „skórka", „Drive", „język", „prywatność"), then lista
      sekcji zawęża się do pasujących, a wybranie wyniku otwiera właściwą sekcję.
- [ ] **AC-14** — Given wpisana fraza bez trafień, when lista się zawęzi, then użytkownik widzi
      **stan pusty z wyjaśnieniem**, a nie pustą przestrzeń.
- [ ] **AC-15** — Given fraza wpisana bez polskich znaków diakrytycznych („jezyk", „prywatnosc"),
      when lista się filtruje, then sekcje z diakrytykami w nazwie **są znajdowane**.

### Rama i spójność

- [ ] **AC-16** — Given dowolny ekran ustawień, when się wyświetli, then korzysta ze **standardowej
      ramy widoku** aplikacji (nagłówek rysowany przez ramę, okruszki przy wejściu w sekcję, stany
      brzegowe przez ramę), a nie z ręcznie rysowanego nagłówka.
- [ ] **AC-17** — Given dowolna skórka wybrana przez użytkownika, when otworzy Ustawienia i panel
      boczny, then wszystkie kolory pochodzą ze zmiennych motywu (brak zaszytych wartości
      szesnastkowych w nowym kodzie).
- [ ] **AC-18** — Given telefon, when użytkownik przewinie ustawienia do końca, then treść nie
      chowa się pod dolnym paskiem ani pod obszarem gestów systemu.
- [ ] **AC-19** — Given cały nowy tekst widoczny dla użytkownika, when zostanie wyświetlony, then
      pochodzi ze słownika tłumaczeń (polski jako język źródłowy), a nie z literałów w komponentach.

## 5. Zakres

**W zakresie:**

- Przebudowa wejścia na Stronę główną w **panelu bocznym (komputer)**: nazwana pozycja jako
  pierwsza w nawigacji, usunięcie pozostałych wejść na `/` z panelu (odnośnik z nazwy aplikacji
  i ikona domu w rzędzie ikon konta).
- Podział `/settings` na **sekcje z własnymi adresami**, ze spisem sekcji: na komputerze obok
  treści, na telefonie jako osobny ekran-spis z powrotem.
- **Wyszukiwarka ustawień** nad spisem sekcji — filtrowanie po nazwie sekcji i po nazwach
  pozycji w niej, odporne na brak diakrytyków.
- Przeniesienie **wszystkich trzynastu dzisiejszych sekcji** bez utraty funkcji, wraz
  z zachowaniem działania istniejących odnośników w głąb ustawień.
- Wpięcie ekranów ustawień w **standardową ramę widoku** aplikacji (nagłówek, okruszki, stany
  brzegowe) zamiast ręcznie rysowanego nagłówka.
- Zachowanie zachowania na telefonie: dolny pasek kciuka, kotwica Strony głównej i obszar gestów
  bez regresji.

**Poza zakresem (świadomie):**

- **Zmiana treści samych ustawień** — nie dodajemy, nie usuwamy i nie przeprojektowujemy żadnego
  pojedynczego ustawienia; przenosimy je tam, gdzie mają być łatwiej znajdowane.
- **Ustawienia modułów** (np. Wiadomości) — mają własne, osobne miejsce w ramie widoku modułu
  i tu ich nie ruszamy.
- **Panel administracyjny `/admin`** — ma własną nawigację i nie jest przedmiotem tego zgłoszenia.
- **Strony zespołów** (`/settings/team/...`) — zostają tam, gdzie są; z nowego spisu prowadzi do
  nich sekcja zespołów.
- **Dolny pasek na telefonie i wachlarz nawigacji** — kotwica Strony głównej i kolejność ikon
  zostają nietknięte (to była decyzja przebiegów 100/103).
- **Wyszukiwarka globalna po całej aplikacji** — tu szukamy wyłącznie w obrębie ustawień.
- **Zmiana modelu uprawnień** — żadne ustawienie nie zmienia tego, kto je widzi.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowych slugów. Strona główna korzysta z istniejącego uprawnienia
  modułu Strony głównej i zachowuje dotychczasowe zachowanie przy jego braku (pozycja zablokowana
  jak każda inna). Ustawienia pozostają widokiem dla zalogowanego użytkownika, a widoczność
  poszczególnych sekcji nie zmienia się ani o krok — nowe adresy sekcji muszą być chronione
  dokładnie tak samo jak dzisiejsza jedna strona (C-22).
- **Własność danych:** brak nowych danych. Ustawienia, które dziś należą do użytkownika, zostają
  przy użytkowniku; te, które należą do przestrzeni (język i strefa), zostają przy przestrzeni —
  podział na sekcje niczego nie przenosi między właścicielami (C-21).
- **Asystent AI:** nie dotyczy — brak nowych akcji i narzędzi odczytu. (Jeśli asystent kieruje dziś
  użytkownika do ustawień odnośnikiem, ten odnośnik musi dalej działać — patrz AC-11.)
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Sekcja subskrypcji kalendarza zmienia tylko
  miejsce, nie zachowanie; nic nie jest kasowane, więc kosz nie wchodzi w grę.
- **Migracje bazy:** **brak** — cała zmiana jest w warstwie widoku i nawigacji.

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — reguła nadrzędna dla tego przebiegu. Zgłoszenia dotyczą rozmieszczenia,
  nie funkcji: przenosimy i porządkujemy, nie przepisujemy ustawień ani nie dokładamy abstrakcji.
- **C-33 (widok deklaruje się przez ramę)** — właściciel wybrał ujednolicenie ramy. Ustawienia
  przestają rysować własny nagłówek; jeśli rama czegoś nie umie (wielosekcyjny widok ze spisem),
  **poszerzamy ramę, nie robimy wyjątku** w Ustawieniach — wyjątek w jednym widoku wraca długiem
  w dwudziestu.
- **C-31 (mobile-first, keyboard-first)** — spis sekcji na telefonie to osobny ekran, nigdy dwa
  panele naraz; cele dotyku ≥ 44 px; treść respektuje obszar gestów. Panel boczny pozostaje
  `hidden md:flex`.
- **C-30 (motyw przez zmienne CSS)** — nowe elementy (spis sekcji, pole szukania, pozycja Strony
  głównej) biorą kolory ze zmiennych; żadnych zaszytych hexów, bo skórka ma je nadpisywać.
- **C-32 (teksty przez `t()`, polski źródłowy)** — nazwy sekcji, opisy w spisie, etykieta i stan
  pusty wyszukiwarki idą do słownika tłumaczeń.
- **C-22 (RBAC)** — rozbicie jednej strony na kilka adresów mnoży miejsca do obronienia: **każdy**
  nowy adres sekcji wymaga tej samej kontroli sesji co dzisiejsza strona. Rozdzielenie widoku bez
  rozdzielenia kontroli byłoby regresją bezpieczeństwa, a nie zmianą układu.
- **C-36 (granica `platform/` ↔ `modules/`)** — powłoka nie importuje wnętrza modułu; pozycja
  „Strona główna" w panelu bocznym bierze swoje dane stamtąd, skąd bierze je reszta menu, i **nie
  powstaje żadna nowa równoległa lista modułów**.
- **C-51 (lekcje)** — rozjazd „zgłoszenie opisuje stan sprzed 087" oraz wszystko, co wyjdzie przy
  dzieleniu długiej strony, ląduje w dzienniku doświadczeń.
- **C-50 / C-13 (definicja gotowe)** — `npm run build` musi przechodzić; weryfikujemy do kroku
  budowania, nigdy z produkcyjnym połączeniem do bazy.
- **C-54 / C-55 (spójność artefaktów, jeden moment pytań)** — pytania zadano na tym etapie; dalsze
  etapy jadą na tych decyzjach, a każde odkrycie zmieniające ten spec wraca tutaj.

## 8. Otwarte pytania / decyzje właściciela

Zadane i **rozstrzygnięte** w jednym wywołaniu na tym etapie (C-55):

- [x] **Wejście na Stronę główną** → *„Pełna pozycja na samej górze"*. „Strona główna" wraca jako
      pierwszy, pełny wiersz nawigacji (ikona + nazwa + stan aktywny), nad modułami i nad rzędem
      ikon konta. Ikona domu znika z rzędu ikon, a **nazwa aplikacji przestaje być odnośnikiem** —
      zostaje samą marką. Jedno nazwane wejście zamiast dwóch nienazwanych.
- [x] **Układ Ustawień** → *„Podstrony z listą sekcji"*. Każda sekcja dostaje własny adres; na
      komputerze lewa lista sekcji obok treści, na telefonie `/settings` jest spisem, a wejście
      w pozycję otwiera sekcję z powrotem.
- [x] **Wyszukiwarka ustawień** → *„Tak"*. Jedno pole nad spisem, filtrujące sekcje i pozycje.
- [x] **Rama widoku** → *„Tak, ujednolicić"*. Ustawienia korzystają ze standardowej ramy zamiast
      ręcznie rysowanego nagłówka.

Założenia przyjęte samodzielnie (rozsądny domyślny, C-55) — do odnotowania, nie do pytania:

- **Podział na sekcje idzie po dzisiejszych nagłówkach**, z połączeniem tych, które opisują to samo
  (menu i ulubione widoki → jedna sekcja o nawigacji; Dysk i subskrypcja kalendarza → jedna sekcja
  o połączeniach zewnętrznych; plan/zużycie AI i wiedza o użytkowniku → jedna sekcja o asystencie).
  Nic nie ginie; zmienia się wyłącznie grupowanie.
- **`/settings` bez wskazanej sekcji pokazuje spis** (a nie przekierowuje do pierwszej sekcji) —
  spis jest odpowiedzią na „nie wiem, gdzie to jest", więc musi być osiągalny sam w sobie.
- **Nazwa aplikacji zachowuje podpowiedź**, że aplikacja ma stronę główną, ale to pozycja
  nawigacji jest wejściem — marka nie konkuruje z nawigacją.
- **Kolejność sekcji** zaczyna się od najczęściej używanych (konto, wygląd, nawigacja), a kończy na
  rzadkich (aktywność, prywatność).

## 9. Ryzyka

- **Ryzyko: „przenieśliśmy" znaczy „zgubiliśmy".** Przy trzynastu sekcjach łatwo o cichy ubytek —
  sekcja widoczna tylko warunkowo (plan, język) może nie trafić nigdzie. → AC-10 wymienia
  wszystkie sekcje z nazwy; weryfikacja przechodzi po nich po kolei, także w wariancie, w którym
  sekcja warunkowa się nie pokazuje.
- **Ryzyko: martwe odnośniki w głąb ustawień.** Dziś w aplikacji istnieją odnośniki celujące
  w konkretne miejsce długiej strony; po podziale mogą prowadzić donikąd. → AC-11; przed zmianą
  trzeba wypisać wszystkie takie wejścia i przenieść je razem z sekcją.
- **Ryzyko: rozdzielenie widoku bez rozdzielenia kontroli dostępu.** Jedna chroniona strona zamienia
  się w kilka adresów; pominięcie kontroli na którymś z nich to luka, której nie widać w UI. →
  jawnie w C-22 powyżej i w kryteriach weryfikacji.
- **Ryzyko: usunięcie odnośnika z nazwy aplikacji zaskoczy przyzwyczajonego użytkownika.** Kliknięcie
  w logo to nawyk z innych aplikacji. → łagodzimy tym, że nazwana pozycja stoi bezpośrednio niżej
  i jest wyraźniejsza; właściciel wybrał ten wariant świadomie.
- **Ryzyko: rama widoku nie obsłuży układu ze spisem obok treści.** → jeśli tak, poszerzamy ramę
  (istniejący wariant układu wielopanelowego), nigdy nie robimy wyjątku w Ustawieniach (C-33).
- **Ryzyko: wyszukiwarka staje się drugą, rozjeżdżającą się listą sekcji.** Osobny słownik fraz
  szybko przestaje odpowiadać rzeczywistym sekcjom. → filtr musi czytać **tę samą** definicję
  sekcji, z której powstaje spis; żadnej równoległej listy.
