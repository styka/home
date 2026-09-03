# Spec: Wiadomości — tytuły i streszczenia zawsze po polsku + oznaczenie „do doczytania"

- **ID:** 124-wiadomosci-polski-i-doczytania
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-09-03
- **Moduł(y):** Wiadomości (`/wiadomosci`, `module.news`)

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów. Jeśli piszesz o implementacji — to należy do `plan.md`, nie tutaj.

## 1. Problem / potrzeba

Dwa zgłoszenia administratora, oba dotyczące modułu Wiadomości:

**(A) Angielskie tytuły mimo reguły „po polsku".** Moduł od dawna deklaruje, że tytuły i streszczenia
wiadomości są po polsku (tłumaczenie tytułu zostało wprowadzone razem ze streszczeniem), a mimo to
użytkownik widzi na `/wiadomosci` — w temacie „AI / LLM" — pozycję z tytułem w całości po angielsku:
„The economics of agent scale: tokens, ROI, and building platforms for AI-first teams (Part 2)".
Skoro reguła istnieje, a angielski tytuł i tak dociera do widoku, to znaczy, że jakaś ścieżka, którą
pozycja trafia na listę, omija tłumaczenie (albo jego wynik nie zostaje zachowany) — i użytkownik
nie ma żadnego sposobu, by to naprawić. Zgłoszenie mówi wprost: tytuły **i streszczenia** mają być
po polsku, z wyjątkiem słów, których się nie tłumaczy (nazwy własne, ustalone terminy techniczne).

**(B) Brak sposobu na odłożenie wiadomości „do doczytania".** Użytkownik czyta wiadomości jako listę
tytułów ze streszczeniami. Dla większości pozycji tytuł + streszczenie wystarczą („przeczytałem,
wiem"), ale część wymaga sięgnięcia do pełnej treści — i dziś nie ma jak ich odłożyć: jest tylko
„Przeczytane" (pozycja znika z nowych) albo zostawienie jej na liście razem ze wszystkim innym.
Użytkownik chce jednym gestem oznaczyć „tytuł mi nie wystarczył, wrócę do tego" i potem odfiltrować
sobie wyłącznie te pozycje. Właściciel wprost delegował projekt UX: „wymyśl świetny UX na to".

## 2. Cel i miary sukcesu

- Cel (A): każda pozycja widoczna w module Wiadomości ma tytuł i streszczenie po polsku (poza
  słowami, których się nie tłumaczy) — niezależnie od tego, którą ścieżką trafiła na listę; pozycje
  już zapisane z angielskim tytułem zostają doprowadzone do polskiego bez ręcznej interwencji.
- Cel (B): użytkownik jednym gestem odkłada wiadomość „do doczytania" i jednym gestem zawęża widok
  do samych odłożonych; lista odłożonych nie znika przy odświeżeniach i oznaczaniu reszty jako
  przeczytanej.
- Sukces mierzymy:
  - na liście wiadomości (wszystkie tematy, w tym „AI / LLM") nie ma pozycji z tytułem w całości
    w obcym języku; zgłoszony przykład po ponownym przebiegu odświeżania ma tytuł po polsku;
  - odłożenie pozycji „do doczytania" to jeden gest na karcie wiadomości; przejście do widoku samych
    odłożonych to jeden gest w pasku modułu; oba działają na telefonie (cel dotyku, stała wysokość
    paska — wzorzec 083/100);
  - pozycja odłożona „do doczytania" nie ginie: przeżywa odświeżenie modułu, „oznacz wszystkie jako
    przeczytane" i zamknięcie przeglądarki.

## 3. Historyjki użytkownika

- Jako czytelnik Wiadomości chcę, żeby tytuły i streszczenia były po polsku (z zachowaniem nazw
  własnych i terminów, których się nie tłumaczy), żebym nie przełączał się między językami w trakcie
  przeglądu.
- Jako czytelnik chcę, żeby pozycje zapisane wcześniej z angielskim tytułem też zostały poprawione,
  żebym nie musiał ich usuwać ani czekać, aż wypadną z okna świeżości.
- Jako czytelnik przeglądający listę tytułów chcę jednym gestem oznaczyć wiadomość „do doczytania",
  gdy tytuł i streszczenie mi nie wystarczą, żeby nie zgubić jej wśród setek innych.
- Jako czytelnik chcę jednym gestem zawęzić widok do samych pozycji „do doczytania", żeby wrócić do
  nich w wolnej chwili i odhaczać po przeczytaniu.
- Jako czytelnik chcę, żeby „oznacz wszystkie jako przeczytane" nie zabierało mi pozycji odłożonych
  „do doczytania" — odłożenie to moja jawna decyzja, silniejsza niż zbiorcze sprzątanie.

## 4. Kryteria akceptacji (testowalne)

- [ ] **AC-1** — Given przebieg odświeżania wiadomości, który pobrał artykuły z obcojęzycznego
  źródła, when pozycje pojawiają się na liście `/wiadomosci`, then każda widoczna pozycja ma tytuł
  po polsku (dopuszczalne pozostawione nazwy własne / terminy nietłumaczalne), a żadna nie ma tytułu
  w całości w języku obcym.
- [ ] **AC-2** — Given pozycja, której streszczenie powstało, when użytkownik ją czyta, then
  streszczenie jest po polsku (z tym samym wyjątkiem nietłumaczalnych słów).
- [ ] **AC-3** — Given pozycje zapisane przed zmianą z tytułem w języku obcym (jak w zgłoszeniu),
  when moduł wykona kolejne odświeżanie, then te pozycje dostają polski tytuł bez ręcznej
  interwencji użytkownika i bez utraty pozostałych danych pozycji (link, źródło, status).
- [ ] **AC-4** — Given pozycja, dla której tłumaczenie/streszczenie się nie powiodło, when pozycja
  mimo to trafia na listę, then następny przebieg odświeżania ponawia próbę (błąd nie utrwala
  angielskiego tytułu na zawsze).
- [ ] **AC-5** — Given karta wiadomości na liście, when użytkownik wykonuje jeden gest „do
  doczytania", then pozycja zostaje trwale oznaczona, gest jest odwracalny tym samym miejscem,
  a oznaczenie jest widoczne na karcie.
- [ ] **AC-6** — Given co najmniej jedna pozycja „do doczytania", when użytkownik jednym gestem
  włącza zawężenie widoku do odłożonych, then lista pokazuje wyłącznie pozycje „do doczytania"
  (ze wszystkich tematów), licznik odłożonych jest widoczny, a wyjście z zawężenia to ten sam gest.
- [ ] **AC-7** — Given pozycje „do doczytania", when użytkownik używa „oznacz wszystkie jako
  przeczytane" albo moduł wykonuje odświeżanie, then odłożone pozycje pozostają odłożone i widoczne
  w zawężonym widoku.
- [ ] **AC-8** — Given pozycja „do doczytania", when użytkownik po lekturze oznacza ją jako
  przeczytaną/obsłużoną, then pozycja znika z listy odłożonych (odłożenie nie jest wieczne).
- [ ] **AC-9** — Given telefon (360 px), when użytkownik korzysta z gestu odłożenia i zawężenia,
  then cele dotyku mieszczą normy modułu, a pasek nawigacyjny modułu zachowuje stałą wysokość
  niezależnie od liczby odłożonych pozycji (wzorzec 083/100).
- [ ] **AC-10** — Given stan zawężenia „do doczytania", when użytkownik zapisuje widok jako
  ulubiony albo odświeża stronę, then stan zawężenia da się odtworzyć (widok jest ulubialny — jak
  `tresc`/`zrodla`/`czytanie`).

## 5. Zakres

**W zakresie:**
- Domknięcie reguły „po polsku" dla tytułów i streszczeń: każda ścieżka, którą pozycja trafia na
  listę, kończy się polskim tytułem; naprawa pozycji już zapisanych z obcym tytułem; ponawianie po
  nieudanym tłumaczeniu.
- Oznaczenie „do doczytania" na karcie wiadomości (jeden gest, odwracalne, trwałe per użytkownik).
- Zawężenie widoku do odłożonych pozycji (jeden gest, licznik, stan w adresie widoku, telefon).
- Współżycie odłożenia z istniejącymi mechanizmami: „Przeczytane", „oznacz wszystkie", odświeżanie.

**Poza zakresem (świadomie):**
- Zadanie 3 z wejścia (transkrypcje YouTube z rozwiniętego opisu) — **zrealizowane wcześniej** jako
  feature `123-youtube-transkrypcje-fix` (werdykt APPROVE Z UWAGAMI, zmergowane do `develop`
  i wypromowane na `master`); ten przebieg go nie dotyka.
- Zmiana formuły samych tytułów na „konkretniejsze / bogatsze w szczegóły" jako osobny tryb —
  streszczenia i tytuły mają już swoje reguły długości; nie przebudowujemy ich formatu w tym
  przebiegu.
- Przypomnienia/powiadomienia o zaległych „do doczytania", integracja z Zadaniami lub kalendarzem.
- Tłumaczenie pełnej treści artykułu (czytanej po kliknięciu w źródło) — tłumaczymy to, co
  prezentuje Omnia: tytuł i streszczenie.

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** istniejące `module.news`; żadnego nowego sluga.
- **Własność danych:** stan „do doczytania" jest osobisty (per użytkownik, jak inne preferencje
  i statusy odczytu w Wiadomościach); żadnych zasobów zespołowych.
- **Asystent AI:** nie dotyczy (żadnej nowej `AIAction`; ewentualne odczyty pokrywa istniejący
  read-tool wiadomości).
- **Kalendarz / powiadomienia / trash:** nie dotyczy — odłożenie „do doczytania" nie tworzy terminu
  ani powiadomienia; nic nie jest usuwane, więc kosz bez zmian.

## 7. Zgodność z konstytucją

- **C-36** — praca wewnątrz `src/modules/news/`; inne moduły tylko przez kontrakt (nie przewidujemy
  potrzeby).
- **C-20** — mutacje (oznaczenie „do doczytania") jako Server Actions z `revalidatePath`.
- **C-30/C-31/C-33** — zmienne CSS, cele dotyku, stała wysokość paska (wzorce 083/100), widok przez
  `ModuleView`; stan zawężenia w adresie widoku, żeby był ulubialny (wzorzec 084/087).
- **C-32** — nowe teksty UI po polsku przez `t()` / `messages/pl.json`.
- **C-12** — żadnych enumów Prisma; ewentualne nowe statusy jako `String` + union TS.
- **C-10/C-11** — każda zmiana schematu ręczną migracją z wolnym numerem.
- **C-40** — tłumaczenie/streszczenie przez DB-driven routing modeli (bez hardcodowanego modelu).
- **C-53** — minimalizm: domykamy istniejącą regułę języka zamiast budować nowy podsystem tłumaczeń.
- **C-50/C-51/C-52** — build jako definicja „gotowe", lekcje do `doświadczenia.md`, merge do
  `develop` + automatyczna promocja `master`.

## 8. Otwarte pytania / decyzje właściciela

Sesja działa autonomicznie; przewidywalne decyzje rozstrzygnięto rekomendowanymi domyślnymi
(C-55) i odnotowano tutaj:

- **Grupowanie zgłoszeń:** zadania 1 i 2 jako jeden feature parasolowy (oba w module Wiadomości);
  zadanie 3 już dowiezione w `123` — patrz „poza zakresem".
- **UX odłożenia (delegowane wprost: „wymyśl świetny UX"):** jeden gest na karcie wiadomości
  (odwracalny znacznik „Doczytam") + zawężenie widoku jednym gestem w istniejącym pasku modułu
  z licznikiem odłożonych; bez nowej podstrony i bez drugiego paska. Szczegółowy kształt dobierze
  `plan.md` wg wzorców modułu (083/084/100).
- **Naprawa zastanych pozycji:** automatycznie, w ramach zwykłych przebiegów odświeżania (bez
  osobnego przycisku „przetłumacz wszystko") — koszt kontrolowany, bo dotyczy tylko pozycji
  z obcym tytułem w oknie świeżości.
- **Zasięg tłumaczenia:** tytuł + streszczenie prezentowane przez Omnia; pełna treść artykułu
  pozostaje w oryginale.
- **Odłożenie a „przeczytane":** odłożenie jest silniejsze niż zbiorcze „oznacz wszystkie" (jawna
  decyzja użytkownika nie może zostać sprzątnięta hurtem); pojedyncze „Przeczytane" na odłożonej
  pozycji zdejmuje odłożenie (AC-8).

## 9. Ryzyka

- **Model mimo instrukcji zwróci tytuł nieprzetłumaczony** → kryterium akceptacji wymusza kontrolę
  wyniku, a nieudane tłumaczenie jest ponawiane w kolejnym przebiegu (AC-4), zamiast utrwalać się.
- **Koszt dodatkowych wywołań przy naprawie zastanych pozycji** → naprawa ogranicza się do pozycji
  faktycznie obcojęzycznych w oknie świeżości i jedzie razem z istniejącym przebiegiem odświeżania
  (bez osobnej lawiny wywołań); koszt raportuje istniejący mechanizm kosztów modułu.
- **Rozjazd z istniejącymi filtrami (źródła, treść, tematy)** → zawężenie „do doczytania" filtruje
  TEN SAM zbiór, który zasila nawigator tematów (lekcja 085: treść i nawigator nie mogą się nie
  zgadzać); weryfikacja w `/verify` na obu widokach.
- **Heurystyka „tytuł w języku obcym" fałszywie oznaczy polski tytuł z angielskim terminem** →
  wyjątek dla nietłumaczalnych słów jest częścią kryteriów (AC-1); próg ostrożny — lepiej zostawić
  wątpliwy tytuł niż tłumaczyć w pętli.
