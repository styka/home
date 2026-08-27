# Spec: Powrót do miejsca czytania, rosnąca wiedza o użytkowniku i uporządkowane Wiadomości

- **ID:** 111-zgloszenia-scroll-wiedza-wiadomosci
- **Status:** draft
- **Autor sesji:** Claude Code (spec-driven pipeline)
- **Data:** 2026-08-27
- **Moduł(y):** Powłoka (nawigacja) · Asystent / Wiedza o użytkowniku · Wiadomości

> **Zasada speca:** opisujemy **CO i DLACZEGO**, nigdy **JAK**. Zero nazw plików, tabel, bibliotek,
> endpointów.

## 1. Problem / potrzeba

Pięć zgłoszeń właściciela z trybu „wskaż element". Łączy je jedno: **aplikacja gubi to, co
użytkownik już zrobił lub przeczytał** — pozycję na stronie, wiedzę wynikającą z jego działań,
wygenerowane streszczenie — i każe mu tę pracę wykonać ponownie.

1. **Powrót „wstecz" zaczyna stronę od góry.** Po zejściu w głąb długiej listy i wejściu w szczegół
   powrót gubi miejsce czytania: użytkownik ląduje na szczycie i musi przewijać od nowa. Na liście
   wiadomości albo zadań to znaczy dziesiątki przewinięć za każdym cofnięciem.
2. **„Wiedza o Tobie" nie rośnie z korzystania z aplikacji.** Właściciel spodziewał się, że profil
   będzie przyrastał sam — z tego, co w aplikacji robi — a nie tylko wtedy, gdy sam poprosi
   o hipotezy. Dziś sekcja pozostaje pusta, dopóki ktoś nie kliknie „Poszukaj hipotez", a
   wnioskowanie patrzy na wąski wycinek zachowań, więc często i tak nie ma z czego wnioskować.
3. **Pasek nad Wiadomościami jest pusty i nieczytelny.** Trzy akcje w jednym wierszu (dwie same
   ikony po bokach, jedna ikona z tekstem w środku) wyglądają na przypadek, a nie na układ. Nad nimi
   stoi długi opis ostatniego przebiegu („źródeł: 9 · nowych materiałów: 1 · pozycji: 2 · faktów na
   osi: 1"), z którego na co dzień liczy się wyłącznie **czas** ostatniego odświeżenia. Oś czasu jest
   schowana pod przełącznikiem, którego łatwo nie zauważyć, choć jest jednym z dwóch głównych sposobów
   czytania modułu.
4. **Ten sam poziom streszczenia daje dwa różne teksty.** Przełączenie „średnie → krótkie → średnie"
   nie wraca do pierwotnego streszczenia, tylko generuje nowe — wyraźnie dłuższe, mimo że poziom jest
   ten sam. Użytkownik nie ma jak wrócić do tekstu, który już przeczytał, i płaci za każdą taką
   podróż. Osobno: część pozycji dostaje streszczenie w rodzaju „brak treści do streszczenia", a po
   zmianie poziomu treść nagle się znajduje — czyli pierwsze podejście poddaje się zbyt wcześnie.
5. **Lektor czyta nieaktualny tekst.** Po zmianie poziomu streszczenia lektor nadal czyta wersję
   sprzed zmiany — na ekranie stoi jeden tekst, w uszach drugi.

## 2. Cel i miary sukcesu

- **Cel:** aplikacja pamięta miejsce, w którym użytkownik przerwał (pozycja na stronie, wygenerowane
  streszczenie), sama przyrasta wiedzą z jego działań, a moduł Wiadomości daje na treść maksimum
  miejsca przy układzie, który mówi wprost, co gdzie jest.
- **Sukces mierzymy:**
  - powrót „wstecz" na dowolną przewiniętą listę pokazuje **to samo miejsce**, a nie górę strony;
  - w „Wiedzy o Tobie" pojawiają się hipotezy **bez klikania** „Poszukaj hipotez", oparte na
    działaniach z więcej niż trzech obecnych sygnałów;
  - w pasku nad Wiadomościami nie ma pustych przestrzeni: akcja tekstowa wypełnia wolną szerokość,
    a akcje ikonowe zajmują tyle, ile potrzebują; opis przebiegu skraca się do samego czasu;
  - powrót na poziom streszczenia, który już był wygenerowany, jest **natychmiastowy, bezpłatny
    i daje identyczny tekst**;
  - lektor po zmianie poziomu czyta **ten tekst, który widać na ekranie**.

## 3. Historyjki użytkownika

- Jako czytelnik długiej listy chcę po powrocie „wstecz" znaleźć się tam, gdzie przerwałem, żeby nie
  przewijać setek pikseli po każdym wejściu w szczegół.
- Jako użytkownik chcę, żeby system uczył się mnie z tego, co w nim **robię**, a nie wyłącznie z
  odpowiedzi na pytania — żeby podpowiedzi w innych modułach z czasem stawały się trafniejsze.
- Jako użytkownik chcę nadal **zatwierdzać albo odrzucać** każdą hipotezę o mnie, żeby profil nie
  rósł o rzeczy, z którymi się nie zgadzam.
- Jako czytelnik wiadomości chcę mieć oś czasu jako **równorzędny widok**, a nie opcję ukrytą pod
  przełącznikiem, żeby wiedzieć, że w ogóle istnieje.
- Jako czytelnik wiadomości chcę widzieć nad treścią wyłącznie to, co potrzebne (kiedy ostatnio
  odświeżono), żeby na czytanie zostało jak najwięcej ekranu.
- Jako czytelnik chcę wrócić do poprzedniego poziomu streszczenia i dostać **dokładnie ten sam
  tekst**, który już czytałem, natychmiast i bez kosztu.
- Jako czytelnik chcę móc **świadomie poprosić o wygenerowanie streszczenia od nowa** na wybranym
  poziomie, gdy to, które dostałem, mi nie odpowiada.
- Jako czytelnik chcę, żeby pozycja, której nie udało się streścić za pierwszym razem, **dostała
  streszczenie mimo to** — bez zgadywania, że pomoże przełączenie poziomu.
- Jako słuchacz chcę, żeby lektor czytał tekst, który widzę na ekranie, także po zmianie poziomu.

## 4. Kryteria akceptacji (testowalne)

**Powrót do miejsca czytania**

- [ ] **AC-1** — Given użytkownik przewinął listę w dowolnym module o co najmniej ekran, when wchodzi
      w element i wraca gestem/przyciskiem „wstecz", then widok pokazuje **tę samą pozycję
      przewinięcia** (z tolerancją kilku pikseli), a nie górę strony.
- [ ] **AC-2** — Given użytkownik wchodzi na stronę **po raz pierwszy** albo z odnośnika (nie
      „wstecz"), when strona się otwiera, then widok jest na **górze** — przywracanie dotyczy
      wyłącznie powrotu w historii.
- [ ] **AC-3** — Given przeglądarka odmawia dostępu do pamięci sesji (okno prywatne, zablokowane dane
      witryn), when użytkownik nawiguje wstecz, then aplikacja działa normalnie i po prostu nie
      przywraca pozycji — brak pamięci jest stanem poprawnym, nie błędem.

**Wiedza o użytkowniku**

- [ ] **AC-4** — Given użytkownik korzysta z aplikacji (m.in. prowadzi zadania, nawyki, tematy
      wiadomości, przepisy, pomysły pogodowe), when wnioskowanie się uruchomi, then hipotezy powstają
      na podstawie **metadanych działań z wielu modułów**, a nie wyłącznie z trzech dotychczasowych
      sygnałów.
- [ ] **AC-5** — Given w aplikacji przybyło materiału od ostatniego wnioskowania, when mija ustalony
      odstęp czasu, then wnioskowanie **uruchamia się samo**, bez klikania „Poszukaj hipotez",
      i nowe hipotezy są widoczne w „Wiedzy o Tobie".
- [ ] **AC-6** — Given od ostatniego przebiegu nie przybyło nowego materiału, when nadchodzi termin
      automatycznego wnioskowania, then **model nie jest wołany** (brak kosztu za przebieg bez
      nowych danych).
- [ ] **AC-7** — Given powstała nowa hipoteza, when użytkownik ją widzi, then może ją **potwierdzić
      albo odrzucić**, a odrzucona **nie wraca** w kolejnych przebiegach.
- [ ] **AC-8** — Given wnioskowanie zbiera materiał, when buduje obraz zachowań, then **nie czyta
      treści** notatek, zdrowia ani finansów, i nie formułuje hipotez o zdrowiu, poglądach
      politycznych, wyznaniu, orientacji ani sytuacji materialnej.
- [ ] **AC-9** — Given użytkownik nie chce automatycznego wnioskowania, when otworzy ustawienia
      asystenta, then może je **wyłączyć**, a wyłączone nie uruchamia się samo (ręczny przycisk
      zostaje).

**Układ modułu Wiadomości**

- [ ] **AC-10** — Given użytkownik jest w module Wiadomości, when patrzy na zakładki, then widzi trzy
      równorzędne widoki: **Wiadomości**, **Gorące tematy**, **Oś czasu** — oś czasu jest zakładką,
      a nie opcją przełącznika.
- [ ] **AC-11** — Given oś czasu jest zakładką, when użytkownik szuka dawnego przełącznika treści
      (wiadomości ⇄ oś czasu), then przełącznika **nie ma** — jedna decyzja ma jedno miejsce.
- [ ] **AC-12** — Given użytkownik zapisał widok (ulubione) albo odświeżył stronę, when do niego
      wraca, then wybrana zakładka i wybrane portale są **te same** — stan widoku żyje w adresie.
- [ ] **AC-13** — Given użytkownik patrzy na pasek akcji modułu, when w pasku jest wolne miejsce,
      then akcja **z tekstem** („Odśwież") rozciąga się na tę wolną szerokość, a akcje **ikonowe**
      zajmują minimum, którego potrzebują — wiersz nie ma pustych przestrzeni między trzema
      elementami.
- [ ] **AC-14** — Given ostatnie odświeżanie zakończyło się powodzeniem, when użytkownik patrzy nad
      treść, then widzi **wyłącznie czas** ostatniego odświeżenia; liczby (źródeł, nowych materiałów,
      pozycji, faktów) są dostępne, ale **nie zajmują wiersza** w widoku domyślnym.
- [ ] **AC-15** — Given odświeżanie **trwa** albo **nie powiodło się**, when użytkownik patrzy nad
      treść, then komunikat o postępie/niepowodzeniu jest widoczny jak dotychczas — skróceniu
      podlega wyłącznie opis **udanego** przebiegu.
- [ ] **AC-16** — Given ekran szerokości 360 px, when użytkownik otwiera moduł Wiadomości, then żaden
      pasek nie wymusza **poziomego przewijania strony**, a każdy cel dotyku ma co najmniej 44 px
      wysokości.
- [ ] **AC-17** — Given użytkownik chce zarządzać portalami, when szuka listy źródeł, then dochodzi
      do niej z **paska nawigacji modułu** — z panelu filtra portali, jednym dotknięciem — a nie
      z osobnej zakładki widoku. (Doprecyzowane na etapie `/plan`, C-54: zarządzanie mieszka w tym
      samym panelu, co filtr, bo obie kontrolki dotyczą jednego pojęcia „portale"; drugi przycisk
      obok filtra powtarzałby to samo słowo.)

**Streszczenia**

- [ ] **AC-18** — Given pozycja ma już wygenerowane streszczenie na poziomie „średnim", when
      użytkownik przełącza na „krótkie", a potem wraca na „średnie", then dostaje **identyczny
      tekst** co za pierwszym razem, **natychmiast** i **bez wywołania modelu**.
- [ ] **AC-19** — Given użytkownik prosi o poziom, którego jeszcze nie ma, when streszczenie
      powstaje, then jest generowane z materiału **źródłowego** (pełny artykuł, a w razie
      niepowodzenia skrót z kanału) — **nigdy** z wcześniejszego streszczenia.
- [ ] **AC-20** — Given użytkownikowi nie odpowiada streszczenie na danym poziomie, when użyje akcji
      „wygeneruj ponownie", then powstaje **nowe** streszczenie tego poziomu i **zastępuje**
      zapamiętane; akcja jest odróżnialna od zwykłego przełączania poziomu.
- [ ] **AC-21** — Given pierwsze podejście do streszczenia nie znalazło materiału (pusty lub bardzo
      ubogi skrót z kanału), when system to wykryje, then **sam sięga po pełną treść artykułu
      i ponawia** — użytkownik nie musi przełączać poziomu, żeby „obudzić" streszczenie.
- [ ] **AC-22** — Given mimo ponowień streszczenia nie udało się zbudować, when użytkownik patrzy na
      pozycję, then widzi **wyraźną informację**, że streszczenia nie ma, oraz **akcję ponowienia**
      na żądanie — pozycja nie udaje kompletnej.
- [ ] **AC-23** — Given użytkownik ma w ustawieniach domyślny poziom „średni", when otwiera świeżo
      pobrane pozycje, then ich streszczenia są na poziomie średnim i mieszczą się w deklarowanej
      długości tego poziomu (nie są dwukrotnie dłuższe).

**Lektor**

- [ ] **AC-24** — Given lektor czyta pozycję, when użytkownik zmieni poziom streszczenia tej pozycji,
      then lektor czyta **nowy** tekst (od początku nowej treści), a nie tekst sprzed zmiany.
- [ ] **AC-25** — Given lektor **nie** czyta danej pozycji, when użytkownik zmieni jej poziom
      streszczenia, then na ekranie widnieje nowy tekst, a późniejsze uruchomienie lektora czyta
      właśnie ten tekst.
- [ ] **AC-26** — Given lektor czyta pozycję, when podświetlane jest czytane zdanie, then
      podświetlenie trafia w zdanie **aktualnie wyświetlanego** streszczenia.

## 5. Zakres

**W zakresie:**

- Przywracanie pozycji przewijania przy nawigacji wstecz — mechanizm **wspólny dla całej aplikacji**,
  wpięty tam, gdzie żyje przewijanie widoku (nie kopiowany do modułów).
- Poszerzenie sygnałów wnioskowania o wiedzy o użytkowniku o metadane działań z kolejnych modułów
  oraz automatyczne, okresowe uruchamianie wnioskowania, gdy przybyło materiału; przełącznik
  wyłączający automat.
- Przebudowa układu modułu Wiadomości: trzy zakładki (Wiadomości / Gorące tematy / Oś czasu),
  źródła w pasku nawigacji, proporcje przycisków w pasku akcji, skrócenie opisu udanego przebiegu
  do samego czasu.
- Zapamiętywanie streszczeń **osobno dla każdego poziomu** + ręczne „wygeneruj ponownie" +
  generowanie zawsze z materiału źródłowego + ponowienie z pełną treścią artykułu, gdy pierwsze
  podejście nie miało z czego streszczać + widoczna informacja i akcja przy trwałym niepowodzeniu.
- Jedno źródło prawdy o treści streszczenia dla karty i dla lektora.
- Wpis do `doświadczenia.md` (C-51) — pięć zgłoszeń, z czego co najmniej trzy to realne błędy.

**Poza zakresem (świadomie):**

- Zmiana **treści** promptów streszczania poza tym, co wymaga powtarzalności długości (AC-23) —
  nie przepisujemy stylu streszczeń.
- Wnioskowanie z **treści** notatek, zdrowia, finansów i wiadomości prywatnych — świadomie
  wykluczone (AC-8), tak jak dotąd.
- Przywracanie pozycji przewijania **wewnątrz** paneli bocznych i list wirtualizowanych ponad to, co
  daje mechanizm wspólny — jeśli któryś widok ma osobny kontener przewijania, dostanie to razem
  z ramą albo wcale.
- Nowe uprawnienia, nowy moduł, zmiany w modelu współwłasności.
- Przebudowa lektora poza usunięciem rozjazdu tekstu (AC-24..AC-26).

## 6. Wpływ na Omnia

- **Uprawnienie / RBAC:** bez zmian — korzystamy z istniejących slugów (`module.news`, ustawienia
  użytkownika). Żadnego nowego `module.*` (C-22 nie uruchamia się).
- **Własność danych:** wszystkie dotknięte dane są **osobiste** (streszczenia pozycji należą do
  tematu użytkownika, wiedza o użytkowniku jest per-użytkownik, pozycja przewijania nie opuszcza
  przeglądarki). Zapis i odczyt przez istniejące pomocniki własności (C-21 w brzmieniu po 079:
  przestrzeń, nie kolumny właściciela).
- **Asystent AI:** bez nowej `AIAction`. Zmienia się **materiał wejściowy** wnioskowania o
  użytkowniku i sposób jego uruchamiania; streszczenia pozostają wywołaniami na żądanie. Nowe
  wywołania modelu muszą nieść koszt do wskaźnika (bramka pokrycia kosztów) i mieć świadomą
  klasyfikację pamięci treści.
- **Kalendarz / powiadomienia / trash:** nie dotyczy. Automatyczne wnioskowanie **nie** generuje
  powiadomień — hipoteza to nie zdarzenie, a właściciel prosił o ciche przyrastanie wiedzy.

## 7. Zgodność z konstytucją

- **C-10, C-11, C-12, C-14** — zapamiętywanie streszczeń per poziom oraz znacznik ostatniego
  wnioskowania wymagają **ręcznie napisanych plików migracji** z unikalnym, sekwencyjnym numerem;
  poziom streszczenia zostaje kolumną tekstową z unią TS, **nigdy** enumem Prisma.
- **C-13** — żadnego builda ani migracji przeciwko produkcyjnej bazie; weryfikacja lokalna do kroku
  budowy aplikacji.
- **C-20** — każda mutacja idzie Server Action zakończoną `revalidatePath()`.
- **C-21 / C-17** — dostęp do pozycji i tematu rozstrzygają istniejące guardy; nie poszerzamy
  niczyjego dostępu „przy okazji".
- **C-23** — nie dodajemy `AIAction`; gdyby plan jednak jakąś wprowadził, musi mieć egzekutor.
- **C-30** — kolory wyłącznie zmiennymi CSS, tekst na kolorowym tle przez token akcentu.
- **C-31** — układ Wiadomości ma się bronić przy 360 px, bez poziomego przewijania strony i z celami
  dotyku ≥ 44 px (AC-16).
- **C-32** — nowe teksty widoczne dla użytkownika idą do słownika komunikatów, po polsku; żadnych
  literałów w komponentach.
- **C-33** — pasek widoku, sloty akcji i ustawień oraz stan brzegowy rysuje **rama**, nie moduł.
  Gdyby proporcje przycisków wymagały czegoś, czego rama nie umie — **poszerzamy ramę**, nie robimy
  wyjątku w module.
- **C-35** — mechanizm przywracania przewijania dostarczamy **razem z pierwszym konsumentem**
  (wpięty w ramę widoku), nie jako gotowy, nieużywany komponent.
- **C-36** — przywracanie przewijania i wnioskowanie o użytkowniku są **zdolnościami platformy**;
  platforma nie zna modułów, więc wiedzę modułową (skąd brać sygnały) przyjmuje **parametrem
  wymaganym** z korzenia kompozycji.
- **C-51** — wpis do dziennika doświadczeń razem z poprawką.
- **C-52 / C-52a** — merge do `develop`, promocja `develop → master` fast-forwardem z tagiem wydania.
- **C-53** — minimalizm: rozwiązanie najmniejsze z możliwych, bez refaktorów „przy okazji".

## 8. Otwarte pytania / decyzje właściciela

Zebrane w jednym momencie pytań (C-55). Odpowiedzi właściciela:

- [x] **Układ Wiadomości** → **trzy zakładki + odchudzony pasek.** Zakładki: Wiadomości / Gorące
      tematy / Oś czasu (przełącznik treści znika). Źródła wchodzą do paska nawigacji obok filtra.
      W pasku akcji „Odśwież" rozciąga się na wolną szerokość, akcje ikonowe biorą minimum. Opis
      udanego przebiegu zwija się do samego czasu, szczegóły zostają dostępne w podpowiedzi.
- [x] **Streszczenia** → **pamięć per poziom**, generowanie zawsze z materiału źródłowego —
      **oraz dwa uzupełnienia zgłoszone przez właściciela przy odpowiedzi:**
      (a) ma istnieć **ręczne wywołanie ponownej generacji** streszczenia na wybranym poziomie
      (AC-20); (b) zdarza się, że pozycja dostaje „brak treści do streszczenia", a po zmianie
      poziomu treść się jednak znajduje — potrzebna jest **kontrola i ponowienie**, żeby użytkownik
      dostał streszczenie także wtedy, gdy pierwsze podejście się nie powiodło (AC-21, AC-22).
- [x] **Wiedza o użytkowniku** → **szersze sygnały + automat w tle.** Metadane działań z wielu
      modułów (bez zaglądania w treść notatek, zdrowia i finansów), okresowe uruchamianie, gdy
      przybyło materiału. Hipotezy nadal wymagają potwierdzenia.

Założenia przyjęte samodzielnie (rozstrzygnięte rekomendowanym domyślnym, bez pytania):

- **Przywracanie przewijania** działa **wyłącznie przy nawigacji wstecz** i żyje w pamięci
  przeglądarki na czas sesji (jak istniejąca historia nawigacji) — nie w bazie: zapis przy każdej
  zmianie adresu byłby najczęstszą operacją w aplikacji dla danych, które tracą sens z zamkniętą kartą.
- **Automat wnioskowania jest wyłączalny** (AC-9) i **domyślnie włączony** — właściciel prosił, żeby
  wiedza przyrastała sama, więc domyślnie wyłączony automat nie spełniłby zgłoszenia.
- **Automat nie powiadamia** o nowych hipotezach — przyrastanie ma być ciche.
- Skrócony opis przebiegu **zachowuje szczegóły** (nie kasujemy ich), tylko przenosi je poza wiersz.

## 9. Ryzyka

- **Przywracanie przewijania w niewłaściwym momencie** (przed dorysowaniem treści) da skok albo brak
  efektu → przywracamy dopiero, gdy widok ma wysokość pozwalającą na daną pozycję, i odpuszczamy po
  rozsądnym czasie zamiast walczyć z układem. Ryzyko dotyczy list dociąganych asynchronicznie.
- **Przebudowa zakładek Wiadomości psuje zapisane widoki** właściciela (ulubione trzymają adres) →
  stary adres z przełącznikiem treści musi prowadzić do sensownego widoku, a nie do pustki.
- **Pamięć streszczeń per poziom rozjeżdża się z bieżącym streszczeniem** — dwa nośniki tej samej
  informacji to znany w tym repo wzorzec awarii → **jedno** źródło prawdy o tekście pokazywanym
  i czytanym; karta i lektor biorą go z tego samego miejsca (to jest zarazem lekarstwo na AC-24).
- **Automatyczne wnioskowanie generuje koszt bez decyzji użytkownika** → twardy warunek „nowy
  materiał od ostatniego przebiegu" (AC-6), odstęp czasu i wyłącznik (AC-9).
- **Ponawianie streszczeń z pełną treścią artykułu** to dodatkowe żądania HTTP i tokeny → ponawiamy
  wyłącznie tam, gdzie pierwsze podejście faktycznie nie miało materiału, nie „na wszelki wypadek".
- **Poszerzenie sygnałów o użytkowniku ociera się o prywatność** → lista sygnałów jest jawna
  i ograniczona do metadanych; zakaz kategorii wrażliwych zostaje w mocy (AC-8).
