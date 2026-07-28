# Spec: Asystent — dopracowanie UX na telefonie i komputerze + audyt zużycia tokenów

- **ID:** 035-asystent-ux-mobile-i-audyt-tokenow
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-07-28
- **Moduł(y):** Home / Asystent AI (okno czatu, ustawienia poziomu pracy, wskaźnik kosztu), Raporty (dokument dla admina)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Poprzednie wdrożenie (034) dało asystentowi własny poziom pracy i rzetelne koszty, ale sposób podania
tych rzeczy na ekranie okazał się słaby — szczególnie na telefonie. Ustawienia własnego poziomu
wylądowały w środku ustawień asystenta, gdzie nie da się ich przewinąć (widać tylko pierwszy z czterech
rodzajów działań), a otwierający je suwak niczego sensownego nie robi. Panel szczegółów kosztu wychodzi
poza ekran. Do tego dwa błędy dotykowe: klawiatura ekranowa **nie znika** przy kliknięciu w cokolwiek
innego (zabiera pół ekranu dokładnie wtedy, gdy przeglądasz koszty albo poziomy), a na iPhonie kursor
po kliknięciu w pole wiadomości pojawia się w złym miejscu i naprawia się dopiero po rozpoczęciu
pisania. Osobno: odpowiedź na samo „hej" kosztowała **7734 tokeny** w trzech wywołaniach modelu, co
jest rażąco nieadekwatne i wymaga rzetelnego wyjaśnienia, zanim cokolwiek zoptymalizujemy.

## 2. Cel i miary sukcesu

- **Cel:** okno asystenta, które na telefonie i na komputerze zachowuje się przewidywalnie — nic nie
  wychodzi poza ekran, wszystko da się przewinąć, klawiatura ustępuje, gdy zajmujesz się czymś innym —
  oraz **udokumentowana, sprawdzalna odpowiedź** na pytanie, dokąd idą tokeny przy trywialnym poleceniu.
- **Sukces mierzymy:**
  - żaden element okna asystenta nie wychodzi poza szerokość ekranu przy 320 px,
  - każdą sekcję nagłówka da się przewinąć do końca na telefonie,
  - kliknięcie w cokolwiek poza polem tekstowym chowa klawiaturę ekranową,
  - kursor po kliknięciu w pole wiadomości stoi od razu we właściwym miejscu (bez „poprawiania się"
    po pierwszym znaku),
  - z raportu da się **odtworzyć co do znaku**, co poszło do modelu przy poleceniu „hej" i policzyć,
    skąd wzięła się każda składowa z 7734 tokenów.

## 3. Historyjki użytkownika

- Jako użytkownik telefonu chcę, żeby klawiatura znikała, gdy dotykam czegokolwiek poza polem
  wiadomości, żeby mieć miejsce na to, co właśnie oglądam.
- Jako użytkownik iPhone'a chcę, żeby kursor po kliknięciu w pole od razu stał tam, gdzie będę pisać.
- Jako użytkownik chcę otworzyć konfigurację własnego poziomu **z miejsca, w którym ten poziom wybieram**,
  a nie szukać jej w ustawieniach asystenta.
- Jako użytkownik chcę ustawić model dla **każdego** rodzaju działania, a nie tylko dla pierwszego,
  który zmieścił się na ekranie.
- Jako użytkownik chcę widzieć całe rozbicie kosztu — także wtedy, gdy odpowiedź była krótka albo
  jestem na wąskim telefonie.
- Jako użytkownik chcę móc odrzucić skrót „wróć do poprzedniej rozmowy", gdy nie zamierzam wracać.
- Jako właściciel systemu chcę **dokument**, z którego zrozumiem, dlaczego „hej" kosztuje 7734 tokeny,
  i który da mi konkretne propozycje — żebym mógł **sam zdecydować**, co wdrażamy.

## 4. Kryteria akceptacji (testowalne)

**Własny poziom pracy (Z1)**

- [ ] **AC-1** — Given jestem w ustawieniach asystenta, when je otwieram, then **nie ma tam** suwaka
      „jak dokładnie ma pracować asystent" ani ustawień per rodzaj działania.
- [ ] **AC-2** — Given rozwijam menu wyboru poziomu pracy, when patrzę na pozycję „Własny", then przy
      jej prawej krawędzi jest ikona otwierająca konfigurację tego poziomu.
- [ ] **AC-3** — Given klikam tę ikonę, when otwiera się konfiguracja, then zajmuje ona obszar wątku
      (zasłania rozmowę) i **da się ją przewinąć w pionie do samego końca** — widoczne są wszystkie
      rodzaje działań, nie tylko pierwszy.
- [ ] **AC-4** — Given otwieram konfigurację po raz pierwszy, when patrzę na pola wyboru modelu, then
      **nie ma** pozycji „Jak u administratora" — pola są wstępnie ustawione na wartości z poziomu
      standardowego, a ja mogę je zmienić.
- [ ] **AC-5** — Given jestem na telefonie o szerokości 320 px, when konfiguruję własny poziom, then
      wszystkie kontrolki mieszczą się w szerokości ekranu i nie ma przewijania w poziomie.

**Szczegóły kosztu (Z2)**

- [ ] **AC-6** — Given jestem na telefonie, when rozwijam szczegóły kosztu, then panel nie wychodzi
      poza ekran **ani z lewej, ani z prawej strony**.
- [ ] **AC-7** — Given panel nie mieści się w dostępnej szerokości, when go oglądam, then jego
      zawartość da się przewinąć w poziomie **wewnątrz panelu**, a strona pod spodem się nie przesuwa.
- [ ] **AC-8** — Given odpowiedź asystenta jest krótka i kwota kosztu wypada blisko lewej krawędzi
      okna, when rozwijam panel, then otwiera się on w stronę, po której jest miejsce, i **cała jego
      zawartość jest widoczna** (żadna krawędź nie jest ucięta).

**Klawiatura i kursor na telefonie (Z3, Z4)**

- [ ] **AC-9** — Given piszę wiadomość i klawiatura jest otwarta, when dotykam dowolnego przycisku
      poza polem tekstowym (aparat, zdjęcie, poziom pracy, mikrofon, ikony nagłówka), then klawiatura
      się chowa, a akcja przycisku wykonuje się **za pierwszym dotknięciem**.
- [ ] **AC-10** — Given menu poziomu pracy jest rozwinięte, when na nie patrzę, then nie ma potrzeby
      ukrywania kursora pola tekstowego — pole nie ma fokusu, więc kursor nie istnieje.
- [ ] **AC-11** — Given jestem na iPhonie, when klikam w puste pole wiadomości, then kursor pojawia się
      **od razu wewnątrz pola, we właściwej wysokości** — nie nad nim i nie poniżej, i nie zmienia
      położenia po wpisaniu pierwszego znaku.
- [ ] **AC-12** — Given klawiatura jest zamknięta, when patrzę na dół okna asystenta, then pole
      wiadomości nie jest przesłonięte systemową kreską iPhone'a.

**Sekcje nagłówka (Z5)**

- [ ] **AC-13** — Given otwieram ustawienia asystenta albo zgłoszenie problemu, when sekcja jest
      widoczna, then **zasłania wątek rozmowy** (tak jak robi to historia), zamiast wciskać się nad nim.
- [ ] **AC-14** — Given otwarta sekcja ma więcej treści niż mieści ekran, when ją przewijam, then
      przewija się do końca (żadna treść nie jest nieosiągalna).
- [ ] **AC-15** — Given zamykam sekcję, when wracam do rozmowy, then widzę wątek w tym samym stanie,
      w jakim go zostawiłem.

**Skrót powrotu (Z6)**

- [ ] **AC-16** — Given widzę skrót „wróć do poprzedniej rozmowy", when klikam „×" na nim, then skrót
      znika i nie zajmuje już miejsca, a sama rozmowa **pozostaje dostępna w historii**.
- [ ] **AC-17** — Given skrót jest widoczny, when wysyłam pierwszą wiadomość w nowym wątku, then skrót
      znika sam (bez klikania).

**Audyt tokenów (Z7)**

- [ ] **AC-18** — Given otwieram raporty administratora, when szukam dokumentu o zużyciu tokenów, then
      istnieje raport opisujący przebieg polecenia „hej".
- [ ] **AC-19** — Given czytam ten raport, when patrzę na każde z trzech wywołań modelu
      (klasyfikator / router / agent), then znajduję **pełną treść promptu i pełną treść odpowiedzi**
      dla każdego z nich.
- [ ] **AC-20** — Given raport podaje liczby tokenów, when je sumuję, then zgadzają się z 7734 tokenami
      ze zgłoszenia, a każda składowa ma wyjaśnione pochodzenie (w tym 5284 tokeny zapisu do pamięci
      podręcznej).
- [ ] **AC-21** — Given czytam sekcję wniosków, when szukam propozycji, then każda ma opisany
      spodziewany zysk, ryzyko i to, czego dotyka — na tyle konkretnie, żeby dało się ją zatwierdzić
      lub odrzucić bez dopytywania.
- [ ] **AC-22** — Given wdrożenie się zakończyło, when korzystam z asystenta, then jego **zachowanie
      i koszty są takie jak przed zmianą** — żadna optymalizacja z raportu nie została wdrożona.

## 5. Zakres

**W zakresie:**

- Z1 — usunięcie suwaka, wyniesienie konfiguracji własnego poziomu do osobnego, przewijalnego widoku
  otwieranego ikoną przy pozycji „Własny", wstępne wypełnienie pól wartościami poziomu standardowego.
- Z2 — panel kosztu mieszczący się w oknie na telefonie i komputerze, z przewijaniem poziomym w środku
  i samodzielnym doborem strony rozwinięcia.
- Z3 — wycofanie wymuszania fokusu w polu tekstowym; klawiatura chowa się przy dotknięciu czegokolwiek
  innego.
- Z4 — naprawa pozycji kursora na iPhonie wraz z wyjaśnieniem przyczyny.
- Z5 — sekcje nagłówka (ustawienia, zgłoszenie problemu, konfiguracja poziomu) zasłaniają wątek i są
  przewijalne, jak historia.
- Z6 — możliwość odrzucenia skrótu powrotu + automatyczne znikanie po pierwszej wiadomości.
- Z7 — **analiza i dokument** dla administratora: pełne prompty i odpowiedzi trzech wywołań, rozliczenie
  tokenów, przyczyny, propozycje optymalizacji.

**Poza zakresem (świadomie):**

- **Wdrażanie jakichkolwiek optymalizacji tokenów** — decyzja właściciela po lekturze raportu.
  Dotyczy to również oczywistej straty na pamięci podręcznej promptu (zapis bez odczytu): opisujemy ją
  w raporcie, ale **nie zmieniamy**.
- Zmiany w konfiguracji poziomów po stronie administratora (`/admin/llm`) — 034 zostaje bez zmian.
- Przeprojektowanie całego okna asystenta ponad wypunktowane zgłoszenia.
- Pokazywanie kosztów w innych modułach (wspólny komponent istnieje od 034, ale nadal go tam nie wpinamy).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez nowego sluga. Raport z audytu to **raport systemowy** widoczny w
  `/reports` (moduł raportów jest dostępny dla zalogowanych; treść jest techniczna i adresowana do
  administratora). Konfiguracja własnego poziomu — każdy zalogowany, przy swoim koncie.
- **Własność danych:** bez zmian. Ustawienia własnego poziomu pozostają per użytkownik; odrzucenie
  skrótu powrotu to stan widoku, nie dane trwałe.
- **Asystent AI:** bez nowych akcji i bez nowych narzędzi odczytu. **Zachowanie modelu ma pozostać
  nietknięte** (AC-22) — zmiany dotyczą wyłącznie warstwy prezentacji.
- **Kalendarz / powiadomienia / trash:** nie dotyczy.

## 7. Zgodność z konstytucją

- **C-10, C-14** — raport trafia do bazy **idempotentną migracją SQL** z dollar-quotingiem i
  `ON CONFLICT ("slug") DO NOTHING`; slug musi być globalnie unikalny.
- **C-11** — nowa migracja z unikalnym, sekwencyjnym numerem.
- **C-13** — weryfikacja wyłącznie na lokalnym Postgresie; żadnego builda ani migracji przeciw
  produkcyjnej bazie.
- **C-20** — ewentualne zapisy ustawień nadal jako Server Actions z `revalidatePath`.
- **C-30, C-31, C-32** — cała warstwa wizualna na zmiennych CSS; **C-31 jest tu regułą wiodącą**
  (mobile-first: przewijanie, szerokości, cele dotyku, `env(safe-area-inset-bottom)`); teksty po polsku.
- **C-51** — przyczyna błędnej pozycji kursora na iOS oraz wniosek o pamięci podręcznej promptu trafiają
  do `doświadczenia.md`.
- **C-53** — minimalizm: przenosimy i porządkujemy istniejące komponenty zamiast pisać je od nowa;
  nie dokładamy bibliotek do pozycjonowania panelu.

## 8. Otwarte pytania / decyzje właściciela

Pytania zadano na etapie `/specify` (C-55). Odpowiedzi właściciela:

- [x] **Miejsce konfiguracji własnego poziomu** — *odpowiedź własna właściciela*: w rozwijanym menu
      wyboru poziomu, przy pozycji „Własny", ma być **ikona wyrównana do prawej**; jej kliknięcie
      otwiera komponent z konfiguracją tego poziomu. (Czyli: wchodzi się tam z miejsca, w którym poziom
      się wybiera — nie z ustawień asystenta.)
- [x] **Skrót powrotu do rozmowy** — krzyżyk odrzucający **oraz** automatyczne znikanie po wysłaniu
      pierwszej wiadomości.
- [x] **Zakres raportu** — analiza **plus pełne prompty i odpowiedzi** w załącznikach (dokument ma być
      sprawdzalny co do znaku).
- [x] **Optymalizacje** — **nie wdrażamy żadnych** w tym przebiegu; właściciel decyduje po lekturze.

Założenia przyjęte samodzielnie (odnotowane, bo nie były przedmiotem pytania):

- Konfiguracja własnego poziomu, otwarta ikoną z menu, zachowuje się jak sekcja nagłówka: zasłania wątek
  i jest przewijalna (spójne z Z5 i z odpowiedzią właściciela).
- Odrzucenie skrótu powrotu obowiązuje do końca sesji przeglądarki i nie kasuje samej rozmowy.
- Raport z audytu jest **systemowy** (bez właściciela), kategoria techniczna — tak jak pozostałe
  dokumenty seedowane migracjami.

## 9. Ryzyka

- **Naprawa kursora na iOS „na ślepo"** — nie mamy tu iPhone'a do potwierdzenia. → Usuwamy
  **przyczynę** (skaczący układ przy pojawieniu się klawiatury), a nie objaw; kryterium jest
  obserwowalne, a w dokumentacji zostawiamy wprost, co sprawdzić na urządzeniu.
- **Chowanie klawiatury a pierwsze dotknięcie** — wymuszanie fokusu wprowadzono kiedyś po to, żeby
  przycisk zadziałał za pierwszym razem. → Kryterium AC-9 wymaga **obu** rzeczy naraz (klawiatura znika
  **i** akcja wykonuje się od razu), więc regresja „trzeba kliknąć dwa razy" zostanie wyłapana.
- **Panel kosztu dobierający stronę** — logika pozycjonowania łatwo psuje się przy zmianie rozmiaru
  okna. → Rozwiązanie ma być odporne na zmianę szerokości bez przeładowania strony.
- **Raport z pełnymi promptami będzie bardzo długi** — prompt agenta to ~5 tys. tokenów. → To świadomy
  koszt (właściciel wybrał wariant sprawdzalny); dokument dostaje spis treści i wyraźny podział na
  analizę i załączniki.
- **Pokusa „przy okazji" naprawienia kosztów** — zmiana byłaby prosta i kusząca. → AC-22 wprost tego
  zabrania: po wdrożeniu zachowanie i koszty muszą zostać takie jak przed nim.
