# Spec: Wiadomości i Pogoda — poprawki UX po wdrożeniu 039

- **ID:** 040-wiadomosci-pogoda-ux
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-01
- **Moduł(y):** Wiadomości (`/wiadomosci`), Pogoda (`/pogoda` — sekcja „Co robić?")

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**.

## 1. Problem / potrzeba

Sześć zgłoszeń z jednego przeglądu, jaki właściciel zrobił zaraz po wdrożeniu 039. Wszystkie są tego
samego rodzaju: **funkcje działają, ale sposób obsługi wchodzi użytkownikowi w drogę** — układ zjada
miejsce, kliknięcia robią coś niewidocznego, z widoku nie da się wrócić, a jedno pole wymusza wybór
z trzech opcji tam, gdzie potrzebne jest dowolne słowo. Do tego jedna usterka techniczna widoczna
jako defekt UX: na telefonie strona daje się przewijać w bok, choć po prawej nic nie ma.

Robimy to teraz, bo świeżo przebudowany moduł jest właśnie w codziennym użyciu — każdy z tych
drobiazgów kosztuje właściciela irytację przy **każdym** wejściu, a razem układają się w wrażenie,
że moduł jest niedokończony.

## 2. Cel i miary sukcesu

- **Cel:** korzystanie z Wiadomości i z „Co robić?" w Pogodzie ma być bezwysiłkowe — na komputerze i
  na telefonie — bez elementów, które zabierają miejsce, gubią użytkownika albo nie pokazują skutku
  kliknięcia.
- **Sukces mierzymy:**
  - przegląd gorących tematów da się zrobić **bez ani jednego powrotu** do listy (żadne oznaczenie
    nie wyrzuca użytkownika z widoku),
  - po wybraniu tematu **cała szerokość** strony należy do treści, a nazwa tematu jest czytelna w
    całości,
  - skutek każdego kliknięcia jest widoczny **bez przewijania**,
  - z każdego widoku modułu da się wrócić **jednym dotknięciem**, także na telefonie,
  - `/wiadomosci` na telefonie **nie przewija się w poziomie**.

## 3. Historyjki użytkownika

- Jako właściciel chcę opisywać źródła własnymi słowami („pop-science", „nature", „lewica"), bo mój
  zestaw kanałów dawno wykroczył poza politykę.
- Jako właściciel chcę przejrzeć wszystkie gorące tematy i pooznaczać je za jednym posiedzeniem,
  żeby nie wracać do listy po każdym kliknięciu.
- Jako właściciel chcę widzieć wiadomości na całej szerokości ekranu, a temat wybierać bez oddawania
  na to jednej trzeciej strony.
- Jako właściciel chcę po wejściu w temat najpierw zobaczyć **nowe wiadomości**, bo po to tu
  przychodzę; linia czasu jest do nadrobienia kontekstu, nie do codziennego czytania.
- Jako właściciel chcę, żeby kliknięcie w propozycję w Pogodzie od razu pokazało jej szczegóły — tam
  gdzie kliknąłem, a nie gdzieś poza ekranem.
- Jako właściciel chcę móc wrócić do wiadomości po zajrzeniu w źródła albo gorące tematy na
  telefonie, bez zgadywania i bez przycisku „wstecz" przeglądarki.

## 4. Kryteria akceptacji (testowalne)

**Opis źródła zamiast sztywnych kategorii (zgłoszenie 1)**
- [ ] **AC-1** — Given formularz źródła, when go otwieram, then zamiast listy wyboru
      „Lewica/Centrum/Prawica" widzę **pole tekstowe na krótki opis**, który mogę wpisać własnymi
      słowami.
- [ ] **AC-2** — Given źródło z opisem, when patrzę na kartę wiadomości, zakładkę źródła i pozycję
      linii czasu, then widzę **ten opis** (a nie jedną z trzech dawnych nazw).
- [ ] **AC-3** — Given dwa źródła o różnych opisach, when patrzę na listę wiadomości, then nadal
      rozróżniam je **kolorem**, a to samo źródło ma **zawsze ten sam kolor** między wejściami na
      stronę.
- [ ] **AC-4** — Given źródła istniejące przed zmianą, when wdrożenie się zakończy, then mają
      **czytelny opis po polsku** odpowiadający ich dotychczasowej kategorii — żadne nie zostaje
      z pustym opisem ani z surowym `left`/`center`/`right`.
- [ ] **AC-5** — Given źródło bez opisu (użytkownik go skasował), when patrzę na jego wiadomości,
      then interfejs **działa normalnie** — brak opisu nie zostawia pustej plamy ani błędu.

**Oznaczanie gorących tematów (zgłoszenie 2)**
- [ ] **AC-6** — Given lista gorących tematów, when klikam „Monitoruj ten temat", then **zostaję na
      liście** i mogę od razu oznaczyć kolejny.
- [ ] **AC-7** — Given kliknięcie „Monitoruj ten temat", when akcja się powiedzie, then dostaję
      **wyraźną informację, że zapisano**, a sam temat jest odtąd widocznie oznaczony jako
      monitorowany — bez konieczności przechodzenia gdziekolwiek.

**Układ i nawigacja Wiadomości (zgłoszenie 3)**
- [ ] **AC-8** — Given komputer, when otwieram moduł, then **nie ma osobnej kolumny tematów** —
      treść wybranego tematu zajmuje pełną szerokość.
- [ ] **AC-9** — Given kilka tematów o długich nazwach, when wybieram temat, then **każda nazwa jest
      czytelna w całości** (nie jest ucięta), a wybrany temat jest wyraźnie oznaczony.
- [ ] **AC-10** — Given wybrany temat, when widok się otworzy, then pierwsze, co widzę, to **nowe
      wiadomości** — linia czasu jest dostępna, ale nie jako pierwsza treść.
- [ ] **AC-11** — Given wybrany temat, when przełączę się na linię czasu i wybiorę inny temat, then
      **wybór widoku zostaje zachowany** (nie wracam za każdym razem do wiadomości).
- [ ] **AC-12** — Given telefon, when nawiguję po tematach, then korzystam z **tego samego
      mechanizmu** co na komputerze i nie widzę dwóch różnych układów nawigacji.

**Powrót z widoków pobocznych (zgłoszenie 5)**
- [ ] **AC-13** — Given telefon i otwarty widok „Źródła" albo „Gorące tematy", when chcę wrócić,
      then widzę **jednoznaczny sposób powrotu** do wiadomości i wracam **jednym dotknięciem**.
- [ ] **AC-14** — Given dowolny widok poboczny, when na nim jestem, then z samego ekranu widać,
      **gdzie jestem** (nazwa widoku), a nie tylko jego zawartość.

**Poziomy scroll na telefonie (zgłoszenie 6)**
- [ ] **AC-15** — Given telefon, when jestem na dowolnym widoku modułu Wiadomości (wiadomości,
      gorące tematy, źródła) i próbuję przesunąć stronę w bok, then **nic się nie przesuwa** —
      strona mieści się w szerokości ekranu.
- [ ] **AC-16** — Given przyczyna rozpychania strony, when ją usuwamy, then **naprawiamy źródło
      problemu**, a nie ucinamy objaw globalnym ukryciem przewijania — element, który wystawał, ma
      działać poprawnie (np. przewijać się we własnych ramach).

**Szczegóły propozycji w Pogodzie (zgłoszenie 4)**
- [ ] **AC-17** — Given lista propozycji „Co robić?", when klikam w propozycję, then jej szczegóły
      pojawiają się **przy tej propozycji**, w polu widzenia — bez przewijania w poszukiwaniu ich.
- [ ] **AC-18** — Given propozycja na liście, when patrzę na jej przyciski, then **nie ma osobnego
      przycisku otwierającego szczegóły** dublującego kliknięcie w samą propozycję.
- [ ] **AC-19** — Given otwarte szczegóły propozycji, when klikam w inną propozycję, then otwierają
      się jej szczegóły, a poprzednie się zamykają — na ekranie nigdy nie ma dwóch rozwiniętych
      opisów naraz.
- [ ] **AC-20** — Given otwarte szczegóły, when chcę je zamknąć, then mogę to zrobić **wprost**,
      wracając do samej listy.

## 5. Zakres

**W zakresie:**
- Zamiana sztywnej kategorii źródła na dowolny krótki opis, wraz z przeniesieniem istniejących
  danych i zachowaniem rozróżnienia kolorem.
- Oznaczanie gorących tematów bez opuszczania listy, z potwierdzeniem zapisu.
- Nowy układ nawigacji po tematach (komputer i telefon) oraz podział treści tematu na nowe
  wiadomości (domyślnie) i linię czasu.
- Jednoznaczny powrót z widoków „Źródła" i „Gorące tematy" na telefonie.
- Usunięcie realnej przyczyny poziomego przewijania na telefonie.
- Szczegóły propozycji w Pogodzie otwierane w miejscu kliknięcia, bez dublującego przycisku.

**Poza zakresem (świadomie):**
- Zmiany w samym przebiegu odświeżania (pobieranie, klasyfikacja, streszczenia, linia czasu) — 039
  właśnie to przebudowało i działa.
- „Dobór z puli" dla nowo utworzonego tematu (uwaga z recenzji 039) — osobna funkcja, nie poprawka UX.
- Filtrowanie/sortowanie wiadomości po opisie źródła — opis jest na razie etykietą, nie kryterium.
- Podpowiedzi gotowych opisów źródeł ani ich słownik — właściciel wpisuje własne słowa.
- Zmiany w pozostałych modułach, nawet jeśli mają podobny układ dwukolumnowy.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — `module.news` i `module.weather`. Żadnego nowego slugu (C-22).
- **Własność danych:** bez zmian — źródła, tematy i propozycje pozostają per użytkownik (`ownerId`),
  zgodnie z C-21. Feature nie wprowadza nowych encji współdzielonych.
- **Asystent AI:** bez nowych `AIAction`. Istniejące akcje dotyczące źródeł operują dziś na
  kategorii światopoglądowej — muszą przejść na opis, żeby katalog akcji nie opisywał nieistniejącego
  pola (C-23). Read-toole zwracają opis zamiast dawnej kategorii.
- **Kalendarz / powiadomienia / trash:** nie dotyczy — to zmiany prezentacji i jednego pola
  słownikowego, nic nie powstaje ani nie znika jako byt do odzyskania.

## 7. Zgodność z konstytucją

- **C-10, C-11, C-12** — zamiana kategorii na opis rusza schemat: potrzebny ręczny plik migracji z
  kolejnym numerem, a nowe pole pozostaje tekstem (żadnych enumów Prisma).
- **C-20** — każda zmiana danych (opis źródła, oznaczenie tematu) przez Server Action z
  `revalidatePath`.
- **C-23** — akcje asystenta dotyczące źródeł muszą zostać zsynchronizowane z nowym polem, inaczej
  bramka `check:actions` zatrzyma build.
- **C-30** — kolor źródła liczony automatycznie **musi** pochodzić z palety zmiennych CSS; żadnych
  hexów, bo skórki nadpisują kolory.
- **C-31** — sedno tego feature'a: mobile-first, jeden mechanizm nawigacji zamiast dwóch, cele
  dotyku, brak poziomego przewijania.
- **C-32** — wszystkie teksty po polsku, łącznie z opisami zmigrowanych źródeł.
- **C-51** — przyczyna poziomego przewijania to nieoczywisty problem; po naprawie wpis do
  `doświadczenia.md`.
- **C-53** — minimalizm: poprawiamy to, co zgłoszone, bez przebudowy sąsiednich modułów „przy okazji".

## 8. Otwarte pytania / decyzje właściciela

Wszystkie rozstrzygnięte na starcie (C-55) — właściciel wybrał wariant rekomendowany w każdym z
czterech pytań:

- [x] **Kolor źródła po usunięciu kategorii** → **liczony z opisu automatycznie**. Ten sam opis daje
      zawsze ten sam kolor, użytkownik nie wypełnia nic poza opisem.
- [x] **Nawigacja po tematach** → **poziomy pasek zakładek nad treścią**, przewijalny przy nadmiarze;
      ten sam mechanizm na komputerze i na telefonie.
- [x] **Linia czasu** → **przełącznik widoku „Wiadomości / Linia czasu"**, domyślnie wiadomości,
      wybór pamiętany przy zmianie tematu.
- [x] **Szczegóły propozycji w Pogodzie** → **rozwijają się w miejscu klikniętej propozycji**;
      osobny przycisk „Szczegóły" znika.

Założenia przyjęte domyślnie (bez pytania, bo wynikają z konwencji albo z treści zgłoszeń):

- Istniejące kategorie migrujemy na polskie opisy: „Lewica", „Centrum", „Prawica" — żadne źródło nie
  zostaje bez opisu (AC-4).
- Opis źródła jest **opcjonalny** — użytkownik może go wyczyścić, a interfejs ma to znieść (AC-5).
- Potwierdzenie zapisu przy „Monitoruj ten temat" realizujemy istniejącym mechanizmem komunikatów
  aplikacji, bez wymyślania nowego (C-53).
- Zmiana dotyczy wyłącznie modułów Wiadomości i Pogoda, mimo że dwukolumnowy układ występuje też
  gdzie indziej.

## 9. Ryzyka

- **Kolor liczony z tekstu może wypaść nieczytelnie albo zbyt podobnie dla dwóch źródeł.** →
  Ograniczamy się do palety akcentów motywu (a nie dowolnego odcienia), więc każdy wynik jest
  czytelny na tle aplikacji; przy kilku źródłach ryzyko kolizji jest niewielkie, a rozróżnienie i
  tak niesie przede wszystkim **nazwa** źródła — kolor jest wsparciem, nie jedynym nośnikiem
  informacji.
- **Utrata kategorii źródła zubaża prompt modelu**, który dziś dostaje informację o profilu źródła. →
  Opis wpisany przez użytkownika jest **bogatszy** od trzech sztywnych wartości; przekazujemy go w to
  samo miejsce, więc model nie traci kontekstu, a zyskuje trafniejszy.
- **Zmiana układu może wyglądać dobrze na szerokim ekranie, a rozjechać się na telefonie** (to
  dokładnie ta klasa błędu, którą naprawiamy). → Kryteria akceptacji wymagają **jednego** mechanizmu
  nawigacji dla obu szerokości, a brak poziomego przewijania jest osobnym, twardym kryterium.
- **Poprawianie poziomego przewijania kusi do zamiecenia go pod dywan** (`overflow-hidden` na
  kontenerze). → AC-16 wymaga wprost naprawy przyczyny, nie objawu; element, który wystawał, ma
  zacząć działać poprawnie.
- **Rozwijanie szczegółów w miejscu kliknięcia wydłuża listę** i może przesuwać pozycje pod kursorem.
  → Tylko jedna propozycja może być rozwinięta naraz (AC-19), więc lista nie rośnie w
  nieprzewidywalny sposób.
