# Spec: Fala poprawek — bugi i UX (Zadania, Wiadomości, Pogoda, Asystent, powłoka)

- **ID:** 080-poprawki-bugow-ux
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-19
- **Moduł(y):** Tasks, News (Wiadomości), Weather (Pogoda), Home, Shopping (przez asystenta), powłoka
  (menu boczne + mobilne), skórki, ustawienia lektora (`/admin/llm`, `/settings`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Właściciel zgłosił dwanaście osobnych bolączek, które łączy jedno: **codzienne ścieżki w Omnii
zawodzą albo męczą**. Widok wielu projektów po zmianie statusu zadania pokazuje pustkę zamiast zadań.
Warstwy nakładane (popovery kosztów LLM, panel akcji zbiorczych) otwierają się poza ekranem, więc są
nieklikalne. Lektor milczy zamiast przejść na głos systemowy, a przy czytaniu strumienia strona
skacze góra-dół. Asystent nie potrafi dopisać stu pozycji do listy zakupów — kosztuje dwie tury po
~60 tys. tokenów i nie dowozi nic. Sekcja „Ulubione" spycha zwykłe pozycje menu poniżej pierwszego
ekranu. To nie są nowe funkcje: to obiecane rzeczy, które nie działają, i one podkopują zaufanie do
całego systemu bardziej niż brak jakiejkolwiek nowej funkcji.

## 2. Cel i miary sukcesu

- **Cel:** każda z dwunastu zgłoszonych ścieżek kończy się tym, czego użytkownik oczekiwał — bez
  pustego widoku, bez ciszy, bez warstwy poza ekranem i bez ręcznego objazdu.
- **Sukces mierzymy:**
  - Zmiana statusu zadania w widoku wielu projektów **nigdy** nie zeruje listy — zakres widoku
    przeżywa każdą mutację i każde odświeżenie.
  - Każda warstwa nakładana (popover/menu przyklejone do elementu) mieści się w oknie **przy każdej
    pozycji przycisku** — także gdy przycisk jest przy górnej i przy dolnej krawędzi.
  - Czytanie treści **zawsze wydaje dźwięk**: gdy lektor płatny odmawia, głos systemowy przejmuje
    czytanie bez akcji użytkownika i użytkownik wie, że to nastąpiło.
  - Zlecenie „dodaj ~100 pozycji do listy X" kończy się **kompletną** listą do zatwierdzenia w jednym
    przebiegu, bez komunikatu o wyczerpaniu kroków.
  - Wejście do modułu Pogoda **nie uruchamia** generowania AI — obserwatory czekają na kliknięcie.
  - Pozycje menu modułów są widoczne **od pierwszego ekranu**, bez przewijania przez ulubione.

## 3. Historyjki użytkownika

- Jako użytkownik Zadań chcę, żeby zaznaczanie wielu zadań **odsłaniało kolumnę zaznaczeń, a jej
  wyłączenie ją chowało**, żeby lista w trybie zwykłym była czysta i węższa.
- Jako użytkownik Zadań chcę, żeby panel akcji zbiorczych i jego okienka **mieściły się na ekranie i
  wyglądały spójnie na komputerze**, żeby dało się z nich skorzystać bez przewijania na ślepo.
- Jako użytkownik Zadań chcę **jednego widoku listy zadań z wyborem wielu projektów w filtrze** i
  możliwością **zapisania bieżącego wyboru jako nazwanego zestawu**, żeby nie utrzymywać dwóch
  równoległych, różnie wyglądających widoków.
- Jako użytkownik czytający treści chcę, żeby przy awarii płatnego lektora **czytał głos systemowy**,
  a jako administrator chcę móc **świadomie wybrać głos systemowy** jako obowiązujący.
- Jako czytelnik Wiadomości chcę, żeby nieudane pobranie lub streszczenie materiału **ponowiło się
  automatycznie** (do trzech prób), zanim zobaczę „Brak treści materiału".
- Jako użytkownik asystenta chcę **jednym poleceniem dopisać kilkadziesiąt pozycji** do listy
  zakupów i dostać do zatwierdzenia komplet, a nie komunikat o błędzie.
- Jako użytkownik dowolnego modułu chcę, żeby **każde okienko przyklejone do przycisku** otwierało
  się tam, gdzie się mieści.
- Jako użytkownik chcę **od razu widzieć pozycje menu modułów**, a ulubione mieć pod ręką, nie na
  drodze.
- Jako użytkownik strony głównej chcę **najpierw sekcję powitalną z podsumowaniem dnia**, a widget
  asystenta pod nią.
- Jako użytkownik chcę, żeby **opis skórki słowami kończył się skórką**, a nie komunikatem o braku
  poprawnych tokenów.
- Jako użytkownik Pogody chcę, żeby obserwatory **ładowały się leniwie i generowały na żądanie**, tak
  jak sekcja „Co robić?" — a nie kręciły spinnerem przy każdym wejściu.
- Jako słuchacz Wiadomości chcę **regulować prędkość czytania**, **decydować, czy widok podąża za
  lektorem**, i **widzieć, że tematy da się przełączać** — nie zgadywać, że istnieje gest.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** (Z1) — Given lista zadań z wyłączonym trybem zaznaczania wielu, when użytkownik
  włącza ten tryb, then kolumna zaznaczeń **pojawia się** przy każdym zadaniu; when wyłącza,
  then kolumna **znika w całości** (nie tylko przestaje reagować), a zaznaczenia są czyszczone.
- [ ] **AC-2** (Z2) — Given zaznaczone zadania i otwarty panel akcji zbiorczych na komputerze, when
  użytkownik otwiera okienko wyboru statusu lub daty, then całe okienko jest widoczne w oknie
  przeglądarki (żadna krawędź nie wychodzi poza widok) niezależnie od pozycji przewinięcia strony.
- [ ] **AC-3** (Z2) — Given widok na komputerze, when panel akcji zbiorczych jest widoczny, then nie
  rozciąga się na całą szerokość okna, lecz jest wyśrodkowany i ograniczony szerokością, spójnie
  z resztą chromu aplikacji; na mobile zachowuje dotychczasowe zachowanie i bezpieczny margines dolny.
- [ ] **AC-4** (Z3, regresja) — Given widok listy zadań z zakresem wielu projektów, when użytkownik
  zmieni status dowolnego zadania, then widok **nadal pokazuje ten sam zakres projektów i ich
  zadania** (nigdy „0 projektów"/pusta lista), a zmieniony status jest widoczny.
- [ ] **AC-5** (Z3, unifikacja) — Given widok listy zadań, when użytkownik otwiera filtr projektów,
  then może zaznaczyć **wiele projektów naraz**, a widok pokazuje zadania z zaznaczonych projektów;
  when zapisze bieżący wybór pod nazwą, then ten zestaw jest później dostępny do jednorazowego
  wybrania i przywraca dokładnie te projekty.
- [ ] **AC-6** (Z3, zgodność) — Given istniejące zapisane grupy projektów i istniejące adresy
  widoków (w tym zapisane ulubione widoki właściciela), when użytkownik z nich korzysta po zmianie,
  then otwierają ten sam zakres zadań co przed zmianą — żaden zapisany widok nie przestaje działać.
- [ ] **AC-7** (Z3, spójność) — Given widok pojedynczego projektu i widok wielu projektów, when
  użytkownik je porówna, then mają **ten sam układ nagłówka, te same ikony i te same akcje** —
  różnią się wyłącznie zakresem i nazwą.
- [ ] **AC-8** (Z4) — Given skonfigurowany płatny lektor, który przy próbie czytania zwraca błąd
  (klucz, model, limit, awaria), when użytkownik uruchamia czytanie, then treść jest czytana
  **głosem systemowym przeglądarki**, a użytkownik widzi jednorazową, nieblokującą informację, że
  nastąpiło przejście na głos zapasowy.
- [ ] **AC-9** (Z4) — Given panel administratora, when administrator konfiguruje lektora, then może
  **wybrać głos systemowy jako obowiązujący** (bez dostawcy płatnego) i zapisać ten wybór; wybór
  jest respektowany w aplikacji.
- [ ] **AC-10** (Z4, diagnostyka) — Given nieudana próbka głosu w panelu administratora, when
  administrator ją odsłucha, then komunikat wskazuje **rzeczywistą przyczynę** odmowy (np. odrzucony
  klucz, nieznany model, przekroczony limit), a nie zawsze ten sam tekst o kluczu API.
- [ ] **AC-11** (Z5) — Given materiał, którego pobranie treści albo streszczenie się nie udało, when
  system go przetwarza, then ponawia próbę **do trzech razy** (z odstępem), a „Brak treści materiału"
  pokazuje się dopiero po wyczerpaniu prób.
- [ ] **AC-12** (Z6) — Given polecenie dodania kilkudziesięciu (≥60) pozycji do wskazanej listy
  zakupów, when asystent je realizuje, then w **jednym przebiegu** przedstawia do zatwierdzenia
  **komplet** pozycji (z ilościami i jednostkami rozpoznanymi z tekstu), bez komunikatu o
  wyczerpaniu kroków i bez gubienia pozycji.
- [ ] **AC-13** (Z6) — Given zatwierdzony plan z kilkudziesięcioma pozycjami, when użytkownik go
  uruchomi, then wszystkie pozycje trafiają na listę, a wynik podaje ich liczbę.
- [ ] **AC-14** (Z7) — Given dowolne okienko przyklejone do przycisku (podsumowanie kosztów LLM, menu
  akcji, wybór ikony, dzwonek powiadomień, menu asystenta), when przycisk znajduje się blisko górnej
  albo dolnej krawędzi okna, then okienko **odwraca stronę otwierania i/lub przesuwa się**, żeby
  zmieścić się w widoku; nigdy nie wychodzi poza ekran.
- [ ] **AC-15** (Z7) — Given te okienka, when porówna się ich zachowanie, then wszystkie korzystają
  z **jednego wspólnego rozwiązania** (zamykanie klawiszem Esc, zamykanie kliknięciem poza obszarem,
  ta sama warstwa nad treścią) — bez osobnych, rozjeżdżających się implementacji.
- [ ] **AC-16** (Z8) — Given menu boczne na komputerze z co najmniej jednym ulubionym widokiem, when
  użytkownik wchodzi do aplikacji, then sekcja ulubionych jest **zwinięta do jednego wiersza z
  licznikiem**, a pozycje modułów są widoczne bez przewijania; when użytkownik ją rozwinie, then
  wybór jest **zapamiętany** i utrzymuje się po odświeżeniu i na kolejnych stronach.
- [ ] **AC-17** (Z8) — Given menu na urządzeniu mobilnym, when użytkownik je otwiera, then obowiązuje
  ten sam wzorzec (zwinięte ulubione, moduły od razu widoczne), z zachowaniem minimalnych celów
  dotyku i bezpiecznego marginesu dolnego.
- [ ] **AC-18** (Z9) — Given strona główna z domyślną kolejnością sekcji, when użytkownik ją otwiera,
  then sekcja powitalna („Dzień dobry…") jest **pierwsza**, a widget asystenta znajduje się
  **bezpośrednio po niej**; when użytkownik ma własną kolejność sekcji, then jego ustawienie jest
  respektowane (zmiana dotyczy domyślnej kolejności, nie nadpisuje personalizacji).
- [ ] **AC-19** (Z10) — Given opis skórki słowami, w tym opis odwołujący się do motywu kulturowego
  (np. „kosmiczna saga Star Trek"), when użytkownik zleci wygenerowanie, then otrzymuje **propozycję
  skórki** z poprawnymi wartościami; komunikat o braku poprawnych tokenów pojawia się tylko wtedy,
  gdy po ponowieniu naprawdę nic sensownego nie wróciło, i wtedy mówi, **czego** zabrakło.
- [ ] **AC-20** (Z11) — Given wejście do modułu Pogoda, when strona się ładuje, then sekcja
  obserwatorów **nie uruchamia generowania AI** i nie pokazuje nieskończonego spinnera — pokazuje
  stan „czeka na kliknięcie" z wyraźnym przyciskiem; when użytkownik kliknie, then obserwatory są
  wyliczane i wynik zostaje zapamiętany (kolejne wejście pokazuje zapamiętany wynik, ewentualnie
  z oznaczeniem nieaktualności).
- [ ] **AC-21** (Z11) — Given zapamiętany wynik obserwatorów, when zmienią się warunki, na których
  powstał, then wynik jest oznaczony jako nieaktualny, a odświeżenie następuje **wyłącznie po
  kliknięciu** (chyba że użytkownik ustawił inny tryb odświeżania sekcji AI).
- [ ] **AC-22** (Z12) — Given lektor Wiadomości, when użytkownik go używa, then ma w jednym,
  stale widocznym pasku: odtwarzanie/pauzę, przejście do poprzedniej i następnej wiadomości oraz
  **regulację prędkości**; wybrana prędkość jest **zapamiętana** między sesjami.
- [ ] **AC-23** (Z12) — Given czytanie całego strumienia z wyłączonym „podążaj za czytaniem", when
  lektor przechodzi do kolejnej wiadomości, then widok **nie przewija się sam**; when przełącznik
  jest włączony, then widok przewija do czytanej wiadomości **i tam zostaje** (bez powrotu do góry).
- [ ] **AC-24** (Z12) — Given lista tematów, when użytkownik chce zmienić temat, then ma **widoczny
  element sterujący** (strzałki/przyciski poprzedni–następny) obok nazwy tematu; gest przesunięcia
  nadal działa, ale z **łagodniejszym progiem** i nie jest jedyną drogą.

## 5. Zakres

**W zakresie:**
- Z1 — kolumna zaznaczeń pojawia się i znika razem z trybem zaznaczania wielu.
- Z2 — okienka panelu akcji zbiorczych mieszczą się w oknie; sam panel dostaje sensowny układ na
  komputerze (wyśrodkowany, ograniczony szerokością).
- Z3 — naprawa regresji „pusty widok po zmianie statusu" **oraz** ujednolicenie: jeden widok listy
  zadań z wyborem wielu projektów w filtrze i zapisywalnymi zestawami projektów; dotychczasowe
  zapisane grupy i adresy działają dalej.
- Z4 — automatyczne, płynne przejście na głos systemowy przy odmowie płatnego lektora; możliwość
  wskazania głosu systemowego przez administratora; prawdziwa przyczyna błędu w komunikacie próbki.
- Z5 — do trzech ponowień przy nieudanym pobraniu treści lub streszczeniu materiału.
- Z6 — obsługa dużych zleceń wsadowych w asystencie (dopisanie kilkudziesięciu pozycji do listy
  zakupów w jednym przebiegu).
- Z7 — jedno wspólne rozwiązanie dla warstw przyklejonych do elementu, wpięte we **wszystkie**
  dzisiejsze miejsca tego typu.
- Z8 — zwijana, domyślnie zwinięta sekcja ulubionych z zapamiętanym stanem (komputer i mobile).
- Z9 — domyślna kolejność sekcji strony głównej: powitanie, potem widget asystenta.
- Z10 — generowanie skórki z opisu kończy się skórką również dla opisów motywów kulturowych.
- Z11 — obserwatory pogody ładowane leniwie i generowane na żądanie, zgodnie z istniejącym wzorcem
  sekcji AI (pamięć treści + tryb odświeżania).
- Z12 — pasek sterowania lektorem (prędkość, nawigacja), wyłączalne podążanie widoku za czytaniem,
  widoczne przełączanie tematów i łagodniejszy próg gestu.
- Wpis do dziennika doświadczeń dla każdej naprawionej, nieoczywistej przyczyny (C-51).

**Poza zakresem (świadomie):**
- **Z13 — wspólny mechanizm „grupy zasobów" dla wszystkich modułów.** To zmiana obejmująca 21
  modułów, schemat bazy i wzorzec UX każdego widoku listy; wymaga własnego speca, własnej tabeli
  prawdy dla dostępu i własnego przebiegu pipeline'u. Wpięcie jej w falę poprawek zamieniłoby
  krótką, weryfikowalną zmianę w wielotygodniową przebudowę i uniemożliwiło sensowną recenzję.
  **Decyzja właściciela: osobny spec.** Widok zadań z tej fali (AC-5) jest tego mechanizmu
  pierwszym, lokalnym przymiarem — zapisany zestaw projektów to dokładnie „grupa zasobów" w jednym
  module, więc ta fala dostarcza materiału dowodowego dla przyszłego uogólnienia.
- **Z14 — bramka spójności wyglądu layoutu i komponentów oparta o galerię komponentów.** Nowa
  bramka builda to samodzielna zmiana procesowa (co dokładnie mierzymy, jaki próg, jak nie zrobić
  z niej zapadki, którą się wyłącza) — **osobny spec.** Ta fala **nie** dokłada długu: nowy wspólny
  komponent warstwy (Z7) ma trafić do galerii komponentów razem z pierwszym konsumentem (C-35), co
  przyszłej bramce da czym mierzyć.
- Zmiana adresów tras Zadań (pełne scalenie `/tasks/multi` z `/tasks/<projekt>`) — odrzucona przez
  właściciela: łamałaby zapisane ulubione widoki.
- Przebudowa lektora w osobny ekran pełnoekranowy — odrzucona przez właściciela.
- Optymalizacja kosztów asystenta poza tym, co wynika z naprawy Z6.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — żaden nowy slug `module.*`. Wszystkie zmiany dotyczą modułów,
  które już mają swoje uprawnienia (`module.tasks`, `module.news`, `module.weather`, `module.home`,
  `module.shopping`) oraz powierzchni administracyjnej (`module.admin`) i ustawień. Wybór głosu
  systemowego przez administratora to zmiana konfiguracji — podlega audytowi (C-25).
- **Własność danych:** nowe dane w tej fali są **wyłącznie osobiste** (per użytkownik): zapamiętany
  stan zwinięcia ulubionych, wybrana prędkość lektora, przełącznik podążania za czytaniem. Zapisane
  zestawy projektów **dziedziczą dotychczasową własność grup projektów** — nie zmieniamy jej przy
  okazji (C-53). Zapamiętana treść obserwatorów pogody należy do przestrzeni tak samo jak pozostałe
  zapamiętane treści AI.
- **Asystent AI:** **tak** — Z6 wymaga umożliwienia asystentowi dopisania wielu pozycji zakupowych
  w jednym kroku planu zamiast jednej akcji na pozycję. Każda nowa akcja asystenta musi mieć
  egzekutor, wpis w kontrakcie akcji i klasyfikację pokrycia (C-23). Z11 zmienia sposób
  generowania treści AI obserwatorów (pamięć treści + tryb na żądanie), nie dokłada akcji.
- **Kalendarz / powiadomienia / trash:** nie dotyczy — żaden element tej fali nie tworzy zdarzeń
  agendy, powiadomień ani zasobów usuwalnych. Zapisane zestawy projektów kasują się dokładnie tak,
  jak dziś kasują się grupy projektów (bez zmiany zachowania kosza).

## 7. Zgodność z konstytucją

- **C-53 (minimalizm)** — reguła nadrzędna dla całej fali: to naprawy, nie okazja do refaktorów.
  Dwie decyzje właściciela (Z13, Z14 poza zakresem) są bezpośrednim zastosowaniem tej reguły.
- **C-35 (wspólny komponent razem z pierwszym konsumentem)** — kluczowa dla Z7: nowy komponent
  warstwy przyklejonej ma być **wpięty we wszystkie dzisiejsze miejsca**, a nie tylko istnieć.
  Komponent bez konsumentów byłby gorszy niż jego brak.
- **C-33 (widok deklaruje się przez `ModuleView`)** — dotyczy Z3 (AC-7: wspólny nagłówek i ikony) i
  Z11 (stany brzegowe, w tym „czeka na kliknięcie", idą przez kontrakt widoku, nie rysowane ręcznie).
- **C-30 (motyw przez zmienne CSS)** i **C-31 (mobile-first, keyboard-first)** — dotyczą każdej
  zmiany UI w tej fali: Z2, Z7, Z8, Z12 muszą działać na mobile i respektować skórki; nowa warstwa
  (Z7) i pasek lektora (Z12) muszą dać się zamknąć/obsłużyć klawiaturą.
- **C-32 (teksty przez `t()`, polski jako źródło)** — wszystkie nowe teksty (etykiety paska lektora,
  licznik ulubionych, komunikat o przejściu na głos zapasowy, przyczyny błędu próbki).
- **C-20 (mutacje przez Server Actions z `revalidatePath`)** — dotyczy Z3: naprawa nie może polegać
  na ręcznej inwalidacji obok akcji.
- **C-23 (każda akcja asystenta ma egzekutor)** — dotyczy Z6.
- **C-40 (routing modeli DB-driven)** — dotyczy Z4 i Z10: wybór głosu systemowego i zachowanie przy
  odmowie modelu nie mogą hardkodować dostawcy w kodzie funkcji.
- **C-41 (klucze szyfrowane i maskowane)** — dotyczy Z4/AC-10: komunikat o rzeczywistej przyczynie
  odmowy **nie może** ujawnić klucza ani jego fragmentu.
- **C-10..C-14 (migracje)** — jeżeli zapamiętanie preferencji (prędkość lektora, zwinięcie
  ulubionych) albo zapisane zestawy projektów wymagają nowych kolumn, idą **ręcznie napisaną**
  migracją SQL z unikalnym numerem, bez enumów Prisma.
- **C-51 (dziennik doświadczeń)** — obowiązkowe dla Z3, Z4, Z6, Z7, Z10, Z11: to bugi o
  nieoczywistych przyczynach.
- **C-50 (definicja „gotowe")** — `npm run build` zielony, przy czym weryfikacja lokalna kończy się
  na `next build` (C-13 — żadnych migracji przeciw produkcyjnej bazie).
- **C-54 (spójność artefaktów)** — jeśli implementacja pokaże, że któreś kryterium jest błędne albo
  niewykonalne w tej fali, poprawiamy spec i plan, a nie obchodzimy problem w kodzie.

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jednym momencie pytań (C-55). **Wszystkie odpowiedzi = wariant rekomendowany.**

- [x] **Zakres fali** → *Z1–Z12 teraz; Z13 i Z14 jako osobne speki.* Wypisane w „poza zakresem"
  z uzasadnieniem — żadne zgłoszenie nie ginie.
- [x] **Z3 — jak daleko z ujednoliceniem widoków Zadań** → *najpierw naprawa regresji, potem jeden
  widok z wyborem wielu projektów w filtrze; dzisiejsze grupy projektów stają się zapisanymi
  zestawami w tym filtrze. Adresy i zapisane widoki działają dalej; bez migracji danych.*
- [x] **Z8 — jak zmieścić ulubione w menu** → *zwijana sekcja, domyślnie zwinięta, jeden wiersz
  z licznikiem, stan zapamiętany per użytkownik; ten sam wzorzec na mobile.*
- [x] **Z12 — wariant UX lektora** → *stały pasek sterowania (odtwarzanie, poprzednia/następna,
  suwak prędkości zapamiętywany), wyłączalne „podążaj za czytaniem", widoczne strzałki zmiany
  tematu, gest zostaje jako skrót z łagodniejszym progiem.*

**Założenia przyjęte samodzielnie (rozsądne domyślne, do odnotowania):**
- **Z9** — zmieniamy **domyślną** kolejność sekcji strony głównej; użytkownik, który ma własną
  kolejność, zachowuje ją (personalizacja jest ważniejsza niż nowe domyślne).
- **Z5** — trzy próby liczone łącznie dla pobrania treści i dla streszczenia, z odstępem między
  próbami; wyczerpanie prób daje dotychczasowy komunikat, nie nowy stan błędu.
- **Z6** — plan asystenta z dziesiątkami pozycji ma powstać w jednym kroku (jedna akcja dla wielu
  pozycji), a nie przez zwiększanie liczby kroków pętli — zwiększanie kroków mnoży koszt, którego
  właściciel już raz zapłacił dwa razy bez efektu.
- **Z4** — przejście na głos systemowy jest **automatyczne i ciche w skutkach** (czytanie rusza),
  ale **widoczne w komunikacie** — użytkownik musi wiedzieć, dlaczego głos brzmi inaczej.
- **Z11** — obserwatory idą dokładnie tym samym wzorcem, co pozostałe sekcje AI (pamięć treści,
  tryb odświeżania, oznaczenie nieaktualności) — nie wymyślamy dla nich osobnego mechanizmu.

## 9. Ryzyka

- **Ujednolicenie widoków Zadań (Z3) może zepsuć zapisane widoki właściciela** → AC-6 czyni
  zgodność wstecz kryterium akceptacji; stare adresy muszą działać, a zapisane grupy nie podlegają
  migracji danych.
- **Wspólny komponent warstwy (Z7) dotyka wielu modułów naraz** → ryzyko regresji w miejscach, które
  dziś działają. Ograniczamy je zasadą, że komponent odtwarza dotychczasowe zachowanie (zamykanie,
  warstwa, wygląd) i różni się **wyłącznie** mieszczeniem się w oknie; każde wpięte miejsce
  sprawdzamy z osobna.
- **Naprawa Z6 może podnieść koszt pojedynczego zapytania** (dłuższa odpowiedź modelu) → mierzymy
  efekt na zgłoszonym przypadku: dzisiejszy stan to dwie tury po ~60 tys. tokenów **bez wyniku**,
  więc punktem odniesienia jest „koszt za dostarczoną listę", nie „koszt tury".
- **Zwinięte ulubione (Z8) mogą zostać odebrane jako utrata funkcji** → stan zwinięcia jest
  zapamiętywany, więc kto raz rozwinie, ma je rozwinięte na stałe; licznik w zwiniętym wierszu
  utrzymuje ich widoczność.
- **Przyczyna Z10 może leżeć po stronie modelu, nie kodu** → wtedy naprawa polega na ponowieniu
  i na uczciwym komunikacie (AC-19 jest tak sformułowane, żeby dało się je spełnić w obu wypadkach),
  a nie na obietnicy, że model zawsze odpowie poprawnie.
- **Diagnostyka błędu lektora (Z4/AC-10) może kusić do zalogowania odpowiedzi dostawcy** → C-41:
  komunikat opisuje rodzaj odmowy, nigdy nie zawiera klucza ani surowej odpowiedzi z kluczem.
