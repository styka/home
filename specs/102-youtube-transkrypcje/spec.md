# Spec: YouTube — nowy moduł: co warto obejrzeć, transkrypcje i streszczenia

- **ID:** 102-youtube-transkrypcje
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-25
- **Moduł(y):** **nowy moduł YouTube** (wzorowany na module Wiadomości)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Właściciel obserwuje na YouTube kilkadziesiąt kanałów i **nie wie, czy ma dziś co oglądać**. Żeby się
dowiedzieć, musi wejść na YouTube i przejrzeć stronę główną — a ta pokazuje to, co algorytm chce
sprzedać, nie to, co on subskrybuje. Filmy trwają po kilkadziesiąt minut, więc koszt sprawdzenia
„czy to jest dla mnie" jest wysoki: trzeba obejrzeć kawałek, żeby ocenić całość.

Omnia rozwiązała już dokładnie ten problem dla tekstu — moduł Wiadomości zbiera źródła, streszcza
i mówi, co nowego. Filmy zostały poza tym systemem, mimo że pytanie jest identyczne, a materiał
(transkrypcja) nadaje się do streszczenia tak samo dobrze jak artykuł.

## 2. Cel i miary sukcesu

- **Cel:** właściciel w jednym miejscu w Omnii widzi, **co nowego pojawiło się na jego kanałach**,
  od razu wie, **czy warto to obejrzeć**, i może przeczytać treść filmu zamiast go oglądać.
- **Sukces mierzymy:**
  - odpowiedź na pytanie „mam dziś co oglądać?" zajmuje **jedno wejście do modułu**, bez wchodzenia
    na YouTube;
  - dla filmu z dostępnymi napisami właściciel czyta **oryginalną transkrypcję** i streszczenie
    w wybranej długości, nie opuszczając aplikacji;
  - lista nowych filmów jest **uszeregowana według tego, czy warto**, a nie po dacie — z jednozdaniowym
    uzasadnieniem przy każdym;
  - dodanie obserwowanych kanałów po połączeniu konta Google zajmuje **jedno kliknięcie**.

## 3. Historyjki użytkownika

- Jako użytkownik chcę **wskazać kanały**, które śledzę — wklejając ich adres albo pobierając moje
  subskrypcje z konta Google — żeby nie przepisywać ręcznie kilkudziesięciu pozycji.
- Jako użytkownik chcę zobaczyć **nowe filmy z tych kanałów** w jednym miejscu, żeby wiedzieć, czy
  jest co oglądać.
- Jako użytkownik chcę przy każdym filmie **ocenę, czy warto go obejrzeć**, z krótkim uzasadnieniem,
  żeby nie tracić czasu na materiały nie dla mnie.
- Jako użytkownik chcę zobaczyć **oryginalną transkrypcję** filmu, żeby przeczytać treść zamiast
  oglądać, albo znaleźć konkretny fragment.
- Jako użytkownik chcę **streszczenie w trzech długościach** (krótkie / średnie / długie), żeby wybrać
  między „czy to o tym co myślę" a „chcę treść bez oglądania".
- Jako użytkownik chcę **zadać pytanie do filmu** („co on mówił o X?") i dostać odpowiedź opartą na
  transkrypcji, żeby nie przewijać czterdziestu minut.
- Jako użytkownik chcę **szukać po wszystkich zebranych transkrypcjach**, żeby odnaleźć film, w którym
  padło jakieś zdanie, choć nie pamiętam którym.
- Jako użytkownik chcę **przejść do filmu na YouTube** jednym kliknięciem, kiedy zdecyduję się obejrzeć.
- Jako użytkownik chcę **oznaczyć film jako obejrzany lub odrzucony**, żeby lista pokazywała to, czego
  jeszcze nie przerobiłem.

## 4. Kryteria akceptacji (testowalne)

**Kanały i śledzenie**
- [ ] **AC-1** — Given zalogowanego użytkownika z dostępem do modułu, when wkleja adres kanału YouTube
      (odnośnik do kanału albo jego nazwę użytkownika), then kanał zostaje dodany do jego listy
      obserwowanych i jest widoczny z nazwą.
- [ ] **AC-2** — Given użytkownika, który **nie** połączył konta YouTube, when wchodzi do modułu, then
      moduł **działa normalnie** na kanałach dodanych ręcznie i nigdzie nie blokuje pracy pytaniem
      o zgodę.
- [ ] **AC-3** — Given użytkownika, który zdecydował się połączyć konto YouTube, when wykonuje to
      w ustawieniach modułu i wyraża zgodę po stronie Google, then może **jednym poleceniem zaimportować
      swoje subskrypcje** jako obserwowane kanały, a duplikaty nie powstają.
- [ ] **AC-4** — Given połączone konto YouTube, when użytkownik je odłącza, then zgoda i dane dostępowe
      przestają być przechowywane, a **wcześniej zaimportowane kanały zostają** (przestają się tylko
      same aktualizować z subskrypcji).
- [ ] **AC-5** — Given listę obserwowanych kanałów, when użytkownik uruchamia odświeżenie modułu, then
      pojawiają się **nowe filmy z tych kanałów**, a przebieg pokazuje postęp i kończy się informacją,
      ile pozycji przybyło.

**Film, transkrypcja, streszczenia**
- [ ] **AC-6** — Given film na liście, when użytkownik go otwiera, then widzi tytuł, kanał, datę,
      czas trwania i **odnośnik otwierający film na YouTube**.
- [ ] **AC-7** — Given film, dla którego udało się pobrać napisy, when użytkownik prosi o transkrypcję,
      then widzi **oryginalną transkrypcję** w formie czytelnego tekstu.
- [ ] **AC-8** — Given film, dla którego **nie** udało się pobrać napisów, when użytkownik go otwiera,
      then film jest normalnie widoczny na liście, ma streszczenie oparte na tytule i opisie oraz
      **wyraźną etykietę „brak transkrypcji"** — i nigdzie nie wygląda to na błąd aplikacji.
- [ ] **AC-9** — Given film z transkrypcją, when użytkownik wybiera długość streszczenia (krótkie /
      średnie / długie), then dostaje streszczenie w tej długości, a **raz wygenerowane streszczenie
      nie jest generowane ponownie** przy kolejnym wejściu.
- [ ] **AC-10** — Given wygenerowane streszczenie, when użytkownik je ogląda, then widzi, **kiedy
      powstało**, i może je świadomie przeliczyć ponownie; ponowne generowanie nie dzieje się samo.

**AI: czy warto, pytania, szukanie**
- [ ] **AC-11** — Given zestaw nowych filmów, when moduł je oceni, then każdy ma **ocenę „czy warto
      obejrzeć"** wraz z jednozdaniowym uzasadnieniem, a lista daje się ułożyć według tej oceny.
- [ ] **AC-12** — Given ocenę z AC-11, when użytkownik ją czyta, then uzasadnienie odwołuje się do
      **jego** zainteresowań (tego, co system już o nim wie), a nie do ogólnej popularności filmu.
- [ ] **AC-13** — Given film z transkrypcją, when użytkownik zadaje do niego pytanie, then dostaje
      odpowiedź opartą na treści tego filmu, a gdy transkrypcja nie zawiera odpowiedzi — **jest to
      powiedziane wprost**, zamiast zmyślonej odpowiedzi.
- [ ] **AC-14** — Given kilka filmów z transkrypcjami, when użytkownik szuka frazy, then dostaje listę
      filmów, w których ta fraza pada, uszeregowaną po trafności.

**Zasady przekrojowe**
- [ ] **AC-15** — Given dwóch różnych użytkowników, when każdy korzysta z modułu, then **żaden nie widzi
      kanałów, filmów, transkrypcji ani streszczeń drugiego**.
- [ ] **AC-16** — Given użytkownika bez uprawnienia do modułu, when próbuje wejść na adres modułu
      wpisany ręcznie, then dostaje odmowę dostępu, a nie zawartość.
- [ ] **AC-17** — Given telefon, when użytkownik korzysta z modułu, then widok jest użyteczny jedną
      ręką: bez poziomego przewijania i z celami dotyku nie mniejszymi niż w pozostałych modułach.
- [ ] **AC-18** — Given usunięty kanał, when użytkownik go usuwa, then trafia do kosza aplikacji
      i daje się odzyskać, tak jak dane innych modułów.

## 5. Zakres

**W zakresie:**
- Nowy moduł z własnym uprawnieniem i miejscem w nawigacji.
- Obserwowane kanały: dodawanie ręczne po adresie oraz **import subskrypcji** po dobrowolnym
  połączeniu konta Google.
- Jedno odświeżenie obejmujące cały moduł: pobranie nowych filmów ze wszystkich obserwowanych kanałów.
- Dla filmu: odnośnik do YouTube, metadane, **oryginalna transkrypcja** (gdy dostępna), **streszczenia
  w trzech długościach** generowane na żądanie i zapamiętywane.
- **Ocena „czy warto obejrzeć"** z uzasadnieniem, oparta na wiedzy systemu o użytkowniku.
- **Pytania do filmu** oparte na jego transkrypcji.
- **Szukanie po wszystkich zebranych transkrypcjach.**
- Stany pozycji: nowe / obejrzane / odrzucone.
- Ustawienia modułu: domyślna długość streszczenia, połączenie i odłączenie konta YouTube.

**Poza zakresem (świadomie):**
- **Odtwarzanie filmów w Omnii** — moduł prowadzi na YouTube, nie zastępuje go.
- **Pobieranie dźwięku i transkrypcja mowy**, gdy napisów brak — odrzucone przez właściciela
  (kosztowne, ciężkie na hostingu, wątpliwe wobec regulaminu). Brak napisów = etykieta.
- **Ręczne wklejanie transkrypcji** przez użytkownika — decyzja właściciela: wystarczy etykieta.
- **Rozdziały i kluczowe momenty ze znacznikami czasu** — rozważane, świadomie odłożone.
- **Przenoszenie treści filmu do innych modułów** (przepis → Kuchnia, kroki → Zadania) — świadomie
  odłożone; moduł ma najpierw dobrze robić swoją robotę.
- Komentarze pod filmami, statystyki oglądalności, zarządzanie własnym kanałem.
- Współdzielenie kanałów i filmów z zespołem — dane są osobiste.
- Audyt bezpieczeństwa — osobny spec `101-audyt-bezpieczenstwa`.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** **nowy slug uprawnienia modułu**, zaseedowany migracją, wpięty w rejestr
  modułów, mapowanie ścieżek i nawigację (desktop + mobilna) — C-22. Trasa modułu musi **sama**
  sprawdzać uprawnienie, nie polegać na tym, że nawigacja wyszarza pozycję.
- **Własność danych:** **osobista** — kanały, filmy, transkrypcje i streszczenia należą do przestrzeni
  osobistej użytkownika, bez własności zespołowej (wzorzec modułu Wiadomości). Zgoda na dostęp do
  YouTube jest z definicji przypisana do **konta**, nie do przestrzeni.
- **Asystent AI:** tak — moduł wnosi **narzędzia odczytu** (co nowego, co warto obejrzeć, o czym był
  film) oraz **akcje** (dodaj kanał, odśwież moduł, oznacz jako obejrzane). Każda akcja musi mieć
  egzekutor i wpis w kontrakcie akcji — C-23.
- **Kalendarz:** nie dotyczy — film nie jest wydarzeniem w czasie.
- **Powiadomienia:** poza zakresem tej wersji; moduł ma być miejscem, do którego się zagląda, a nie
  kolejnym źródłem powiadomień.
- **Trash:** tak — usunięcie kanału idzie przez kosz aplikacji (C-24, AC-18).
- **Koszty AI:** wszystkie operacje modelu muszą przechodzić przez istniejący system budżetów
  i raportowania kosztu; streszczenia są **pamiętane**, a nie generowane przy każdym wejściu.

## 7. Zgodność z konstytucją

- **C-36** — moduł rejestruje się **jedną deklaracją**: menu, uprawnienie, ścieżki, nawigacja boczna,
  wkład do asystenta i zadania w tle. Zakaz dopisywania modułu do równoległych list; wszystkie pola
  deklaracji **leniwe**. Moduł widzi inne moduły wyłącznie przez ich kontrakt.
- **C-10, C-11, C-12, C-14** — nowe dane wymagają **ręcznie napisanych** migracji z unikalnym,
  sekwencyjnym numerem; stany pozycji to **łańcuchy znaków z zawężającym typem**, nigdy enum Prisma;
  uprawnienie seedowane idempotentnie.
- **C-20** — mutacje wyłącznie przez Server Actions z odświeżeniem ścieżki.
- **C-22** — nowe uprawnienie modułu + bramkowanie trasy (AC-16).
- **C-33** — widok deklaruje się przez wspólną ramę, ze stanami brzegowymi przez przeznaczony do tego
  mechanizm; ustawienia modułu idą w **jedno** miejsce przewidziane przez ramę, nie w zakładkę.
- **C-30, C-31, C-32** — kolory wyłącznie ze zmiennych motywu; wariant mobilny (AC-17); **wszystkie
  teksty po polsku, przez mechanizm tłumaczeń, zero literałów w komponentach**.
- **C-34** — potwierdzenia przez wspólne okno dialogowe aplikacji, nigdy natywne.
- **C-40, C-41** — model rozstrzygany po typie operacji z konfiguracji, nie zaszyty w kodzie; dane
  dostępowe do konta Google **szyfrowane w spoczynku** i nigdy nie zwracane w całości.
- **C-53** — minimalizm: idziemy wzorcem modułu Wiadomości i nie budujemy własnych odpowiedników
  tego, co platforma już ma (pamięć treści AI, budżety, kosz, ograniczanie żądań).
- **C-50** — „gotowe" = `npm run build` przechodzi w całości, lokalnie (C-13).

## 8. Otwarte pytania / decyzje właściciela

- [x] **Osobny moduł?** — tak, decyzja właściciela wprost z opisu zgłoszenia.
- [x] **Skąd transkrypcje** (YouTube nie daje oficjalnego sposobu na pobranie napisów cudzego filmu) —
      właściciel wybrał **wariant lekki**: pobrać stronę filmu i odczytać z niej dostępną ścieżkę
      napisów, tym samym sposobem, którym moduł Wiadomości dociąga treść artykułów. **Bez** dokładania
      przeglądarki w tle do produkcji.
- [x] **Gdy transkrypcji nie da się pobrać** — właściciel wybrał: **sama etykieta „brak transkrypcji"**
      plus streszczenie z tytułu i opisu. Bez ręcznego wklejania transkrypcji.
- [x] **Subskrypcje z konta Google** — właściciel wybrał **osobną, dobrowolną zgodę** (wzorzec, którym
      działa już połączenie z Dyskiem Google), a nie rozszerzanie zgody przy logowaniu do aplikacji.
      **Świadome następstwo do zapisania w raporcie:** to zgoda z kategorii wrażliwych — przed
      udostępnieniem aplikacji szerokiej publiczności Google będzie wymagać weryfikacji aplikacji.
- [x] **Dodatkowe funkcje AI** — właściciel wybrał **dwie**: ocena „czy warto obejrzeć" z rankingiem
      oraz pytania do filmu + szukanie po transkrypcjach. Rozdziały ze znacznikami czasu i przenoszenie
      treści do innych modułów: **poza zakresem**, wypisane wyżej.
- [x] **Założenie przyjęte domyślnie:** własność **osobista**, bez wariantu zespołowego — wzorem modułu
      Wiadomości i dlatego, że subskrypcje YouTube są danymi osobistymi.
- [x] **Założenie przyjęte domyślnie:** transkrypcje przechowujemy u siebie, bo bez tego nie da się
      spełnić AC-14 (szukanie po wszystkich transkrypcjach) ani uniknąć ponownego pobierania.

## 9. Ryzyka

- **YouTube utrudni pobieranie napisów serwerowi** (najpoważniejsze ryzyko tego modułu) → moduł jest
  zaprojektowany tak, że **brak transkrypcji jest normalnym stanem, nie awarią** (AC-8): lista filmów,
  ocena „czy warto" i streszczenia z opisu działają dalej. Odsetek udanych pobrań musi być widoczny,
  żeby dało się ocenić, czy wariant lekki wystarcza.
- **Koszt modelu rośnie z liczbą filmów** → streszczenia **na żądanie i pamiętane**, oceny liczone raz
  na pozycję, wszystko pod istniejącym budżetem AI.
- **Zgoda wrażliwa Google blokuje otwarcie na wiele osób** → moduł **działa bez tej zgody** (AC-2), więc
  brak weryfikacji ogranicza wygodę, a nie użyteczność.
- **Ocena „czy warto" będzie ogólnikowa** → wymagamy uzasadnienia odwołującego się do wiedzy systemu
  o użytkowniku (AC-12); ocena bez uzasadnienia jest gorsza niż jej brak, bo udaje wiedzę.
- **Odpowiedzi na pytania do filmu będą zmyślane** → AC-13 wymaga wprost przyznania „nie ma tego
  w transkrypcji".
- **Moduł powieli mechanikę Wiadomości zamiast jej użyć** → wspólne zdolności (pamięć treści AI, kosz,
  budżety, kolejka zadań) bierzemy z platformy; kopiowanie ich byłoby złamaniem C-53.
